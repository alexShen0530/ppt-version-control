"""Match pages between two parsed PPT versions without invoking any model."""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher
from typing import Any

from functions.common_utils import collect_multimedia_ocr, enrich_pages_with_ocr
from functions.doc_intelligence import parse_document, merge_markdown_by_page


Page = dict[str, Any]
PageRelation = dict[str, Any]


def parse_ppt_pages(ppt_path: str) -> list[Page]:
    """解析 PPT 正文和多媒体内容，返回可用于页面匹配的结构化页面。"""
    with ThreadPoolExecutor(max_workers=2) as executor:
        document_future = executor.submit(parse_document, ppt_path)
        multimedia_future = executor.submit(collect_multimedia_ocr, ppt_path)
        document_result = document_future.result()
        multimedia_result = multimedia_future.result()

    page_text_list = merge_markdown_by_page(document_result)
    return enrich_pages_with_ocr(ppt_path, page_text_list, multimedia_result)


def _normalize_text(value: Any) -> str:
    text = str(value or "").lower()
    text = re.sub(r"!\[[^]]*]\([^)]*\)", " ", text)
    text = re.sub(r"\s+", "", text)
    return text


def _page_text(page: Page) -> str:
    """Flatten one page while retaining numbers and meaningful punctuation."""
    parts = [page.get("text", "")]

    for image in page.get("images", []) or []:
        if isinstance(image, dict):
            parts.extend((image.get("raw_text", ""), image.get("summary", "")))
        else:
            parts.append(image)

    for video in page.get("videos", []) or []:
        parts.append(video.get("summary", "") if isinstance(video, dict) else video)

    return _normalize_text("\n".join(str(part) for part in parts if part))


def _title(page: Page) -> str:
    text = str(page.get("text", ""))
    for line in text.splitlines():
        line = re.sub(r"^[#>*\-\s]+", "", line).strip()
        if line:
            return _normalize_text(line[:120])
    return ""


def page_similarity(old_page: Page, new_page: Page) -> float:
    """Return a page matching score in [0, 1]; this is not a diff result."""
    old_text, new_text = _page_text(old_page), _page_text(new_page)
    if not old_text and not new_text:
        return 1.0
    if not old_text or not new_text:
        return 0.0

    content_score = SequenceMatcher(None, old_text, new_text, autojunk=False).ratio()
    old_title, new_title = _title(old_page), _title(new_page)
    if not old_title or not new_title:
        return content_score

    title_score = SequenceMatcher(None, old_title, new_title, autojunk=False).ratio()
    return 0.75 * content_score + 0.25 * title_score


def _sequence_align(
    old_pages: list[Page],
    new_pages: list[Page],
    min_similarity: float,
) -> tuple[list[tuple[int, int, float]], set[int], set[int]]:
    """Order-preserving alignment for normal insertions and deletions."""
    old_count, new_count = len(old_pages), len(new_pages)
    gap_penalty = -0.35
    scores = [[0.0] * (new_count + 1) for _ in range(old_count + 1)]
    choices = [[""] * (new_count + 1) for _ in range(old_count + 1)]

    for i in range(1, old_count + 1):
        scores[i][0] = i * gap_penalty
        choices[i][0] = "delete"
    for j in range(1, new_count + 1):
        scores[0][j] = j * gap_penalty
        choices[0][j] = "add"

    similarity_cache: dict[tuple[int, int], float] = {}
    for i in range(1, old_count + 1):
        for j in range(1, new_count + 1):
            similarity = page_similarity(old_pages[i - 1], new_pages[j - 1])
            similarity_cache[(i - 1, j - 1)] = similarity
            match_score = similarity if similarity >= min_similarity else -1.0
            candidates = {
                "match": scores[i - 1][j - 1] + match_score,
                "delete": scores[i - 1][j] + gap_penalty,
                "add": scores[i][j - 1] + gap_penalty,
            }
            choice = max(candidates, key=candidates.get)
            scores[i][j] = candidates[choice]
            choices[i][j] = choice

    pairs: list[tuple[int, int, float]] = []
    unmatched_old, unmatched_new = set(), set()
    i, j = old_count, new_count
    while i or j:
        choice = choices[i][j]
        if choice == "match":
            similarity = similarity_cache[(i - 1, j - 1)]
            if similarity >= min_similarity:
                pairs.append((i - 1, j - 1, similarity))
            else:
                unmatched_old.add(i - 1)
                unmatched_new.add(j - 1)
            i -= 1
            j -= 1
        elif choice == "delete":
            unmatched_old.add(i - 1)
            i -= 1
        else:
            unmatched_new.add(j - 1)
            j -= 1

    pairs.reverse()
    return pairs, unmatched_old, unmatched_new


def _match_moved_pages(
    old_pages: list[Page],
    new_pages: list[Page],
    unmatched_old: set[int],
    unmatched_new: set[int],
    min_similarity: float,
) -> list[tuple[int, int, float]]:
    """Greedily recover high-confidence moved pages from unmatched pages."""
    candidates = []
    for old_index in unmatched_old:
        for new_index in unmatched_new:
            similarity = page_similarity(old_pages[old_index], new_pages[new_index])
            if similarity >= min_similarity:
                candidates.append((similarity, old_index, new_index))

    moved = []
    used_old, used_new = set(), set()
    for similarity, old_index, new_index in sorted(candidates, reverse=True):
        if old_index in used_old or new_index in used_new:
            continue
        used_old.add(old_index)
        used_new.add(new_index)
        moved.append((old_index, new_index, similarity))

    unmatched_old.difference_update(used_old)
    unmatched_new.difference_update(used_new)
    return moved


def match_pages(
    old_pages: list[Page],
    new_pages: list[Page],
    min_similarity: float = 0.45,
    moved_min_similarity: float = 0.65,
) -> list[PageRelation]:
    """Build one-to-one page relations for later AI-based difference analysis."""
    if not 0 <= min_similarity <= 1 or not 0 <= moved_min_similarity <= 1:
        raise ValueError("相似度阈值必须在 0 到 1 之间")

    pairs, unmatched_old, unmatched_new = _sequence_align(
        old_pages, new_pages, min_similarity
    )
    moved_pairs = _match_moved_pages(
        old_pages,
        new_pages,
        unmatched_old,
        unmatched_new,
        moved_min_similarity,
    )

    relations: list[PageRelation] = []
    for old_index, new_index, similarity in pairs:
        relations.append({
            "relation": "matched",
            "old_page": old_pages[old_index],
            "new_page": new_pages[new_index],
            "similarity": round(similarity, 4),
        })
    for old_index, new_index, similarity in moved_pairs:
        relations.append({
            "relation": "moved",
            "old_page": old_pages[old_index],
            "new_page": new_pages[new_index],
            "similarity": round(similarity, 4),
        })
    for new_index in unmatched_new:
        relations.append({
            "relation": "added",
            "old_page": None,
            "new_page": new_pages[new_index],
            "similarity": None,
        })
    for old_index in unmatched_old:
        relations.append({
            "relation": "deleted",
            "old_page": old_pages[old_index],
            "new_page": None,
            "similarity": None,
        })

    return sorted(
        relations,
        key=lambda item: (
            item["new_page"] is None,
            (item["new_page"] or item["old_page"]).get("page_num", 0),
        ),
    )


def match_ppt_files(
    old_ppt_path: str,
    new_ppt_path: str,
    min_similarity: float = 0.45,
    moved_min_similarity: float = 0.65,
) -> list[PageRelation]:
    """解析并匹配两份 PPT 的页面。"""
    old_pages = parse_ppt_pages(old_ppt_path)
    new_pages = parse_ppt_pages(new_ppt_path)

    return match_pages(
        old_pages,
        new_pages,
        min_similarity=min_similarity,
        moved_min_similarity=moved_min_similarity,
    )


if __name__ == "__main__":
    old_ppt_path = r"C:\Users\shen.xin\Downloads\AI&财务\希迪智驾公司介绍V1.pptx"
    new_ppt_path = r"C:\Users\shen.xin\Downloads\AI&财务\希迪智驾公司介绍V2.pptx"

    result = match_ppt_files(old_ppt_path, new_ppt_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
# -*- coding: utf-8 -*-
"""
PPT 内嵌视频抽帧工具

整套流程:
1. 从 pptx 中提取所有嵌入的视频文件 (ppt/media/ 目录)
2. 尝试通过 python-pptx 定位每个视频所属的幻灯片页码
3. 用 OpenCV 对每个视频抽取 开头帧 / 中间帧 / 结尾帧
4. 保存为 jpg 图片, 并输出结果清单

依赖:
    pip install opencv-python python-pptx
"""

import zipfile
from pathlib import Path
from typing import Optional
import cv2
import config

# 常见视频后缀 (pptx 里嵌入的媒体格式)
VIDEO_EXTENSIONS = (".mp4", ".avi", ".wmv", ".mov", ".m4v", ".mkv", ".flv", ".webm")


# ---------------------------------------------------------------------------
# 第一步: 从 pptx 提取视频
# ---------------------------------------------------------------------------

def extract_videos_from_pptx(pptx_path: str, output_dir: str) -> list[Path]:
    """
    pptx 本质是 zip 包, 嵌入的视频位于 ppt/media/ 目录。
    将所有视频文件解压到 output_dir/media 下, 返回视频文件路径列表。
    """
    pptx_path = Path(pptx_path)
    media_dir = Path(output_dir) / "media"
    media_dir.mkdir(parents=True, exist_ok=True)

    video_paths: list[Path] = []

    with zipfile.ZipFile(pptx_path) as z:
        for name in z.namelist():
            if name.startswith("ppt/media/") and name.lower().endswith(VIDEO_EXTENSIONS):
                target = media_dir / Path(name).name
                # 用 read + write 代替 extract, 避免 zip-slip 路径问题
                with z.open(name) as src, open(target, "wb") as dst:
                    dst.write(src.read())
                video_paths.append(target)

    return sorted(video_paths)


def map_videos_to_slides(pptx_path: str) -> dict[str, int]:
    """
    用 python-pptx 遍历幻灯片, 找出视频文件名 -> 页码映射。
    python-pptx 未安装时返回空字典 (不影响主流程)。

    说明: 媒体形状的 blip_rId 指向的是海报图片而非视频本身,
    因此这里直接遍历幻灯片的 relationship, 找 reltype 为 video 的关系。

    返回示例: {"media1.mp4": 3}
    """
    try:
        from pptx import Presentation
    except ImportError:
        print("[warn] 未安装 python-pptx, 跳过视频与幻灯片的映射")
        return {}

    VIDEO_RELTYPE = (
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/video"
    )

    mapping: dict[str, int] = {}
    pres = Presentation(pptx_path)

    for slide_num, slide in enumerate(pres.slides, start=1):
        for rel in slide.part.rels.values():
            # 跳过外部链接 / 非视频类型
            if rel.is_external or rel.reltype != VIDEO_RELTYPE:
                continue
            # target_ref 形如 "../media/media1.mp4"
            mapping[Path(rel.target_ref).name] = slide_num

    return mapping


# ---------------------------------------------------------------------------
# 第二步: 抽取开头帧 / 中间帧 / 结尾帧
# ---------------------------------------------------------------------------

def extract_key_frames(
    video_path: str, output_dir: str, prefix: str
) -> tuple[dict[str, Optional[str]], Optional[float]]:
    """
    对单个视频抽取三个关键帧并保存为 jpg。

    返回: (三帧路径, 视频时长秒数)
    """
    video_path = Path(video_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[error] 无法打开视频 (可能缺少对应解码器): {video_path}")
        return {"start": None, "mid": None, "end": None}, None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    duration_seconds = total_frames / fps if total_frames > 0 and fps > 0 else None
    print(f"[info] {video_path.name}: 总帧数={total_frames}, fps={fps:.2f}")

    # 元数据不可靠时退化为 0 帧
    if total_frames <= 0:
        total_frames = 1

    positions = {
        "start": 0,
        "mid": max(total_frames // 2, 0),
        "end": max(total_frames - 1, 0),
    }

    saved: dict[str, Optional[str]] = {"start": None, "mid": None, "end": None}

    for tag, pos in positions.items():
        out_file = out_dir / f"{prefix}_{tag}.jpg"

        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ok, frame = cap.read()

        # 结尾帧 seek 失败的兜底: 从当前位置往后读直到最后一帧
        if not ok and tag == "end":
            ok, frame = _seek_last_frame(cap)

        if ok:
            encoded_ok, encoded = cv2.imencode(".jpg", frame)
            try:
                if encoded_ok:
                    encoded.tofile(str(out_file))
            except OSError as exc:
                print(f"[warn] 保存 {tag} 帧失败: {out_file} ({exc})")

            if encoded_ok and out_file.is_file() and out_file.stat().st_size > 0:
                saved[tag] = str(out_file)
            else:
                print(f"[warn] 保存 {tag} 帧失败: {out_file}")
        else:
            print(f"[warn] 抽取 {tag} 帧失败: {video_path.name}")

    cap.release()
    return saved, duration_seconds


def _seek_last_frame(cap: cv2.VideoCapture) -> tuple[bool, object]:
    """
    部分容器 (如 wmv) 对结尾 seek 不准, 从当前位置逐帧读到最后一帧兜底。
    """
    last = None
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        last = frame
    if last is not None:
        return True, last
    return False, None


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def process_ppt_videos(pptx_path: str, output_dir: str = "ppt_frames") -> list[dict]:
    """
    完整流程入口:

    1. 从 pptx 提取所有嵌入视频
    2. 映射视频所在幻灯片页码
    3. 对每个视频抽 开头/中间/结尾 三帧保存为 jpg

    :param pptx_path: pptx 文件路径
    :param output_dir: 输出目录 (media 存视频, frames 存图片)
    :return: 结果清单, 每项包含 video / slide / frames
    """
    pptx_path = Path(pptx_path)
    if not pptx_path.exists():
        raise FileNotFoundError(f"pptx 文件不存在: {pptx_path}")

    out_root = Path(output_dir)

    # 1. 提取视频
    videos = extract_videos_from_pptx(str(pptx_path), str(out_root))
    if not videos:
        print("[info] 该 pptx 中没有发现嵌入的视频")
        return []
    print(f"[info] 共提取到 {len(videos)} 个视频")

    # 2. 视频 -> 幻灯片页码
    slide_map = map_videos_to_slides(str(pptx_path))

    # 3. 抽帧
    frames_dir = out_root / "frames"
    results: list[dict] = []

    for idx, video in enumerate(videos, start=1):
        prefix = f"slide{slide_map.get(video.name, 'unknown')}_video{idx}"
        frames, duration_seconds = extract_key_frames(str(video), str(frames_dir), prefix)

        results.append({
            "video": str(video),
            "slide": slide_map.get(video.name),
            "frames": frames,
            "duration_seconds": duration_seconds,
        })

    # 4. 汇总打印
    print("\n========== 抽帧结果 ==========")
    for item in results:
        slide = item["slide"] if item["slide"] else "?"
        print(f"\n视频: {Path(item['video']).name} (第 {slide} 页)")
        for tag, path in item["frames"].items():
            print(f"  {tag:5s} -> {path or '失败'}")

    return results


if __name__ == "__main__":
    # 修改为你自己的 pptx 路径
    ppt_file = r"C:\Users\shen.xin\Downloads\AI&财务\AI落地应用场景规划V2.pptx"
    process_ppt_videos(ppt_file, output_dir=r"C:\Users\shen.xin\Desktop\work\local_download_dir")

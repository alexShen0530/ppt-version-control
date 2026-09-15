from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class MatchClassification(str, Enum):
    SAME_REVISION = "same_revision"
    NEW_REVISION = "new_revision"
    NEW_PAGE = "new_page"


@dataclass(slots=True)
class PageInput:
    topic_id: str
    source_file_name: str
    source_page_no: int
    screenshot_path: str


@dataclass(slots=True)
class ProcessedPage(PageInput):
    page_hash: str
    match_text: str
    embedding: list[float]


@dataclass(slots=True)
class PageRecord(ProcessedPage):
    page_id: str
    revision_group_id: str
    revision_no: int
    created_at: datetime | None = None


@dataclass(slots=True)
class MatchCandidate:
    page: PageRecord
    similarity: float


@dataclass(slots=True)
class MatchDecision:
    classification: MatchClassification
    matched_page_id: str | None = None
    revision_group_id: str | None = None


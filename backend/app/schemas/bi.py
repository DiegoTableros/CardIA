from pydantic import BaseModel

from app.schemas.recommend import ModelInfo, ProfileOut


class LabelCount(BaseModel):
    label: str
    count: int


class ProfileStats(BaseModel):
    profile: ProfileOut
    avg_annual_fee: float
    avg_interest_rate: float
    avg_cat: float
    avg_credit_line: float
    top_benefits: list[LabelCount]


class ScatterPoint(BaseModel):
    id: str
    name: str
    institution: str
    x: float
    y: float
    profile_id: int


class Kpis(BaseModel):
    cards: int
    institutions: int
    no_annual_fee: int
    avg_cat: float
    avg_interest_rate: float
    avg_annual_fee: float
    benefits: int
    fees: int


class ReportBlock(BaseModel):
    kind: str
    text: str


class ClusterReport(BaseModel):
    id: int
    title: str
    blocks: list[ReportBlock]


class ProfileReport(BaseModel):
    source: str
    method: list[str]
    intro: list[ReportBlock]
    closing: list[ReportBlock]
    clusters: list[ClusterReport]


class BIResponse(BaseModel):
    kpis: Kpis
    by_class: list[LabelCount]
    by_institution: list[LabelCount]
    benefit_types: list[LabelCount]
    fee_types: list[LabelCount]
    annual_fee_buckets: list[LabelCount]
    profiles: list[ProfileStats]
    scatter: list[ScatterPoint]
    model: ModelInfo
    report: ProfileReport | None = None

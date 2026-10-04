import json
from collections import Counter
from statistics import fmean

from app.core.config import DATA_DIR
from app.domain.models import CardRecord
from app.ml.profiles import PROFILES, assign_card_profile
from app.schemas.bi import BIResponse, Kpis, LabelCount, ProfileReport, ProfileStats, ScatterPoint
from app.services.recommend_service import model_info, profile_out

FEE_TYPE_LABEL = {"obligatoria": "Obligatoria", "por_evento": "Por evento", "penalizacion": "Penalización"}
BUCKETS: list[tuple[str, float, float]] = [
    ("$0", 0, 0),
    ("$1-600", 0.01, 600),
    ("$601-1,200", 600.01, 1200),
    ("$1,201-2,500", 1200.01, 2500),
    ("Más de $2,500", 2500.01, float("inf")),
]


def _avg(values: list[float | None]) -> float:
    vals = [v for v in values if v is not None]
    return round(fmean(vals), 2) if vals else 0.0


def _counts(counter: Counter[str]) -> list[LabelCount]:
    return [LabelCount(label=k, count=v) for k, v in counter.most_common()]


def _report() -> ProfileReport | None:
    path = DATA_DIR / "cluster_report.json"
    return ProfileReport(**json.loads(path.read_text(encoding="utf-8"))) if path.exists() else None


def build_bi(cards: list[CardRecord]) -> BIResponse:
    by_profile: dict[int, list[CardRecord]] = {p.id: [] for p in PROFILES}
    for c in cards:
        by_profile[assign_card_profile(c).id].append(c)

    buckets = Counter[str]()
    for c in cards:
        fee = c.annual_fee or 0
        for label, lo, hi in BUCKETS:
            if lo <= fee <= hi:
                buckets[label] += 1
                break

    return BIResponse(
        kpis=Kpis(
            cards=len(cards),
            institutions=len({c.institution for c in cards}),
            no_annual_fee=sum(1 for c in cards if (c.annual_fee or 0) == 0),
            avg_cat=_avg([c.cat for c in cards]),
            avg_interest_rate=_avg([c.interest_rate for c in cards]),
            avg_annual_fee=_avg([c.annual_fee for c in cards]),
            benefits=sum(len(c.benefits) for c in cards),
            fees=sum(len(c.fees) for c in cards),
        ),
        by_class=_counts(Counter(c.card_class for c in cards)),
        by_institution=_counts(Counter(c.institution for c in cards)),
        benefit_types=_counts(Counter(b.benefit_type for c in cards for b in c.benefits)),
        fee_types=_counts(Counter(FEE_TYPE_LABEL.get(f.fee_type, "Otro") for c in cards for f in c.fees)),
        annual_fee_buckets=[LabelCount(label=label, count=buckets[label]) for label, _, _ in BUCKETS],
        profiles=[
            ProfileStats(
                profile=profile_out(p, cards),
                avg_annual_fee=_avg([c.annual_fee for c in by_profile[p.id]]),
                avg_interest_rate=_avg([c.interest_rate for c in by_profile[p.id]]),
                avg_cat=_avg([c.cat for c in by_profile[p.id]]),
                avg_credit_line=_avg([c.credit_line_min for c in by_profile[p.id]]),
                top_benefits=_counts(Counter(t for c in by_profile[p.id] for t in c.benefit_types))[:4],
            )
            for p in PROFILES
        ],
        scatter=[
            ScatterPoint(
                id=c.id,
                name=c.name,
                institution=c.institution,
                x=c.annual_fee or 0,
                y=c.interest_rate or 0,
                profile_id=assign_card_profile(c).id,
            )
            for c in cards
        ],
        model=model_info(),
        report=_report(),
    )

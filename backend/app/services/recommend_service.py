from app.core.disclaimer import DISCLAIMER
from app.domain.models import CardRecord
from app.ml.profiles import FEATURES, IS_STUB, MODEL_DESCRIPTION, MODEL_VERSION, Profile, assign_card_profile
from app.ml.recommender import RecommendResult, recommend
from app.schemas.recommend import (
    ModelInfo,
    ProfileOut,
    ProfileScore,
    Recommendation,
    RecommendResponse,
    UserProfileIn,
)
from app.services.catalog import to_summary


def model_info() -> ModelInfo:
    return ModelInfo(
        version=MODEL_VERSION,
        is_stub=IS_STUB,
        features=list(FEATURES),
        description=MODEL_DESCRIPTION,
    )


def profile_out(profile: Profile, cards: list[CardRecord]) -> ProfileOut:
    count = sum(1 for c in cards if assign_card_profile(c).id == profile.id)
    return ProfileOut(
        id=profile.id,
        key=profile.key,
        label=profile.label,
        analytic_name=profile.analytic_name,
        tagline=profile.tagline,
        description=profile.description,
        color=profile.color,
        icon=profile.icon,
        traits=list(profile.traits),
        card_count=count,
    )


def run_recommendation(payload: UserProfileIn, cards: list[CardRecord]) -> RecommendResponse:
    result: RecommendResult = recommend(payload, cards)
    return RecommendResponse(
        profile=profile_out(result.profile, cards),
        profile_reason=result.profile_reason,
        profile_scores=[
            ProfileScore(id=p.id, label=p.label, color=p.color, score=round(s * 100, 1))
            for p, s in result.profile_fit
        ],
        recommendations=[
            Recommendation(
                card=to_summary(s.card),
                score=s.score,
                eligibility=s.eligibility,  # type: ignore[arg-type]
                reasons=s.reasons,
                warnings=s.warnings,
            )
            for s in result.items
        ],
        excluded_count=result.excluded_count,
        assumptions=result.assumptions,
        model=model_info(),
        disclaimer=DISCLAIMER,
    )

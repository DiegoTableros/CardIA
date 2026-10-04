from app.db.seed import load_cards_json
from app.domain.models import BenefitRecord, CardRecord, FeeRecord
from app.domain.normalize import clean_benefit_text, denomination_key, fee_type_key, normalize_header
from app.ml.profiles import PROFILES, assign_card_profile
from app.ml.recommender import recommend
from app.schemas.recommend import UserProfileIn


def _cards() -> list[CardRecord]:
    out = []
    for c in load_cards_json():
        r = c["requirements"]
        out.append(
            CardRecord(
                id=c["id"],
                name=c["name"],
                institution=c["institution"],
                card_class=c["card_class"],
                cat=c["cat"],
                annual_fee=c["annual_fee"],
                interest_rate=c["interest_rate"],
                credit_line_min=c["credit_line_min"],
                institution_url=c.get("institution_url"),
                image_url=c.get("image_url"),
                image_orientation=c.get("image_orientation"),
                cluster=c.get("cluster"),
                features=c.get("features") or {},
                fees=[FeeRecord(**f) for f in c["fees"]],
                benefits=[BenefitRecord(**b) for b in c["benefits"]],
                **r,
            )
        )
    return out


def test_normalize_header() -> None:
    assert normalize_header("CAT\npublicidad\n(%)") == "cat_publicidad"
    assert normalize_header("Anualidad\n($)*") == "anualidad"
    assert normalize_header("Tasa de\ninteres de\ncontrato\n(%)") == "tasa_de_interes_de_contrato"
    assert normalize_header("Antigüedad laboral mínima") == "antiguedad_laboral_minima"


def test_value_keys() -> None:
    assert fee_type_key("Penalización") == "penalizacion"
    assert fee_type_key("Por evento") == "por_evento"
    assert denomination_key("del monto de la transacción") == "PCT"
    assert denomination_key("dólares") == "USD"
    assert clean_benefit_text("Puntos", "Puntos Puntos Premia") == "Puntos Premia"


def test_cards_json_integrity() -> None:
    cards = _cards()
    assert len(cards) == 69
    assert len({c.id for c in cards}) == 69
    assert sum(len(c.fees) for c in cards) == 652
    assert sum(len(c.benefits) for c in cards) == 316


def test_every_card_gets_a_profile() -> None:
    cards = _cards()
    ids = {assign_card_profile(c).id for c in cards}
    assert ids == {p.id for p in PROFILES} == set(range(6))


def test_cluster_stats_match_report() -> None:
    """Las cifras de perfilamiento_clusters.docx deben reproducirse desde los datos cargados."""
    by: dict[int, list[CardRecord]] = {}
    for c in _cards():
        by.setdefault(c.cluster, []).append(c)
    assert {k: len(v) for k, v in by.items()} == {0: 10, 1: 14, 2: 13, 3: 10, 4: 12, 5: 10}
    cat = {k: round(sum(c.cat for c in v) / len(v), 2) for k, v in by.items()}
    assert cat == {0: 79.87, 1: 72.35, 2: 70.45, 3: 86.74, 4: 71.74, 5: 42.92}
    assert round(sum(c.annual_fee for c in by[5]) / 10) == 3276


def test_recommend_respects_eligibility_and_contract() -> None:
    cards = _cards()
    p = UserProfileIn(
        age=22, income_range="lt_7k", avoid_annual_fee=True, pays_in_full=True, main_use="historial"
    )
    res = recommend(p, cards)
    assert not res.is_stub
    assert 0 < len(res.items) <= 6
    assert res.excluded_count > 0
    for s in res.items:
        assert s.eligibility in ("cumple", "por_confirmar")
        assert (s.card.monthly_income_min or 0) <= 5000
        assert 0 <= s.score <= 100
    assert res.assumptions
    scores = [s.score for s in res.items]
    assert scores == sorted(scores, reverse=True)


def test_avoid_annual_fee_prioritizes_zero_fee_cards_and_warns() -> None:
    cards = _cards()
    p = UserProfileIn(
        age=21,
        income_range="lt_7k",
        credit_score="none",
        main_use="historial",
        avoid_annual_fee=True,
        payment_habit="sometimes",
    )
    res = recommend(p, cards)
    assert sum((s.card.annual_fee or 0) == 0 for s in res.items[:3]) >= 2
    charged = next(s for s in res.items if (s.card.annual_fee or 0) > 0)
    assert any("anualidad" in w for w in charged.warnings)


def test_high_rate_warning_when_user_finances() -> None:
    p = UserProfileIn(age=40, income_range="15k_30k", credit_score="medium", payment_habit="revolving")
    res = recommend(p, _cards(), top_k=30)
    assert any("financiar sale caro" in w for s in res.items for w in s.warnings)
    assert len(res.profile_fit) == 6


def test_recommend_is_deterministic() -> None:
    cards = _cards()
    p = UserProfileIn(
        age=35, income_range="30k_60k", main_use="viajes", pays_in_full=True, benefits=["Puntos"]
    )
    a = [s.card.id for s in recommend(p, cards).items]
    b = [s.card.id for s in recommend(p, cards).items]
    assert a == b
    res = recommend(p, cards)
    assert res.profile.key in {x.key for x in PROFILES}
    assert res.profile.id == res.items[0].profile.id  # perfil = cluster de la tarjeta Top 1

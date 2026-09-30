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
    assert ids == {p.id for p in PROFILES}


def test_recommend_respects_eligibility_and_contract() -> None:
    cards = _cards()
    p = UserProfileIn(
        age=22, income_range="lt_7k", avoid_annual_fee=True, pays_in_full=True, main_use="historial"
    )
    res = recommend(p, cards)
    assert res.is_stub
    assert 0 < len(res.items) <= 6
    assert res.excluded_count > 0
    for s in res.items:
        assert s.eligibility in ("cumple", "por_confirmar")
        assert (s.card.monthly_income_min or 0) <= 5000
        assert 0 <= s.score <= 100
    assert res.assumptions
    scores = [s.score for s in res.items]
    assert scores == sorted(scores, reverse=True)


def test_avoid_annual_fee_prioritizes_zero_fee_cards() -> None:
    cards = _cards()
    p = UserProfileIn(
        age=27,
        income_range="15k_30k",
        credit_score="medium",
        pays_in_full=True,
        avoid_annual_fee=True,
        benefits=["Meses sin intereses"],
    )
    res = recommend(p, cards)
    top3 = res.items[:3]
    assert all((s.card.annual_fee or 0) == 0 for s in top3)
    assert res.profile.key == "arranque"


def test_recommend_is_deterministic() -> None:
    cards = _cards()
    p = UserProfileIn(
        age=35, income_range="30k_60k", main_use="viajes", pays_in_full=True, benefits=["Puntos"]
    )
    a = [s.card.id for s in recommend(p, cards).items]
    b = [s.card.id for s in recommend(p, cards).items]
    assert a == b
    assert recommend(p, cards).profile.key == "premium"

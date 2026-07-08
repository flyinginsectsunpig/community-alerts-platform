import pytest

from app.models.severity import LABELS, SeverityModel


@pytest.fixture(scope="module")
def model() -> SeverityModel:
    return SeverityModel("test-model")


def test_weapon_reports_always_critical(model: SeverityModel) -> None:
    prediction = model.predict("Man waving a gun outside the pharmacy")
    assert prediction.severity == "CRITICAL"
    assert prediction.risk_score >= 0.85


@pytest.mark.parametrize(
    "text",
    [
        "Someone has been stabbed near the market",
        "Armed robbery in progress at the petrol station",
        "Child abducted by a stranger in a van",
        "House on fire with people inside",
    ],
)
def test_critical_keyword_overrides(model: SeverityModel, text: str) -> None:
    assert model.predict(text).severity == "CRITICAL"


def test_predictions_are_deterministic(model: SeverityModel) -> None:
    text = "Car window smashed overnight and stereo stolen"
    first = model.predict(text)
    second = model.predict(text)
    assert first == second


@pytest.mark.parametrize(
    "text",
    [
        "Loud music playing late into the night",
        "Bike stolen from outside the train station",
        "Two men fighting violently outside the pub",
        "Overgrown hedge blocking the pavement near the school",
    ],
)
def test_outputs_are_valid_labels_and_bounded_scores(model: SeverityModel, text: str) -> None:
    prediction = model.predict(text)
    assert prediction.severity in LABELS
    assert 0.0 <= prediction.risk_score <= 1.0
    assert prediction.model_version == "test-model"


def test_risk_bands_do_not_overlap_across_severities(model: SeverityModel) -> None:
    low = model.predict("Litter left all over the park benches again")
    critical = model.predict("Shots fired near the school playground")
    assert critical.risk_score > low.risk_score


@pytest.mark.parametrize("text", ["", "   ", "\n\t"])
def test_blank_text_is_rejected(model: SeverityModel, text: str) -> None:
    with pytest.raises(ValueError):
        model.predict(text)

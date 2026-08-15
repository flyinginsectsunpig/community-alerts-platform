"""Alert severity classification.

A TF-IDF + logistic-regression pipeline trained at startup on a curated seed
corpus, layered under a hard keyword override: reports mentioning weapons,
fire, or abduction are always CRITICAL regardless of model confidence.

Risk scores are emitted in non-overlapping bands per class so downstream
consumers (map colouring, the .NET escalation rules) can reason about them:

    LOW      0.05 - 0.19
    MEDIUM   0.35 - 0.49
    HIGH     0.60 - 0.74
    CRITICAL 0.85 - 0.99

The model abstains (ABSTAIN, risk None) when the vectoriser recognises nothing
in the text. Without that guard an all-zero feature vector ranks the class
intercepts instead of the text, which made every unrecognised report — keyboard
mash, but equally every non-English one — come back HIGH at a fabricated risk
of 0.636 while true confidence was 0.259, barely above the 0.25 floor for four
classes. The band floors hide that: real confidence 0.25->1.0 compresses into
0.636->0.74, so a guess is indistinguishable from a certainty.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

LABELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")

# Returned when the vectoriser recognises nothing in the text, so the model has
# no evidence to score on. Mirrors the DB default and the Severity union in
# apps/web/src/lib/types.ts.
ABSTAIN = "UNSCORED"

_CRITICAL_PATTERN = re.compile(
    r"\b("
    r"guns?|firearms?|shots?|shooting|shooter|gunfire|"
    r"kni(?:fe|ves)|stab(?:bed|bing)?|machete|"
    r"explosion|explosive|bomb|grenade|"
    r"kidnap(?:ped|ping)?|abduct(?:ed|ion)?|hostage|"
    r"armed|weapon s?|weapons?|"
    r"on fire|house fire|building fire"
    r")\b",
    re.IGNORECASE,
)

_RISK_BANDS: dict[str, tuple[float, float]] = {
    "LOW": (0.05, 0.19),
    "MEDIUM": (0.35, 0.49),
    "HIGH": (0.60, 0.74),
    "CRITICAL": (0.85, 0.99),
}

# (description, severity) seed corpus. Deliberately small and legible: the
# point is a deterministic, dependency-free model; swap in a fine-tuned
# transformer behind the same SeverityModel interface when real data lands.
_SEED_DATA: list[tuple[str, str]] = [
    # LOW
    ("Loud music playing late into the night from a neighbouring flat", "LOW"),
    ("Litter and broken glass left all over the park benches", "LOW"),
    ("Group of teenagers skateboarding through the shopping centre", "LOW"),
    ("Someone keeps letting their dog foul the pavement without cleaning", "LOW"),
    ("Abandoned shopping trolley dumped in the stream near the bridge", "LOW"),
    ("Street light flickering all night on the corner of the high street", "LOW"),
    ("Overgrown hedges blocking the footpath near the school", "LOW"),
    ("Parked car blocking the cycle lane again this morning", "LOW"),
    ("Fly tipping of old furniture behind the supermarket bins", "LOW"),
    ("Noisy party going on past midnight with people in the street", "LOW"),
    ("Graffiti tags appearing on the underpass wall", "LOW"),
    ("Youths hanging around the bus stop being loud after dark", "LOW"),
    # MEDIUM
    ("Car window smashed overnight and glove box gone through", "MEDIUM"),
    ("Someone stole packages from the front porch this afternoon", "MEDIUM"),
    ("Shoplifter ran out of the corner shop with bottles of spirits", "MEDIUM"),
    ("Bike stolen from the rack outside the train station", "MEDIUM"),
    ("Vandals smashed the bus shelter glass on the estate", "MEDIUM"),
    ("Suspicious man trying car door handles along the whole street", "MEDIUM"),
    ("Someone spray painting the school gates and running off", "MEDIUM"),
    ("Pickpocket working the crowd at the street market", "MEDIUM"),
    ("Garden shed broken into and power tools taken", "MEDIUM"),
    ("Catalytic converter cut from a van parked overnight", "MEDIUM"),
    ("People openly dealing drugs in the alley behind the chip shop", "MEDIUM"),
    ("Drunk man harassing customers outside the off licence", "MEDIUM"),
    # HIGH
    ("Two men fighting violently outside the pub, one bleeding badly", "HIGH"),
    ("Burglar seen climbing through a house window while owners away", "HIGH"),
    ("Woman followed home from the station by a stranger shouting threats", "HIGH"),
    ("Gang surrounding and threatening a teenager for his phone", "HIGH"),
    ("Man assaulted and knocked unconscious near the taxi rank", "HIGH"),
    ("Attempted mugging in the underpass, victim shaken and hurt", "HIGH"),
    ("Someone smashed into the pharmacy and is ransacking it right now", "HIGH"),
    ("Aggressive man punching walls and threatening passers by", "HIGH"),
    ("Break in happening now, back door forced at the neighbours house", "HIGH"),
    ("Group violently kicking a man on the ground by the canal", "HIGH"),
    ("Domestic disturbance with screaming and things being thrown", "HIGH"),
    ("Driver deliberately ramming another car in road rage incident", "HIGH"),
    # CRITICAL
    ("Man waving a gun around outside the pharmacy", "CRITICAL"),
    ("Someone has been stabbed near the market entrance, lots of blood", "CRITICAL"),
    ("Shots fired near the school playground, everyone running", "CRITICAL"),
    ("Armed robbery in progress at the petrol station", "CRITICAL"),
    ("House on fire with people possibly still inside", "CRITICAL"),
    ("Man threatening staff with a knife at the checkout", "CRITICAL"),
    ("Child grabbed and pulled into a van by a stranger", "CRITICAL"),
    ("Explosion heard and smoke rising from the industrial estate", "CRITICAL"),
    ("Gunfire exchanged between two cars on the main road", "CRITICAL"),
    ("Hostage situation reported at the bank on the corner", "CRITICAL"),
    ("Machete fight broken out between two groups in the park", "CRITICAL"),
    ("Driver mounted the pavement and hit pedestrians deliberately", "CRITICAL"),
]


@dataclass(frozen=True)
class SeverityPrediction:
    severity: str
    #: None when the model abstained — there is no score, as distinct from a
    #: low one. Callers must not put this on the wire: riskScore is a
    #: non-nullable double in both the Java API and the .NET worker.
    risk_score: float | None
    model_version: str


class SeverityModel:
    def __init__(self, model_version: str) -> None:
        self._model_version = model_version
        self._pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
                ("clf", LogisticRegression(max_iter=1000, C=10.0, random_state=42)),
            ]
        )
        texts = [text for text, _ in _SEED_DATA]
        labels = [label for _, label in _SEED_DATA]
        self._pipeline.fit(texts, labels)

    def predict(self, text: str) -> SeverityPrediction:
        if not text or not text.strip():
            raise ValueError("text must not be empty")
        cleaned = " ".join(text.split())

        # Vectorise once so the abstention check can inspect the same features
        # the classifier scores.
        features = self._pipeline["tfidf"].transform([cleaned])
        classifier = self._pipeline["clf"]
        probabilities = classifier.predict_proba(features)[0]
        classes = list(classifier.classes_)

        # The keyword override is checked first and deliberately outranks
        # abstention: a weapon word must still escalate inside a sentence the
        # vectoriser otherwise knows nothing about.
        if _CRITICAL_PATTERN.search(cleaned):
            severity = "CRITICAL"
            confidence = max(probabilities[classes.index("CRITICAL")], 0.75)
        elif features.nnz == 0:
            return SeverityPrediction(ABSTAIN, None, self._model_version)
        else:
            best = int(probabilities.argmax())
            severity = classes[best]
            confidence = float(probabilities[best])

        low, high = _RISK_BANDS[severity]
        risk_score = round(low + (high - low) * confidence, 4)
        return SeverityPrediction(severity, risk_score, self._model_version)

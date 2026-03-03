# Community Alerts — Python ML Service

FastAPI microservice providing ML-powered analysis for the Community Alerts platform.  
**Python 3.12 · FastAPI · scikit-learn · Uvicorn**

---

## The Five Modules

### 1. NLP Entity Extractor — `POST /api/v1/ml/extract-entities`
Parses freetext incident descriptions into structured fields.

**Why not a transformer?**  
Community reports are short, messy, and domain-specific. A vocabulary-based extractor outperforms general-purpose NER here and runs in ~0.5ms vs ~200ms for a transformer.

**What it extracts:**  
Clothing (colour + garment bigrams), weapons, vehicles (colour + make), SA number plates (regex: `CA 443 GP`), directions, suspect count, height descriptors.

**Example:**
```
Input:  "Two tall men in blue hoodies fled north in a silver Polo, CA 443 GP."
Output: {
  clothing: ["blue hoodie"],
  vehicles: ["Silver Polo"],
  plates:   ["CA 443 GP"],
  directions: ["north"],
  count_suspects: 2,
  height_descriptors: ["tall"],
  auto_tags: ["2 suspects", "Blue Hoodie", "Silver Polo", "CA 443 GP", "Fled north", "Tall"]
}
```

---

### 2. Urgency Classifier — `POST /api/v1/ml/classify-urgency`
**TF-IDF (unigram+bigram) → Logistic Regression**  
Trained on ~60 Cape Town community safety reports.

**Classes:** `LOW | MEDIUM | HIGH | CRITICAL`

**Key design choice:** Incident type acts as a prior. FIRE and CRIME shift probability mass toward higher urgency before text analysis. This prevents a short CRIME report from being misclassified as MEDIUM because it lacks keywords.

---

### 3. Heat Score Predictor — `POST /api/v1/ml/predict-heat`
**Gradient Boosting Regressor** predicting suburb heat score 24 hours ahead.

Trained on 2,000 synthetic Cape Town suburb snapshots with:
- Weekend spike effects (Friday/Saturday nights)
- Night multiplier for crime incidents
- Score momentum (rapidly rising incident counts → higher predictions)
- Recency decay built into training targets

**Extends** the deterministic Java scoring algorithm with learned non-linear patterns.

---

### 4. Pattern Detector — `POST /api/v1/ml/detect-patterns`
**K-Means clustering** on `[latitude, longitude, type, hour, weekday, severity]`.

Auto-selects optimal `k` using the silhouette score.  
Flags clusters with `HIGH` serial risk when: size ≥ 4 and silhouette ≥ 0.45.

**Use case:** 6 robberies in Mitchells Plain over 2 weeks — are they random or one crew?

---

### 5. Risk Forecaster — `POST /api/v1/ml/forecast-risk`
**Gaussian Naive Bayes smoothing** over historical hourly incident counts.

Blends raw normalised frequencies with GNB posteriors to avoid overfitting to single outlier events.

Outputs peak hours (top 3), peak days (top 2), per-hour risk labels, and a plain-English recommendation for residents.

---

## Running Locally

```bash
cd community-alerts-platform/services/ml-api-python
pip install -r requirements.txt

# Run the API
uvicorn app.main:app --reload --port 8001

# Run tests
pytest app/tests/ -v
```

Docs at `http://localhost:8001/docs`

---

## Docker

```bash
docker build -t community-alerts-ml .
docker run -p 8001:8001 community-alerts-ml
```

---

## Integration with Spring Boot

The Java backend calls this service after every new incident:

```
POST /api/v1/ml/extract-entities  → auto-populate Incident.tags
POST /api/v1/ml/classify-urgency  → set Incident.urgency
POST /api/v1/ml/predict-heat      → update Suburb.predictedHeatScore
```

Pattern detection and risk forecasting are triggered on demand from the frontend map view.

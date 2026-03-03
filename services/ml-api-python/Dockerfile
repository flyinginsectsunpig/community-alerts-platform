# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM python:3.12-slim AS build

WORKDIR /install
COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --prefix=/install/deps --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=build /install/deps /usr/local
COPY app ./app

# Download spaCy model (optional — extractor falls back to regex if absent)
RUN python -m spacy download en_core_web_sm --quiet || true

USER appuser

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]

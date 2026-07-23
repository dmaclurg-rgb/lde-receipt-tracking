# Containerizes the matching service (service.py) for deployment to a small
# always-on host (Render/Fly.io/Railway) — the web app's
# MATCHING_SERVICE_URL should point at wherever this ends up running.
#
# Build/run locally to sanity-check before deploying:
#   docker build -t lde-matching-service .
#   docker run -p 8008:8008 lde-matching-service
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

EXPOSE 8008
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8008"]

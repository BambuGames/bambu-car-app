# Image worker for Cloud Run (Frankfurt, M2c) and local runs. The plate model is not in git: run
# scripts/export_plate_onnx.py first so models/ holds plate_rtdetrv2.onnx and plate_preprocess.json.
FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker ./worker
COPY models ./models
CMD ["sh", "-c", "uvicorn worker.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

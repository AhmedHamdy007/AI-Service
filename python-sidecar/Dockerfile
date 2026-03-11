FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and ML libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security (Microsoft best practice)
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Pre-download UniFace models at build time for faster startup
# Use || true to continue if models already exist or on network issues
RUN python -c "from uniface import RetinaFace; RetinaFace()" || true && \
    python -c "from uniface.landmark import Landmark106; Landmark106()" || true

EXPOSE 8001

# Health check (Microsoft best practice)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

# Deployment & Testing Guide

## Overview

This guide covers deploying the AI Microservice using Docker Compose and running tests using Microsoft best practices.

---

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- (Optional) Node.js 18+ for local development

---

## Quick Start with Docker Compose

### Step 1: Clone the Repository

```bash
cd ai-service
```

### Step 2: Create Environment File

```bash
cp node-service/.env.example node-service/.env
```

Update `.env` if needed for your environment (defaults work for local Docker deployment).

### Step 3: Start All Services

```bash
docker compose up --build
```

This will:
1. Build and start the Node.js AI service (port 3001)
2. Build and start the Python sidecar (port 8001)
3. Pull and start Ollama with llama3.2 model (port 11434)
4. Wait for all services to become healthy

### Step 4: Verify Installation

```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/ready | jq .
curl -s http://localhost:8001/health | jq .
```

All should return status: "ok".

---

## Stopping Services

```bash
# Stop all containers
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v
```

---

## Testing

### Local Testing (Node.js)

#### Setup

```bash
cd node-service
npm install
cp .env.example .env  # Optional: adjust for development
```

#### Run Unit Tests

```bash
npm test
```

This runs all tests in `tests/` directory and generates coverage reports.

#### Run Tests in Watch Mode

```bash
npm test:watch
```

For active development with auto-rerun on file changes.

#### Lint Code

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Docker Integration Tests

#### Test Face Analysis Endpoint

```bash
# Single image upload
curl -X POST http://localhost:3001/api/face/analyze \
  -F "file=@/path/to/face.jpg" \
  -F "gender=male" \
  -F "hairType=Wavy" \
  -F "lifestyle=Casual" | jq .

# Expected response:
# {
#   "success": true,
#   "data": {
#     "faceShape": "Oval|Round|Square|Heart|Diamond|Oblong",
#     "confidence": 0.0-0.99,
#     "measurements": {...},
#     "allScores": {...},
#     "recommendations": [...]
#   }
# }
```

#### Test Recommendations Endpoint

```bash
curl -X POST http://localhost:3001/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "faceShape": "Oval",
    "gender": "male",
    "hairType": "Straight",
    "lifestyle": "Professional",
    "limit": 5
  }' | jq .
```

#### Test Chat Endpoint

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What hairstyle suits a round face?",
    "userProfile": {
      "faceShape": "Round",
      "gender": "male"
    }
  }' | jq .
```

#### Test Streaming Chat

```bash
curl -X POST http://localhost:3001/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about taper fades"
  }' \
  --no-buffer
```

---

## Monitoring & Health Checks

### Health Check Endpoints

```bash
# Service health
curl http://localhost:3001/health

# Readiness (dependencies OK)
curl http://localhost:3001/ready

# Face service health
curl http://localhost:3001/api/face/health
```

### Docker Health Status

```bash
# Check all service statuses
docker ps --format "table {{.Names}}\t{{.Status}}"

# View logs for a service
docker logs ai-service
docker logs python-sidecar
docker logs ollama
```

### Structured Logging

The Node.js service outputs structured JSON logs. Example:

```json
{
  "timestamp": "2024-03-11T10:30:45.123Z",
  "level": "INFO",
  "service": "ai-microservice",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Incoming request",
  "method": "POST",
  "path": "/api/face/analyze"
}
```

To view logs in better format:

```bash
docker logs ai-service -f | jq .
```

---

## Troubleshooting

### Service won't start

**Check logs:**
```bash
docker logs ai-service
docker logs python-sidecar
```

**Common issues:**

- **"Port already in use"**: Change ports in `docker-compose.yml` or stop conflicting containers
- **"Python sidecar service is unavailable"**: Wait for python-sidecar to fully start (30-60s first boot)
- **Models not downloading**: Check internet connection; Ollama will retry automatically

### Face analysis not working

```bash
# Check Python sidecar directly
curl http://localhost:8001/health
curl http://localhost:8001/face/shapes

# Check if models are loaded
docker exec python-sidecar python -c "from uniface import RetinaFace; print('✓ RetinaFace loaded')"
```

### Chat not responding

```bash
# Check if Ollama is ready
curl http://localhost:11434/api/tags

# Check if model is Pulled
docker logs ollama | grep "pulling\|loaded"

# Manually pull model if needed
docker exec ollama ollama pull llama3.2
```

---

## Production Deployment

### Configuration

Set environment variables before starting:

```bash
export PORT=3001
export NODE_ENV=production
export LOG_LEVEL=INFO
export PYTHON_SIDECAR_URL=http://python-sidecar:8001
export OLLAMA_HOST=http://ollama:11434
```

### Docker Compose Override

For production, create `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  ai-service:
    restart: always
    environment:
      NODE_ENV: production
      LOG_LEVEL: WARN
    # Add resource limits
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 512M
        reservations:
          cpus: "1"
          memory: 256M

  python-sidecar:
    restart: always
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 2G
        reservations:
          cpus: "1"
          memory: 1G

  ollama:
    restart: always
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 8G
```

Deploy with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Performance Tuning

### First Request Latency

The first face analysis request may take 30-60 seconds because:
- UniFace models are downloaded on first use
- Models are loaded into memory
- GPU warmup (if available)

Subsequent requests: ~2-5 seconds

**Solution:** Pre-warm models during startup:

```bash
curl -X POST http://localhost:3001/api/face/analyze \
  -F "file=@sample.jpg" &  # Fire in background
```

### Ollama Optimization

For better performance, enable GPU acceleration:

```yaml
# docker-compose.yml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires:
- NVIDIA GPU
- nvidia-docker installed
- NVIDIA driver

---

## Monitoring Checklist

- [ ] Services start within 2 minutes
- [ ] Health check endpoints return 200 status
- [ ] First face analysis completes within 60 seconds
- [ ] Subsequent face analyses complete within 5 seconds
- [ ] Chat responses complete within 10 seconds
- [ ] Error responses include request ID
- [ ] No unhandled exceptions in logs
- [ ] Structured JSON logs output correctly
- [ ] Container resource limits are respected

---

## Support

For issues:

1. Check logs: `docker logs <service-name>`
2. Verify connectivity: `docker exec <service> curl http://<other-service>:port/health`
3. Review this troubleshooting section
4. Check service documentation in README.md


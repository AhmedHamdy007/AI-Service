# Gateway + Auth Quickstart

This guide wires the AI stack in this repository to companion `api-gateway` and `auth-service`
services that live in a sibling repo or parent monorepo.

## 1. Start Services

```bash
docker compose up --build
```

Public ports:
- `4000` -> API Gateway
- `4001` -> Auth Service (internal in real deployment; exposed now for local testing)
- `3001` -> AI Service

## 2. Health Checks

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
curl http://localhost:4001/health
```

## 3. Register User (via Gateway)

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Ahmed",
    "email":"ahmed@example.com",
    "password":"password123",
    "role":"owner"
  }'
```

## 4. Login (via Gateway)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"ahmed@example.com",
    "password":"password123"
  }'
```

The response includes:
- `accessToken`
- `refreshToken`
- `user`

## 5. Get Current User (Protected)

```bash
curl http://localhost:4000/api/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 6. Call AI Through Gateway (Protected)

```bash
curl http://localhost:4000/api/ai/face/shapes \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Notes

- This repo only contains the AI stack (`node-service`, `python-sidecar`, `ollama`).
- The gateway and auth services are external companions and must already exist locally.
- In production, expose only the gateway publicly.

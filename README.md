# AI Microservice — Salon Platform

**One microservice in your larger microservice architecture** that handles all AI features: face shape detection, hairstyle recommendations, and conversational chat.

## How It Fits In Your Architecture

```
┌─────────────────────────────────────────────────────┐
│              YOUR MICROSERVICE ECOSYSTEM             │
│                                                     │
│  Booking Service                                    │
│  Salon Service                                      │
│  Payment Service        ──┐                         │
│  User Auth Service        ├──> AI Service :3001     │
│  Payment Service        ──┘  (This Project)         │
│                              (Your Entry Point)     │
└─────────────────────────────────────────────────────┘
```

## Internal Architecture (What's Inside Port 3001)

This single microservice uses three specialized components internally:
- **Node.js/Express** (port 3001) - REST API gateway for other services ✓ PUBLIC
- **Python/FastAPI** (port 8001) - Face detection engine - PRIVATE (internal only)
- **Ollama** (port 11434) - Chat/LLM engine - PRIVATE (internal only)

Only port 3001 is exposed to the outside world. Other microservices don't need to know about Python or Ollama.

```
┌─────────────────────────────────────────────────────┐
│           AI MICROSERVICE (Internal)                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │   Node.js Express API  (port 3001)          │   │
│  │   ↓                                         │   │
│  │   Receives: Image upload, chat, face data   │   │
│  │   Orchestrates: Python & Ollama            │   │
│  │   Returns: JSON to other services          │   │
│  └──┬──────────────────────────────┬──────────┘   │
│     │                              │              │
│     ▼                             ▼               │
│  Python Sidecar         Ollama LLM                │
│  :8001                  :11434                    │
│  (Face detection)       (Chat engine)             │
│                                                  │
│ NOT EXPOSED TO OTHER SERVICES                    │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone / navigate to this directory
cd ai-service

# 2. Start all services (first run pulls llama3.2 — ~2GB)
docker compose up --build

# 3. Wait for ollama-pull to finish downloading the model (~2 min)

# 4. Test it
curl http://localhost:3001/health
```

---

## API Reference

### Face Analysis

#### `POST /api/face/analyze`
Upload a face photo to detect face shape. Optionally pass attributes to also get hairstyle recommendations in one call.

**Request** (`multipart/form-data`):
| Field      | Type   | Required | Description                              |
|------------|--------|----------|------------------------------------------|
| file       | image  | ✅       | Face photo (JPG, PNG, WEBP — max 10MB)   |
| hairType   | string | ❌       | Straight \| Wavy \| Curly \| Coily      |
| gender     | string | ❌       | male \| female                           |
| lifestyle  | string | ❌       | Professional \| Casual \| Trendy         |

**Response**:
```json
{
  "success": true,
  "data": {
    "faceShape": "Oval",
    "confidence": 0.82,
    "measurements": {
      "jaw_width": 180.5,
      "cheek_width": 195.2,
      "forehead_width": 188.0,
      "face_height": 280.3,
      "height_width_ratio": 1.44
    },
    "recommendations": [ ... ] // if attributes provided
  }
}
```

#### `GET /api/face/shapes`
Returns all 6 supported face shapes with descriptions.

---

### Hairstyle Recommendations

#### `POST /api/recommendations`
Get ranked hairstyle suggestions based on user attributes.

**Request** (`application/json`):
```json
{
  "faceShape":  "Round",
  "hairType":   "Curly",
  "gender":     "male",
  "lifestyle":  "Casual",
  "limit":      5
}
```

**Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "curly-undercut",
      "name": "Curly Undercut",
      "matchScore": 100,
      "matchPercent": 100,
      "description": "Natural curls on top with shaved sides.",
      "suitableFaceShapes": ["Round", "Oval", "Heart"],
      "hairTypes": ["Curly", "Coily"],
      "tags": ["curly", "natural", "modern"]
    }
  ]
}
```

#### `GET /api/recommendations/hairstyles`
List all hairstyles. Optional query params: `gender`, `faceShape`, `hairType`.

#### `GET /api/recommendations/hairstyles/:id`
Get a single hairstyle by ID.

---

### AI Chat Assistant

#### `POST /api/chat`
Send a message to StyleBot (powered by Ollama/llama3.2).

**Request**:
```json
{
  "message": "What hairstyle suits a round face?",
  "history": [
    { "role": "user",      "content": "Hi!" },
    { "role": "assistant", "content": "Hello! How can I help?" }
  ],
  "userProfile": {
    "faceShape":  "Round",
    "hairType":   "Wavy",
    "gender":     "female",
    "lifestyle":  "Casual"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "role": "assistant",
    "content": "For a round face, styles that add height at the crown work best..."
  }
}
```

#### `POST /api/chat/stream`
Same as above but streams via **Server-Sent Events**.

Each SSE event:
```
data: {"chunk": "For a round"}
data: {"chunk": " face, styles..."}
data: {"done": true}
```

#### `GET /api/chat/examples`
Returns example questions for the UI.

---

## Development (without Docker)

### Node.js service
```bash
cd node-service
cp .env.example .env
npm install
npm run dev
```

### Python sidecar
```bash
cd python-sidecar
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Ollama
```bash
# Install from https://ollama.com
ollama serve
ollama pull llama3.2
```

---

## Face Shape Classification

The classification is done by `python-sidecar/app/services/face_shape.py`.

**Your FYP contribution** — the geometry-based algorithm measures:
- `jaw_width` — distance between jaw landmarks 0 and 32
- `cheek_width` — distance between cheek landmarks 5 and 27
- `forehead_width` — outer brow landmarks 33 and 52
- `face_height` — average brow-to-chin distance
- `height_width_ratio` — face height / cheek width

These measurements are scored against shape profiles using a custom scoring function. **This algorithm is your original contribution** — UniFace only provides the raw 106 landmark coordinates.

---

## Extending the Hairstyle Database

Edit `node-service/src/services/hairstyleKnowledge.js` to add more styles:

```js
{
  id: "your-style-id",
  name: "Style Name",
  gender: ["male"],                          // male | female | both
  suitableFaceShapes: ["Oval", "Round"],
  hairTypes: ["Straight", "Wavy"],
  lifestyles: ["Casual", "Professional"],
  description: "Short description.",
  tags: ["short", "modern"],
}
```

================================================================================
                        AI MICROSERVICE ARCHITECTURE
                    How It Fits Into Your Microservice System
================================================================================

OVERVIEW
========

The AI Service is ONE microservice in your larger system.

From the perspective of other microservices (Booking, Salon, Payment, etc):
  • AI Service is accessed via a single REST API endpoint: port 3001
  • They don't care what technology is inside
  • They don't need to know about Python or Ollama
  • They just send HTTP requests and get JSON responses back


YOUR SYSTEM ARCHITECTURE
========================

                   ┌─────────────────────────────────┐
                   │   MICROSERVICE ECOSYSTEM        │
                   │                                 │
                   │  ┌──────────────────────────┐   │
                   │  │  Booking Service         │   │
                   │  │  (e.g., Java, Spring)    │   │
                   │  └──────────────────────────┘   │
                   │                                 │
                   │  ┌──────────────────────────┐   │
                   │  │  Salon Data Service      │   │
                   │  │  (e.g., Go)              │   │
                   │  └──────────────────────────┘   │
                   │                                 │
                   │  ┌──────────────────────────┐   │
                   │  │  AI Service              │   │
                   │  │  (Node.js) :3001 ◄──────┼─ you are here
                   │  │  (This Project)          │   │
                   │  └──────────────────────────┘   │
                   │                                 │
                   │  ┌──────────────────────────┐   │
                   │  │  Payment Service         │   │
                   │  │  (e.g., Python + DB)     │   │
                   │  └──────────────────────────┘   │
                   │                                 │
                   └─────────────────────────────────┘
                               ▲
                               │ Inter-Service
                               │ Communication
                               │ (REST/gRPC)
                               │
                   Could also have:
                   - Service Discovery (Consul, Eureka)
                   - API Gateway (Kong, NGINX)
                   - Message Queue (RabbitMQ, Kafka)
                   - Shared Database (for read-only data)


AI SERVICE INTERNAL STRUCTURE
==============================

Inside the AI Microservice, there are THREE components:

┌───────────────────────────────────────────────────────────┐
│             AI MICROSERVICE CONTAINER CLUSTER             │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │         NODE.JS EXPRESS API GATEWAY                 │ │
│  │         (port 3001) - PUBLIC FACING                │ │
│  │                                                     │ │
│  │  Responsibilities:                                  │ │
│  │  • Receive HTTP requests from other microservices  │ │
│  │  • Route requests to handlers                       │ │
│  │  • Validate input (GIGO - Garbage In, Garbage Out) │ │
│  │  • Call Python service for face analysis           │ │
│  │  • Call Ollama for chat generation                 │ │
│  │  • Format responses as JSON                        │ │
│  │  • Log all activity                                │ │
│  │  • Handle errors gracefully                        │ │
│  └──┬──────────────────────────┬──────────────────────┘ │
│     │                          │                        │
│     ▼                          ▼                        │
│  ┌───────────────────┐  ┌─────────────────────┐         │
│  │  PYTHON SIDECAR   │  │   OLLAMA LLM        │         │
│  │  (port 8001)      │  │   (port 11434)      │         │
│  │  PRIVATE - ONLY   │  │   PRIVATE - ONLY    │         │
│  │  NODE.JS CALLS IT │  │   NODE.JS CALLS IT  │         │
│  │                   │  │                     │         │
│  │  Handles:        │  │   Handles:          │         │
│  │  • Face detection │  │   • Chat messages   │         │
│  │  • Shape calc     │  │   • Text generation │         │
│  │  • Measurements   │  │   • Llama3.2 model  │         │
│  └───────────────────┘  └─────────────────────┘         │
│                                                           │
│  Docker Network: ai-net (internal, isolated)             │
│  These services are NOT accessible from outside          │
│                                                           │
└───────────────────────────────────────────────────────────┘
          ▲
          │ Only port 3001 exposed
          │
    Other Microservices communicate here


COMMUNICATION EXAMPLES
======================

BOOKING SERVICE → AI SERVICE
───────────────────────────

Booking Service (running on different server):

  POST http://ai-service:3001/api/recommendations
  {
    "faceShape": "Round",
    "gender": "female",
    "hairType": "Wavy",
    "limit": 5
  }

AI Service (Node.js at port 3001):
  1. Receives request
  2. Validates input (is faceShape valid? Is gender valid?)
  3. Calculates hairstyle matches
  4. Returns JSON response

  {
    "success": true,
    "data": [
      { "id": "bob", "name": "Bob", "matchScore": 95 },
      { "id": "shag", "name": "Shag", "matchScore": 87 },
      ...
    ]
  }

Booking Service receives response and continues its process.
Booking Service has NO KNOWLEDGE of Python or Ollama.


WHEN FACE ANALYSIS NEEDED
─────────────────────────

Booking Service request (example):

  POST http://ai-service:3001/api/face/analyze
  multipart/form-data:
    - file: [image.jpg]
    - gender: "male"
    - hairType: "Wavy"

Inside AI Service:
  1. Node.js receives image at port 3001
  2. Node.js validates it's an image
  3. Node.js calls Python sidecar internally:
     POST http://python-sidecar:8001/face/analyze
     (sends image buffer)
  4. Python processes with UniFace model
  5. Python returns face shape + measurements
  6. Node.js formats response with recommendations
  7. Node.js sends JSON back to Booking Service

Key point: Booking Service doesn't know about Python
          It just uses the AI Service API at port 3001


WHEN CHAT NEEDED
────────────────

Booking Service request:

  POST http://ai-service:3001/api/chat
  {
    "message": "What hairstyle for a round face?",
    "userProfile": {
      "faceShape": "Round",
      "gender": "female"
    }
  }

Inside AI Service:
  1. Node.js receives request
  2. Node.js builds context message
  3. Node.js calls Ollama internally:
     POST http://ollama:11434/api/generate
     (sends prompt with context)
  4. Ollama (llama3.2 model) generates response
  5. Ollama streams tokens back
  6. Node.js collects response
  7. Node.js sends JSON back to Booking Service

Key point: Booking Service doesn't know about Ollama
          It just uses the AI Service API at port 3001


TECHNOLOGY CHOICE RATIONALE
============================

WHY NODE.JS FOR API GATEWAY?
  ✓ Fast for handling requests
  ✓ Non-blocking I/O (handle many concurrent requests)
  ✓ Excellent at coordinating other services
  ✓ Easy to add middleware (logging, validation)
  ✓ JSON is native (no conversion overhead)

WHY PYTHON FOR FACE DETECTION?
  ✓ ML ecosystem is best in Python
  ✓ NumPy, OpenCV, scikit-learn all Python
  ✓ Fast inference with NumPy
  ✓ UniFace library is Python
  ✓ Easy to package as separate service

WHY OLLAMA FOR CHAT?
  ✓ Runs LLM locally (no external API dependency)
  ✓ Fast inference with proper optimization
  ✓ Private (no data leaves your system)
  ✓ Lightweight deployment
  ✓ Open source, customizable


DEPLOYMENT ARCHITECTURE
=======================

LOCAL DEVELOPMENT (what you're doing now):
  docker-compose up
  ├─ Node.js container (localhost:3001)
  ├─ Python container (localhost:8001)
  └─ Ollama container (localhost:11434)

PRODUCTION DOCKER SWARM:
  swarm service create --port 3001:3001 ai-service
  ├─ Multiple Node.js replicas (behind load balancer)
  ├─ Multiple Python replicas (shared by Node.js)
  └─ Ollama service (shared, model cached)

KUBERNETES DEPLOYMENT:
  Deployment: ai-service
  ├─ Pod Template:
  │  ├─ Node.js container
  │  ├─ Python container (sidecar)
  │  └─ Ollama init container (download model)
  ├─ Service: Exposes port 3001
  └─ HPA: Auto-scale based on CPU load


KEY PRINCIPLES
==============

1. ENCAPSULATION
   • Internal implementation details hidden
   • Other services don't care how it works
   • Only care about REST API contract
   • Can change Python to Java without affecting others

2. LOOSE COUPLING
   • Services communicate via HTTP only
   • No shared databases
   • No direct function calls
   • Easy to deploy independently

3. HIGH COHESION
   • All AI features in one place
   • Face detection, recommendations, chat together
   • Related functionality grouped

4. SINGLE RESPONSIBILITY (Per Service)
   • Booking service: Handle reservations
   • AI service: Handle AI features
   • Salon service: Handle salon data
   • Each has clear purpose

5. NETWORK ISOLATION
   • Docker network for internal communication
   • Python/Ollama not exposed to internet
   • Only Node.js API gateway exposed
   • Security through isolation


SCALING CONSIDERATIONS
======================

CURRENT SETUP:
  • 1 Node.js instance
  • 1 Python instance
  • 1 Ollama instance
  • Good for: Development, small teams, internal use

HORIZONTAL SCALING (Add more instances):
  • Multiple Node.js replicas behind load balancer
  • Python becomes bottleneck (face detection is CPU intensive)
  • Solution: Multiple Python instances behind their own load balancer

OPTIMIZATION FOR SCALE:
  • GPU for Ollama (10x faster LLM inference)
  • GPU for Python (5x faster face detection)
  • Message queue for async face analysis jobs
  • Cache face results by image hash
  • Redis cache for recommendations

EVENTUAL GOAL (Service Mesh):
  Kubernetes + Istio/Linkerd
  ├─ Service mesh handles:
  │  ├─ Load balancing
  │  ├─ Circuit breaking
  │  ├─ Retries
  │  ├─ Monitoring
  │  └─ Security policies
  ├─ Scale each component independently
  └─ Deploy updates with zero downtime


INTER-SERVICE COMMUNICATION PATTERNS
====================================

SYNCHRONOUS (Current Implementation):
  Booking Service → AI Service → response → process
  ✓ Simple, easy to debug
  ✓ Good for real-time responses
  ✗ Slower (wait for response)
  ✗ All services must be running

ASYNCHRONOUS (For Future):
  Booking Service → Message Queue ← AI Service
  ✓ Decoupled, services can be down
  ✓ Fast response to user
  ✓ Process in background
  ✗ More complex
  ✗ Harder to debug

You're currently using SYNCHRONOUS pattern.
This is fine for your scale - simple and efficient.


MONITORING ACROSS SERVICES
===========================

Current: Logs in containers
  docker logs ai-service | jq .

Future: Centralized log aggregation
  ELK Stack (Elasticsearch, Logstash, Kibana)
  ├─ Collect logs from all services
  ├─ Searchable: find request by ID across all services
  ├─ Visualizations: See system health
  └─ Alerts: Notify on errors

Future: Distributed tracing
  Jaeger, Zipkin, or NewRelic
  ├─ Follow request through all services
  ├─ See timing of each hop
  ├─ Find bottlenecks
  └─ Correlation IDs already in place


CONCLUSION
==========

You have:
  ✓ ONE AI microservice at port 3001
  ✓ Other microservices communicate via REST only
  ✓ Internal components (Python, Ollama) hidden
  ✓ Easy to scale, deploy, and maintain
  ✓ Clear separation of concerns
  ✓ Ready for microservice ecosystem

Next step: Deploy other microservices
  • Booking service (communicate with AI at :3001)
  • Salon service (use recommendations API)
  • Payment service (independent)
  • Auth service (validate requests to all services)

They'll all work together via REST APIs!

================================================================================

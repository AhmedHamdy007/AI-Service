================================================================================
                   AI MICROSERVICE - COMPLETE EXPLANATION
                 A Comprehensive Guide to Your System Architecture
================================================================================

TABLE OF CONTENTS
================================================================================
1. System Overview & Architecture
2. Technologies Used & Why
3. Service Behavior & How It Works
4. Critical Components Explained
5. Best Practices Implemented
6. Important Warnings & Things to Avoid
7. Troubleshooting Common Issues
8. Performance Considerations
9. Security Implementation

================================================================================
1. SYSTEM OVERVIEW & ARCHITECTURE
================================================================================

YOUR AI MICROSERVICE - ONE SERVICE IN YOUR LARGER ARCHITECTURE:

┌──────────────────────────────────────────────────────────────────────────┐
│                        YOUR MICROSERVICE ARCHITECTURE                     │
│                                                                            │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────┐                 │
│  │   BOOKING   │  │   AI SERVICE     │  │  SALON DATA  │                 │
│  │ MICROSERVICE│  │  (THIS PROJECT)  │  │ MICROSERVICE │                 │
│  └─────────────┘  └────────┬─────────┘  └──────────────┘                 │
│        ↑                    │                  ↑                          │
│        └────────────────────┼──────────────────┘                          │
│                             │                                             │
│                        REST API Port 3001                                 │
│                   (Single entry point)                                    │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘

AI SERVICE INTERNAL ARCHITECTURE (What's inside port 3001):

┌────────────────────────────────────────────────────────────────────────┐
│         AI MICROSERVICE - Internal Components                           │
│         (Other services only see Port 3001)                             │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                    NODE.JS EXPRESS API GATEWAY :3001                      │
│                  (PUBLIC - Entry point for all requests)                 │
│                                                                            │
│  ├─ Receives requests from other microservices                            │
│  ├─ Validates all user input                                             │
│  ├─ Routes requests to appropriate handlers                              │
│  ├─ Orchestrates internal services (Python, Ollama)                      │
│  ├─ Logs all activity for monitoring                                     │
│  └─ Returns standardized JSON responses                                  │
└────┬─────────────────────────────────┬────────────────────────────────────┘
     │                                 │
     │ Internal HTTP Calls             │ Internal HTTP Calls
     │ (Docker network - private)      │ (Docker network - private)
     ▼                                ▼
┌────────────────────────────────┐  ┌─────────────────────────────┐
│  PYTHON SIDECAR :8001          │  │   OLLAMA LLM :11434         │
│  (PRIVATE - Not exposed)       │  │   (PRIVATE - Not exposed)   │
│                                │  │                             │
│  Face Detection & Analysis:    │  │  Chat & Text Generation:    │
│  ├─ Receives image from Node   │  │  ├─ Receives prompts        │
│  ├─ Uses UniFace ML model      │  │  ├─ Generates responses     │
│  ├─ Measures facial features   │  │  ├─ Uses llama3.2 model     │
│  ├─ Calculates face shape      │  │  └─ Streams text output     │
│  └─ Returns metrics            │  │                             │
└────────────────────────────────┘  └─────────────────────────────┘

KEY POINT: ONLY PORT 3001 IS EXPOSED
────────────────────────────────────

From other microservices' perspective:
  ✓ AI Service is accessed via: http://ai-service:3001 (or localhost:3001)
  ✓ They have NO IDEA about Python sidecar or Ollama
  ✓ They don't care about internal implementation
  ✓ Internal services (Python, Ollama) are hidden on private Docker network

Ports NOT exposed:
  ✗ Port 8001 (Python sidecar) - Internal only
  ✗ Port 11434 (Ollama) - Internal only
  ✗ Direct access will fail (by design)


WHY THIS INTERNAL ARCHITECTURE?
────────────────────────────────
- Node.js is great for REST APIs and request handling
- Python excels at machine learning (face detection)
- Ollama specializes in LLM inference
- Services are loosely coupled - can be updated independently
- Easy to replace: Change Python service, Node.js doesn't care
- Easy to scale: Run 2 Python services with load balancer
- Fault isolation: Python crashes don't crash Node.js


TYPICAL FLOW (from external microservice perspective)
──────────────────────────────────────────────────────

Booking Service wants to suggest hairstyles:
  
  1. Booking Service sends REST request to AI Service:
     POST http://ai-service:3001/api/recommendations
     {
       "faceShape": "Oval",
       "gender": "female",
       "hairType": "Curly"
     }
  
  2. Inside AI Service, Node.js:
     ├─ Receives request (port 3001)
     ├─ Validates input
     ├─ Orchestrates recommendation calculation (internal)
     └─ Returns JSON response
  
  3. Booking Service receives response:
     {
       "success": true,
       "data": [
         { id: "bob", name: "Classic Bob", matchScore: 95 },
         { id: "shag", name: "Modern Shag", matchScore: 87 },
         ...
       ]
     }
  
  4. Booking Service continues its process
     (AI Service is just another REST API to it)


FROM YOUR MICROSERVICE ARCHITECTURE VIEW
─────────────────────────────────────────

Your Project = Multiple Microservices

  Booking MS ──┐
               ├──> Load Balancer ──> API Gateway
  Salon MS ────┤
               ├──> AI Service (this project) :3001
  Payment MS ──┘
               └──> Other Services...

Each microservice is independent:
  • Different teams can own each service
  • Different tech stacks (Java, Python, Go, etc)
  • Services communicate via REST/gRPC
  • Services can be deployed independently
  • Services can scale independently


================================================================================



================================================================================
2. TECHNOLOGIES USED & WHY
================================================================================

IMPORTANT CLARIFICATION:
All technologies below are COMPONENTS OF ONE MICROSERVICE (AI Service).
- Node.js/Express is the public API gateway (port 3001)
- Python/FastAPI is an internal component (port 8001 - not exposed)
- Ollama is an internal component (port 11434 - not exposed)

Your other microservices (Booking, Salon, Payment, etc) interact with
the AI Service only through port 3001. They don't see or interact with
Python sidecar or Ollama directly.

================================================================================

2.1 NODE.JS & EXPRESS.JS (Main API Gateway)
─────────────────────────────────────────

WHY Node.js?
  • Non-blocking I/O (can handle many requests simultaneously)
  • JavaScript - same language for backend (easy for teams)
  • Huge ecosystem of packages (npm)
  • Very fast for API servers
  • Built for scalability
  • Perfect for orchestrating other services

WHY Express.js?
  • Simple, lightweight web framework
  • Middleware system (easy to add functionality)
  • Great error handling
  • Industry standard for Node.js APIs
  • Minimal overhead
  • Excellent for microservice API gateways

EXPRESS MIDDLEWARE (The Request Pipeline):
  1. cors() - Allow requests from other microservices
  2. express.json() - Parse JSON request bodies
  3. requestLoggingMiddleware - Track every request with unique ID
  4. route handlers - Do the actual work
  5. errorHandler - Catch any errors and respond properly

Example flow:
  Client sends: POST /api/face/analyze with image
     ↓
  cors checks if request is allowed
     ↓
  express.json validates it's JSON/form-data
     ↓
  requestLoggingMiddleware generates unique request ID (like a receipt number)
     ↓
  Face route handler validates input, calls Python sidecar
     ↓
  Response sent back with request ID attached


2.2 AXIOS (HTTP CLIENT LIBRARY)
────────────────────────────────

WHAT IS IT?
  A library for making HTTP requests from Node.js to other services

WHY WE USE IT:
  • Simple, clean syntax
  • Handles timeouts automatically
  • Automatically converts JSON
  • Error handling built-in
  • Works in Node.js and browsers

EXAMPLE:
  const response = await axios.post('http://python-sidecar:8001/face/analyze', data, {
    timeout: 15000  // Wait maximum 15 seconds
  });

WHY TIMEOUT?
  If Python sidecar is slow or down, we don't wait forever (which hangs your app)


2.3 MULTER (FILE UPLOAD HANDLER)
─────────────────────────────────

WHAT IS IT?
  Middleware for handling file uploads (like images)

HOW IT WORKS:
  Client sends: multipart/form-data with image file
     ↓
  Multer catches it
     ↓
  Validates file type (must be image)
     ↓
  Validates file size (max 10MB)
     ↓
  Stores in memory (req.file.buffer)
     ↓
  Pass to route handler

WHY IMPORTANT:
  • Files are dangerous - could contain malware
  • Limits prevent disk DoS attacks
  • Memory storage is fast (no disk I/O)

CONFIG:
  fileSize: 10MB - Reject files larger than this
  fileFilter: Checks MIME type (image/jpeg, image/png, etc)


2.4 DOTENV (.env FILES)
─────────────────────────

WHAT IS IT?
  Loads environment variables from a .env file into process.env

WHY WE USE IT:
  • Different configs for dev vs production
  • No secrets in code (git safety)
  • Easy to change without code edits
  • Docker containers can override with environment variables

EXAMPLE:
  .env file:
    PORT=3001
    NODE_ENV=production
    PYTHON_SIDECAR_URL=http://python-sidecar:8001

  In code:
    const port = process.env.PORT  // Gets value from .env


2.5 PYTHON & FASTAPI (Sidecar Service)
────────────────────────────────────────

WHAT IS FASTAPI?
  Modern Python web framework, similar to Express but for Python

WHY PYTHON FOR FACE DETECTION?
  • Machine learning libraries are better in Python
  • NumPy, OpenCV, scikit-learn all Python
  • Massive ML community

WHAT DOES IT DO:
  • Receives image from Node.js
  • Uses UniFace (face detection library)
  • Returns face shape and measurements


2.6 UNIFACE (FACE DETECTION MODEL)
──────────────────────────────────

WHAT IS IT?
  Pre-trained machine learning model for face detection and landmarks

HOW IT WORKS:
  Input: Image with a face
     ↓
  RetinaFace detects the face location
     ↓
  Landmark106 finds 106 points on the face
     ↓
  Our algorithm measures the points
     ↓
  Output: Face shape + measurements

LANDMARKS EXAMPLE:
  Point 0 = Left edge of jaw
  Point 16 = Chin center
  Point 32 = Right edge of jaw
  Point 68-83 = Eyes
  And 100 more...

WHY THIS MATTERS:
  We use these measurements to calculate:
    jaw_width = distance from point 0 to point 32
    cheek_width = distance from point 3 to point 29
    forehead_width = distance from point 33 to point 43
    face_height = distance from brow to chin


2.7 OLLAMA (LOCAL LLM SERVER)
──────────────────────────────

WHAT IS IT?
  A tool to run large language models (like ChatGPT) locally

WHY OLLAMA INSTEAD OF API?
  ✓ Private - no data sent to external servers
  ✓ Free - no API charges
  ✓ Offline capable - works without internet
  ✓ Fast - no network latency
  ✗ Slower than cloud (GPU needed for speed)
  ✗ Model runs on your hardware

LLAMA3.2 MODEL:
  • Open source language model
  • 8B parameters (not as big as ChatGPT but good)
  • Can generate text, answer questions
  • Runs entirely on your machine


2.8 DOCKER & DOCKER COMPOSE
──────────────────────────────

WHAT IS DOCKER?
  Containers = lightweight virtual machines with everything needed

WHY DOCKER?
  • "Works on my machine" → Works everywhere
  • Easy to run without installing software
  • Services don't interfere with each other
  • Easy to remove (no leftover files)

DOCKER COMPOSE:
  • Orchestrates multiple containers
  • Manages networking between them
  • Handles volumes (persistent storage)
  • Automatic restart if service crashes

THREE CONTAINERS:
  1. ai-service (Node.js)
  2. python-sidecar (Python face detection)
  3. ollama (LLM server)

They're isolated but communicate via HTTP


================================================================================
3. SERVICE BEHAVIOR & HOW IT WORKS
================================================================================

3.1 REQUEST LIFECYCLE
─────────────────────

EXAMPLE: Client uploads face image

┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: REQUEST ARRIVES                                          │
│  Client sends: POST /api/face/analyze with image file            │
│  Request ID generated: e.g., "550e8400-e29b-41d4-a716-..."      │
│  Logged: { timestamp, request_id, method, path, ip }            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: VALIDATION                                               │
│  Check: Is file an image?                                       │
│  Check: Is file < 10MB?                                         │
│  Check: Is content-type correct?                                │
│  If fails: Return 400 error with request_id                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: CALL PYTHON SIDECAR                                      │
│  axios.post('http://python-sidecar:8001/face/analyze', buffer)  │
│  Timeout: 15 seconds (model inference takes time)               │
│  Logged: request to sidecar, duration                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: PROCESS RESPONSE                                         │
│  Python returns: { face_shape, confidence, measurements }       │
│  Extract: face_shape="Oval", confidence=0.95                    │
│  Logged: result summary                                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: OPTIONAL RECOMMENDATIONS                                 │
│  If hairType/gender/lifestyle provided:                         │
│    Calculate matching hairstyles                                │
│    Score by: face shape, hair type, gender, lifestyle          │
│  Logged: recommendations count                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: RESPONSE SENT                                            │
│  { success: true, data: {...}, request_id: "550e8400..." }      │
│  Status: 200 OK                                                 │
│  Logged: response sent, total duration                          │
└─────────────────────────────────────────────────────────────────┘


3.2 ERROR HANDLING FLOW
───────────────────────

When something goes wrong:

IF VALIDATION FAILS (bad input):
  Status: 400 Bad Request
  Response: { success: false, error: "...", field: "...", request_id }
  
  Example:
    Input: file is .txt not image
    Error: "File must be an image"
    Status: 400

IF PYTHON SIDECAR ERRORS:
  Status: 422 Unprocessable Entity (or whatever sidecar returned)
  Response: { success: false, error: "...", service: "python-sidecar" }
  
  Example:
    Python sidecar says "No face detected"
    Status: 422
    Error: "No face detected in the image"

IF PYTHON SIDECAR IS DOWN:
  Status: 503 Service Unavailable
  Response: { success: false, error: "Python sidecar service is unavailable" }
  
  Why happens:
    axios.post tries to connect → connection refused → caught by error handler

IF REQUEST TIMES OUT:
  Status: 504 Gateway Timeout
  Response: { success: false, error: "Request timeout", hint: "Operation took too long" }
  
  Why happens:
    Face analysis takes > 15 seconds → axios timeout fires

IF FILE TOO LARGE:
  Status: 400 Bad Request
  Response: { success: false, error: "File too large (max 10MB)", field: "file" }

IF UNEXPECTED ERROR:
  Status: 500 Internal Server Error
  Response: {
    success: false,
    error: "Internal server error",
    message: "...",
    request_id: "..."
  }


3.3 TIMING EXPECTATIONS
────────────────────────

FIRST REQUEST EVER:
  ├─ Python sidecar models downloading: ~30-60s (first time only!)
  ├─ Models loading into memory: ~10s
  ├─ Actual face detection: ~5s
  └─ Total: 45-75 seconds

SUBSEQUENT REQUESTS:
  ├─ Models already in memory: 0s
  ├─ Face detection: ~2-5s
  └─ Total: 2-5 seconds

CHAT REQUESTS:
  ├─ Token generation: ~5-10s (depends on message length)
  └─ Streaming sends tokens as they arrive

WHY SLOW?
  Machine learning inference takes time. GPU helps a lot.
  First request is importing 100MB+ models - expected behavior.


3.4 LOGGING BEHAVIOR
────────────────────

EVERY REQUEST IS LOGGED:

Incoming request:
  {
    "timestamp": "2024-03-11T10:30:45.123Z",
    "level": "INFO",
    "service": "ai-microservice",
    "message": "Incoming request",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "method": "POST",
    "path": "/api/face/analyze",
    "ip": "127.0.0.1"
  }

Processing:
  {
    "timestamp": "2024-03-11T10:30:50.500Z",
    "level": "DEBUG",
    "service": "ai-microservice",
    "message": "Face analysis completed",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "faceShape": "Oval",
    "confidence": 0.95
  }

Response:
  {
    "timestamp": "2024-03-11T10:30:51.000Z",
    "level": "INFO",
    "service": "ai-microservice",
    "message": "Request completed",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "method": "POST",
    "path": "/api/face/analyze",
    "status": 200,
    "duration_ms": 5875
  }

WHY LOGGING?
  • Debugging: Find out when things broke
  • Monitoring: Track performance
  • Tracing: follow a request through the system
  • Compliance: audit trail of what happened


================================================================================
4. CRITICAL COMPONENTS EXPLAINED
================================================================================

4.1 STRUCTURED LOGGING (logger.js)
──────────────────────────────────

WHAT IT DOES:
  Outputs logs as JSON for easy parsing

WHY JSON NOT PLAIN TEXT?
  ✓ Can be parsed by logs systems (Kibana, Datadog, CloudWatch)
  ✓ Can filter by field (all ERROR level, all for request_id X)
  ✓ Can aggregate and analyze
  ✓ Can send to external systems

KEY FEATURES:
  • Request ID: Each request gets unique ID (like a receipt)
  • Level: DEBUG, INFO, WARN, ERROR
  • Context: { request_id, method, path, duration_ms }

HOW TO USE:
  req.logger.info("Something happened", {
    faceShape: "Oval",
    confidence: 0.95
  });

OUTPUTS:
  {
    "timestamp": "2024-03-11T10:30:45.123Z",
    "level": "INFO",
    "service": "ai-microservice",
    "message": "Something happened",
    "faceShape": "Oval",
    "confidence": 0.95
  }

WHEN TO LOG:
  DEBUG: Detailed info for development
  INFO: Important status (request started, completed)
  WARN: Unusual but recoverable (timeout, slow response)
  ERROR: Things are broken (validation failed, service down)


4.2 INPUT VALIDATION (validation.js)
────────────────────────────────────

WHAT IT DOES:
  Checks that user input is valid BEFORE processing

WHY IMPORTANT:
  ✗ Bad input crashes your service
  ✗ Invalid data causes wrong results
  ✗ Attackers exploit missing validation
  ✓ We reject bad input immediately

VALIDATION RULES:

Face Shape:
  ✓ Must be: "Oval", "Round", "Square", "Heart", "Diamond", "Oblong"
  ✗ Rejects: "InvalidShape", "", null, undefined
  Status if fail: 400

Hair Type:
  ✓ Must be: "Straight", "Wavy", "Curly", "Coily"
  ✓ Optional (can be null)
  ✗ Rejects: "InvalidType"
  Status if fail: 400

Gender:
  ✓ Must be: "male", "female" (case-insensitive)
  ✓ Optional (can be null)
  ✗ Rejects: "other", "unknown"
  Status if fail: 400

Lifestyle:
  ✓ Must be: "Professional", "Casual", "Trendy"
  ✓ Optional (can be null)
  ✗ Rejects: "random"
  Status if fail: 400

Chat Message:
  ✓ Must be non-empty string
  ✓ Max 5000 characters
  ✗ Rejects: "", "   ", messages > 5000 chars
  Status if fail: 400

Image File:
  ✓ Must be: image/jpeg, image/png, image/webp
  ✓ Max 10MB
  ✗ Rejects: .txt files, files > 10MB
  Status if fail: 400

HOW IT WORKS:
  Each validator throws ValidationError if fails

  try {
    const shape = validateFaceShape(req.body.faceShape);  // Throws if bad
    const gender = validateGender(req.body.gender);       // Returns null if not provided
  } catch (err) {
    // Error handler catches and responds with 400
  }


4.3 ERROR HANDLER (errorHandler.js)
───────────────────────────────────

WHAT IT DOES:
  Central error handler for ALL errors in the application

WHY CENTRAL ERROR HANDLER?
  ✓ Consistent error format everywhere
  ✓ Logs all errors
  ✓ Don't miss errors
  ✓ Users get helpful messages

ERROR TYPES IT HANDLES:

1. ValidationError (400)
   From: Invalid input validation
   Response: { success: false, error: "...", field: "..." }

2. Axios Response Error (502 or whatever status)
   From: Python sidecar returns error
   Response: { success: false, error: "...", service: "python-sidecar" }

3. Connection Error (503)
   From: Python sidecar is down (ECONNREFUSED)
   Response: { success: false, error: "...service is unavailable" }

4. Timeout Error (504)
   From: Request takes too long (ECONNABORTED)
   Response: { success: false, error: "Request timeout" }

5. Multer File Error (400)
   From: File too large, wrong field count
   Response: { success: false, error: "File too large" }

6. Generic Error (500)
   From: Anything else unexpected
   Response: { success: false, error: "Internal server error" }

EVERY ERROR INCLUDES:
  - request_id: For tracing
  - error message: What went wrong
  - status code: HTTP status
  - logged: In JSON format with stack trace

EXAMPLE FLOW:
  Router throws ValidationError("Invalid faceShape")
     ↓
  Error handler catches it
     ↓
  Logs: { level: ERROR, error: "Invalid faceShape", request_id: "..." }
     ↓
  Responds: 400 { success: false, error: "Invalid faceShape" }


4.4 CONFIGURATION (config.js)
──────────────────────────────

WHAT IT DOES:
  Loads and validates all environment configuration on startup

WHY IMPORTANT?
  ✓ Catch config errors before starting (not during requests)
  ✓ Provide defaults
  ✓ Clear error messages

VALIDATED CONFIG:

PORT:
  Default: 3001
  Must be: 1-65535
  Example: PORT=3001

NODE_ENV:
  Default: "development"
  Values: "development", "production", "staging"
  Used for: Logging level, error details

LOG_LEVEL:
  Default: "INFO"
  Values: "DEBUG", "INFO", "WARN", "ERROR"
  Changes: How much gets logged

PYTHON_SIDECAR_URL:
  Default: http://localhost:8001
  Must be: Valid HTTP URL
  Used by: axios calls to Python service

OLLAMA_HOST:
  Default: http://localhost:11434
  Must be: Valid HTTP URL
  Used by: Chat service

OLLAMA_MODEL:
  Default: "llama3.2"
  Used by: Which model to load

REQUEST_TIMEOUT:
  Default: 15000ms (15 seconds)
  Used by: axios timeout for sidecar calls

ON STARTUP (index.js):
  validateConfig() called at top
  If any error: logs error, exits with code 1
  If success: logs all config values


4.5 FACE SHAPE ALGORITHM (face_shape.py)
─────────────────────────────────────────

WHAT IT DOES:
  Measures face from 106 landmark points → determines shape

HOW IT WORKS:

INPUT: 106 facial landmark points (x,y coordinates on face)

STEP 1: CALCULATE MEASUREMENTS

  jaw_width = distance from left jaw (point 0) to right jaw (point 32)
  cheek_width = distance from left cheek (point 3) to right cheek (point 29)
  forehead_width = distance between brows × 1.15 (extrapolate to hairline)
  face_height = average distance from brow tops to chin × 1.35
  
  ratio = face_height / base_width (average of jaw and forehead width)

STEP 2: SCORE EACH SHAPE

  For each of 6 face shapes, calculate a score 0-1:

  Oblong:
    ✓ Score high if: height/width ratio 1.15-1.6 AND forehead≈jaw
    WHY: Tall, uniform width

  Oval:
    ✓ Score high if: height/width ratio 1.4-1.65 AND cheek slightly wider than jaw
    WHY: Moderately tall, balanced

  Round:
    ✓ Score high if: height/width ratio 1.0-1.35 AND all widths similar
    WHY: Compact, soft angles

  Square:
    ✓ Score high if: height/width ratio 0.9-1.3 AND all widths equal
    WHY: Strong jaw, balanced

  Heart:
    ✓ Score high if: forehead much wider than jaw (>1.3x)
    WHY: Wide top, narrow chin

  Diamond:
    ✓ Score high if: cheek 1.25x wider than forehead/jaw AND not tall
    WHY: Wide cheeks, narrow top/bottom

STEP 3: PICK BEST

  best_shape = shape with highest score
  confidence = score of best shape (0-1)

OUTPUT:
  {
    face_shape: "Oval",
    confidence: 0.95,
    measurements: {
      jaw_width: 67.42,
      cheek_width: 112.39,
      forehead_width: 74.09,
      face_height: 81.17,
      height_width_ratio: 1.234
    },
    all_scores: {
      Oblong: 0.89,
      Oval: 0.95,
      Round: 0.12,
      Square: 0.45,
      Heart: 0.23,
      Diamond: 0.34
    }
  }

ACCURACY:
  ~80-90% on typical faces
  Challenges: Extreme angles, poor lighting, partially hidden faces


================================================================================
5. BEST PRACTICES IMPLEMENTED
================================================================================

5.1 STRUCTURED LOGGING
─────────────────────

WHAT: All logs are JSON with structured fields

BENEFIT:
  Can be parsed by logging systems (ELK, DataDog, CloudWatch)
  Can filter and search logs efficiently
  Can track request_id across multiple services

EXAMPLE:
  LOG OUTPUT: { timestamp, level, service, message, request_id, ... }
  SEARCH: Find all ERROR logs for request_id "123"
  RESULT: See entire request lifecycle

5.2 REQUEST ID TRACKING
─────────────────────

WHAT: Each request gets unique ID

BENEFIT:
  Follow a single request through multiple services
  Correlate logs from Node.js and Python sidecar
  Trace problems back to specific request

FLOW:
  Client request arrives
     ↓
  Request ID generated (UUID) or from X-Request-ID header
     ↓
  Attached to req object
     ↓
  All logs include it
     ↓
  Sent back in response


5.3 INPUT VALIDATION
────────────────────

WHAT: Validate ALL user inputs before processing

BENEFIT:
  Prevent crashes from bad input
  Return helpful error messages
  Security (prevent injection attacks)
  Early failure (don't waste resources)


5.4 ERROR STANDARDIZATION
─────────────────────────

WHAT: All errors follow same format

BENEFIT:
  Client code expects predictable format
  Includes request_id for debugging
  Includes helpful hints
  Appropriate HTTP status codes


5.5 CONFIGURATION VALIDATION
────────────────────────────

WHAT: Validate config on startup

BENEFIT:
  Catch config problems before serving requests
  Don't start if critical settings wrong
  Clear error messages on startup
  Faster debugging


5.6 GRACEFUL SHUTDOWN
─────────────────────

WHAT: Handle SIGTERM/SIGINT signals properly

HOW:
  Server catches Ctrl+C (SIGINT) or docker stop (SIGTERM)
     ↓
  Logs shutdown event
     ↓
  Waits for in-flight requests to complete
     ↓
  Closes connections
     ↓
  Exits cleanly

BENEFIT:
  No request drops
  No connection leaks
  Clean logs
  Docker likes it


5.7 TIMEOUT PROTECTION
──────────────────────

WHAT: All external service calls have timeout

HOW:
  axios.post(..., { timeout: 15000 })
  If no response in 15s, error thrown

BENEFIT:
  Prevent hanging requests
  Return error to client instead of waiting forever
  Protect against stuck processes


5.8 SECURITY PRACTICES
──────────────────────

CORS:
  ✓ Configured to allow requests
  ✓ Can restrict to specific origins

Input Limits:
  ✓ File size limit 10MB
  ✓ Message length limit 5000 chars
  ✓ History limit 50 messages

Non-root Docker:
  ✓ Containers run as non-root user
  ✓ Prevents privilege escalation

No Secrets in Code:
  ✓ All sensitive data in .env
  ✓ Never committed to git


5.9 DOCKER BEST PRACTICES
──────────────────────

Multi-stage Build:
  ✓ Smaller final images
  ✓ Don't include build tools in production

Health Checks:
  ✓ Docker can detect and restart failed services

Signal Handling:
  ✓ dumb-init ensures proper signal forwarding
  ✓ Graceful shutdown works in Docker

Non-root User:
  ✓ Security hardening

Resource Limits:
  ✓ Prevent resource exhaustion


================================================================================
6. IMPORTANT WARNINGS & THINGS TO AVOID
================================================================================

⚠️ CRITICAL WARNINGS

1. FIRST REQUEST TAKES 30-60 SECONDS
   ════════════════════════════════════
   
   Problem: You or users might think service is broken
   
   Why happens:
     • UniFace models downloaded on first use (~100MB)
     • Models loaded into memory
     • Models compiled/optimized
   
   Solution:
     • This is NORMAL behavior
     • Don't timeout requests too early
     • Pre-warm services after deployment
     • Tell users first request is slow
   
   How to pre-warm:
     After docker compose up, make a dummy face analysis request
     This loads models, subsequent requests fast

   Code:
     docker exec ai-service curl http://python-sidecar:8001/health
     # Wait a bit
     curl -X POST http://localhost:3001/api/face/analyze -F "file=@sample.jpg"


2. DON'T CHANGE REQUEST TIMEOUT TOO LOW
   ═════════════════════════════════════
   
   Problem: Requests fail with 504 timeout
   
   Why: Face detection takes 2-5 seconds
         Chat generation takes 5-10 seconds
         First request takes 30-60 seconds
   
   Config: REQUEST_TIMEOUT=15000 (milliseconds)
   
   ✓ Safe values: 15000 (15s) or higher
   ✗ Risky: < 10000 (10s) - many requests will timeout
   ✗ Wrong: < 5000 (5s) - almost all will timeout


3. PYTHON SIDECAR MUST BE RUNNING
   ════════════════════════════════
   
   Problem: Face analysis returns 503 "service unavailable"
   
   Causes:
     • Python sidecar container crashed
     • Python sidecar not started
     • Network issues between containers
     • Port 8001 not exposed
   
   Check:
     docker ps | grep python-sidecar
     # Should see running container
     
     docker logs python-sidecar
     # Look for errors
     
     docker exec ai-service curl http://python-sidecar:8001/health
     # Should return JSON


4. OLLAMA MUST HAVE MODEL
   ═══════════════════════
   
   Problem: Chat returns error or no response
   
   Causes:
     • Model (llama3.2) not downloaded
     • Ollama container crashed
     • Model not loaded in memory
   
   Check:
     docker logs ollama | grep "pulling\|loaded"
     
     docker exec ollama ollama list
     # Should show llama3.2
     
     curl http://localhost:11434/api/tags
     # Should list available models


5. DON'T STORE FILES ON DISK IN CONTAINER
   ═══════════════════════════════════════
   
   Problem: Files disappear when container restarts
   
   Why: Containers are ephemeral - data is lost
   
   ✗ Bad:
     fs.writeFile('/app/uploads/image.jpg', buffer)
     # File lost on restart
   
   ✓ Good:
     req.file.buffer - keep in memory
     Send to external service (S3, etc)
     Store in database
   
   Current code: Keeps images in memory - good!


6. DON'T BLOCK THE EVENT LOOP
   ══════════════════════════════
   
   Problem: Service becomes unresponsive
   
   What blocks:
     ✗ Synchronous file I/O (fs.readFileSync)
     ✗ Long running loops without await
     ✗ Blocking computation
   
   ✓ Good:
     All code uses async/await
     All I/O is non-blocking
     Heavy computation runs in separate process


7. DON'T IGNORE PROMISES
   ═════════════════════════

   Problem: Errors happen silently
   
   ✗ Bad:
     axios.post(...).then(...).catch()  // Missing catch
     async function() { await something } // No error handling
   
   ✓ Good:
     await axios.post(...) // In try-catch
     Routes use express-async-errors
     All promises returned


8. DON'T COMMIT .env FILE
   ═════════════════════════
   
   Problem: Secrets exposed on GitHub
   
   .gitignore already has:
     .env
     .env.local
     .env.*.local
   
   ✓ Use .env.example for template
   ✓ Share .env.example in repo
   ✗ Never commit actual .env


9. DON'T RUN WITH NODE_ENV=production IN DEVELOPMENT
   ═══════════════════════════════════════════════════
   
   Why: production suppresses stack traces
   
   For development:
     NODE_ENV=development (or omit, it's default)
     LOG_LEVEL=DEBUG
   
   For production:
     NODE_ENV=production
     LOG_LEVEL=WARN or INFO


10. DON'T MAKE FACE ANALYSIS SYNCHRONOUS
    ═════════════════════════════════════
    
    Current: async inference takes time, client waits
    
    Alternatives for large scale:
      • Queue system (Bull, RabbitMQ)
      • Async job processing
      • Webhook callbacks
    
    But for current size: Synchronous is fine


11. DON'T FORGET HEALTH CHECKS
    ═════════════════════════════
    
    Health checks tell Kubernetes/Docker:
      • Is service healthy?
      • Should requests still go there?
      • Should we restart it?
    
    We have:
      GET /health (basic health)
      GET /ready (dependencies OK)
      GET /api/face/health (sidecar OK)
    
    Check these regularly!


12. DON'T MAKE REQUESTS TO EXTERNAL SERVICES WITHOUT AWAIT
    ══════════════════════════════════════════════════════════
    
    Problem: Race conditions, data loss
    
    ✗ Bad:
      axios.post(...)  // Not awaited, continues
      res.json(data)
    
    ✓ Good:
      const result = await axios.post(...)
      res.json(result.data)


================================================================================
7. TROUBLESHOOTING COMMON ISSUES
================================================================================

ISSUE: "Connect ECONNREFUSED 127.0.0.1:8001"
─────────────────────────────────────────────
Meaning: Node.js can't connect to Python sidecar

Cause:
  • Python sidecar not running
  • Python sidecar crashed
  • Wrong URL in PYTHON_SIDECAR_URL
  • Network issues

Fix:
  1. docker ps
     Check if python-sidecar is listed and running
  
  2. docker logs python-sidecar
     Look for error messages
  
  3. docker compose restart python-sidecar
     Restart the service
  
  4. Check PYTHON_SIDECAR_URL in .env
     Should be http://python-sidecar:8001 (in Docker)
     or http://localhost:8001 (if running locally)


ISSUE: Face analysis returns "No face detected"
────────────────────────────────────────────────
Meaning: UniFace couldn't find a face in image

Cause:
  • Image doesn't have a clear face
  • Face partially hidden
  • Very poor lighting
  • Image is too small
  • Multiple faces and model confused

Fix:
  1. Ensure image has one clear face
  2. Good lighting
  3. Face not obscured
  4. Reasonable resolution (>200x200px)
  5. Try different image


ISSUE: Chat returns no response
────────────────────────────────
Meaning: Ollama not responding

Cause:
  • Ollama container not running
  • Model not downloaded
  • Model not loaded in memory (large, slow first request)

Fix:
  1. docker ps | grep ollama
     Verify running
  
  2. docker logs ollama
     Check logs
  
  3. curl http://localhost:11434/api/tags
     Check models available
  
  4. Model downloading?
     docker logs ollama | grep pulling
     Wait for completion (can be 5+ minutes)
  
  5. Restart:
     docker compose restart ollama


ISSUE: "File too large" error with file < 10MB
───────────────────────────────────────────────
Meaning: File upload limit hit despite small file

Cause:
  • Multer limit is 10MB
  • File actually larger than you think
  • Corrupted file header

Fix:
  1. Check actual file size:
     Windows: Right-click > Properties > Size
     Mac/Linux: ls -lh file.jpg
  
  2. If actually < 10MB:
     Try uploading different image
     Try converting to different format (jpg, png)


ISSUE: Service takes 30+ seconds for first request
──────────────────────────────────────────────────
Meaning: Models are downloading and loading

Causes:
  • First time running
  • Models not in Docker cache
  • Slow internet

This is NORMAL!

Fix:
  1. Wait patiently (30-60s)
     This only happens once
  
  2. Check progress:
     docker logs python-sidecar
  
  3. Subsequent requests will be fast (2-5s)


ISSUE: "Request timeout" error (504)
──────────────────────────────────────
Meaning: Request took too long

Cause:
  • Service overloaded
  • Model taking too long
  • Network slow
  • First request and models loading

Fix:
  1. Increase REQUEST_TIMEOUT in .env
     Default: 15000ms
     Try: 30000ms (30 seconds)
  
  2. Check CPU/memory:
     docker stats
     Are resources maxed out?
  
  3. Restart services:
     docker compose restart
  
  4. If first request:
     Wait longer - models are loading


ISSUE: Docker service keeps restarting
──────────────────────────────────────
Meaning: Container crashes immediately

Cause:
  • Configuration error
  • Missing dependencies
  • Crash on startup

Fix:
  1. Check logs:
     docker logs <service-name>
  
  2. Look for errors at start
  
  3. Verify .env exists and is valid:
     ls node-service/.env
     cat node-service/.env | head
  
  4. Rebuild:
     docker compose build --no-cache
     docker compose up


ISSUE: "Validation Error: faceShape is required"
────────────────────────────────────────────────
Meaning: Your request is missing required field

Cause:
  • faceShape not provided
  • Typo in field name
  • Wrong JSON format

Fix:
  Ensure request includes:
    {
      "faceShape": "Oval",  // Required!
      "gender": "male",     // Optional
      "hairType": "Wavy",   // Optional
      "limit": 5            // Optional
    }


ISSUE: CORS error: "No 'Access-Control-Allow-Origin' header"
────────────────────────────────────────────────────────────
Meaning: Browser request from different origin blocked

Cause:
  • Frontend from different domain
  • CORS not configured

Fix:
  CORS is configured in index.js:
    app.use(cors());
  
  This allows all origins
  
  In production, restrict:
    app.use(cors({
      origin: "https://your-frontend.com"
    }));


================================================================================
8. PERFORMANCE CONSIDERATIONS
================================================================================

8.1 RESPONSE TIMES
───────────────────

FACE ANALYSIS:
  First request:  45-75 seconds (model loading)
  Subsequent:     2-5 seconds
  With optimal HW: <1 second

CHAT:
  Small message:  5-10 seconds
  Large message:  10-20 seconds
  Streaming:      Chunks arrive instantly

RECOMMENDATIONS:
  <100ms (in-memory, no ML)

HEALTH CHECKS:
  <10ms


8.2 BOTTLENECKS
─────────────────

SLOW PARTS:
  ✗ Python sidecar initialization (first request)
  ✗ Ollama model loading (first request)
  ✗ Face detection ML inference
  ✗ Chat token generation

FAST PARTS:
  ✓ Recommendations (data lookup)
  ✓ Request routing
  ✓ JSON parsing


8.3 SCALING CONSIDERATIONS
────────────────────────────

SINGLE INSTANCE:
  ✓ Handles ~100 requests/second
  ✓ Good for teams, internal use
  
WITH LOAD BALANCER:
  ✓ Multiple Node.js instances
  ✓ Single shared Python sidecar is bottleneck
  
SOLUTION:
  ✓ Multiple Python sidecar instances
  ✓ Queue system for heavy loads
  ✓ GPU for faster inference


8.4 MEMORY USAGE
─────────────────

NODE.JS:
  Typical: 50-150MB
  With many connections: up to 300MB

PYTHON SIDECAR:
  Models in memory: ~500MB-1GB
  Per request: +50MB
  
OLLAMA:
  Model in memory: 2-8GB (depends on model size)

DOCKER LIMITS:
  Set in docker-compose.yml or swarm mode
  Default: unlimited (use host memory)


8.5 OPTIMIZATION TIPS
──────────────────────

1. Enable GPU if available
   ├─ NVIDIA Docker for cuda support
   ├─ ~10x faster inference
   └─ Edit docker-compose.yml

2. Cache models
   ├─ Persist volumes
   ├─ Don't re-download each run
   └─ Already done in docker-compose.yml

3. Connection pooling
   ├─ Reuse HTTP connections
   ├─ axios handles automatically
   └─ Good for many requests

4. Compression
   ├─ Gzip responses
   ├─ For large recommendations lists
   └─ express.compression() middleware

5. Database caching
   ├─ Cache face analysis results by image hash
   ├─ For repeated submissions
   └─ Redis or memcached

6. Async processing
   ├─ Queue heavy images
   ├─ Process background, return ID
   ├─ Client polls for results
   └─ For high load


================================================================================
9. SECURITY IMPLEMENTATION
================================================================================

9.1 INPUT SANITIZATION
──────────────────────

All user inputs validated:
  ✓ File type checked (image only)
  ✓ File size limited (10MB)
  ✓ String length limited
  ✓ Enum values checked (faceShape, gender, etc)
  ✓ No null bytes or control characters

Prevents:
  ✗ Malicious file uploads
  ✗ Buffer overflows
  ✗ Injection attacks
  ✗ DoS from huge payloads


9.2 CORS CONFIGURATION
──────────────────────

Currently: All origins allowed
  app.use(cors())

For production: Restrict to your domain
  app.use(cors({
    origin: "https://your-app.com",
    credentials: true
  }))


9.3 NO SECRETS IN CODE
──────────────────────

✓ All config in .env
✓ .env in .gitignore
✓ .env.example as template
✓ Never commit actual .env


9.4 DOCKER SECURITY
────────────────────

Non-root user:
  ✓ Container doesn't run as root
  ✓ Prevents privilege escalation

Minimal images:
  ✓ Alpine/slim base images
  ✓ Small attack surface

Health checks:
  ✓ Automatic restart on failure
  ✓ Remove compromised container


9.5 NETWORK SECURITY
─────────────────────

Docker network isolation:
  ✓ ai-net (container network)
  ✓ Services only accessible internally
  ✓ Or exposed on specific ports

Only expose:
  ✓ Port 3001 (Node.js API)
  ✗ Don't expose port 8001 (Python sidecar)
  ✗ Don't expose port 11434 (Ollama)


9.6 LOGGING CONSIDERATIONS
───────────────────────────

Logs contain:
  ✓ Request timing
  ✓ Service errors
  ✗ Not usernames/passwords
  ✗ Not personal data
  ✗ Not full request bodies

Sensitive data:
  • Don't log file contents
  • Don't log full chat messages to external systems
  • Be careful with PII (personally identifiable info)


================================================================================
10. WHAT YOU SHOULD DO NEXT
================================================================================

IMMEDIATE:
  1. Run test script to verify everything works
  2. Test with real face images
  3. Monitor logs for errors
  4. Back up your .env file

SHORT TERM:
  1. Set up external log aggregation (DataDog, ELK)
  2. Configure alerts for ERROR logs
  3. Load test with expected traffic
  4. Set resource limits in docker-compose

MEDIUM TERM:
  1. Add database for user history
  2. Implement caching (Redis)
  3. Add authentication/authorization
  4. Set up CI/CD pipeline
  5. Add metrics (Prometheus)

LONG TERM:
  1. Kubernetes deployment
  2. Horizontal scaling
  3. Multi-region deployment
  4. Machine learning model tuning
  5. Advanced analytics


================================================================================
SUMMARY OF KEY CONCEPTS
================================================================================

ARCHITECTURE:
  ONE AI Microservice with three internal components:
  - Node.js (API Gateway on port 3001 - PUBLIC)
  - Python (Face detection on port 8001 - PRIVATE)
  - Ollama (Chat/LLM on port 11434 - PRIVATE)
  
  Components are independently managed but tightly integrated:
  - Each has specific role (API, ML, LLM)
  - Easily replaceable (switch Python for Java, etc)
  - Fault-isolated (one crashing doesn't crash all)
  - Easy to scale independently

TECHNOLOGIES:
  Node.js/Express: REST API gateway for other microservices
  Python/FastAPI: Machine learning inference engine
  UniFace: Face detection and landmark ML model
  Ollama: Local LLM (large language model) server
  Docker: Containerization

BEHAVIOR:
  Request → Validation → Processing → External call → Response
  All logged with request ID
  Errors standardized, helpful, status codes correct

BEST PRACTICES:
  Structured logging, validation, error handling, config management
  Security, health checks, graceful shutdown
  Easy to debug, monitor, deploy

WARNINGS:
  First request slow (normal)
  Services must be running
  Don't commit .env
  Respect timeouts
  Handle async properly

DEBUGGING:
  Check logs first: docker logs <service>
  Verify health: curl http://localhost:3001/health
  Test connectivity: docker exec ai-service curl ...
  Run test script: ./scripts/test-api.ps1

================================================================================
END OF DOCUMENTATION
================================================================================

For more info:
  - README.md: Architecture overview
  - DEPLOYMENT.md: Detailed deployment guide
  - QUICKSTART.md: Quick reference
  - Source code: Well-commented
  - Logs: Check docker logs for runtime behavior

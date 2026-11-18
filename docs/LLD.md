# TestPilot — Low-Level Design (LLD)

**Project:** TestPilot (AI-Powered API Testing Assistant)  
**Milestone:** Phase 6: Final Hardening & Project Assessor Readiness  
**Document Version:** 6.0.0  

---

## 1. Codebase & Directory Structure

```
testPilot/
├── .gitignore                      # Git exclusion rules (node_modules, .env, dist)
├── docker-compose.yml              # PostgreSQL 16 + pgvector container configuration
├── init.sql                        # PostgreSQL extension initialization (vector, uuid-ossp)
├── package.json                    # Root workspace configuration & orchestration scripts
├── README.md                       # Comprehensive setup & API guide
├── docs/                           # Technical documentation
│   ├── PRD.md                      # Product Requirements Document (v5.0.0)
│   ├── HLD.md                      # High-Level Architecture (v5.0.0)
│   └── LLD.md                      # Low-Level Design & REST API Specifications (this file)
├── examples/                       # Sample OpenAPI Specifications
│   ├── sandbox-openapi.yaml        # Complete OAS 3.0.3 specification for Sandbox API
│   └── sandbox-openapi.json        # JSON equivalent specification
├── scripts/
│   ├── verify-all.js               # Master test runner (Phases 1-5, 70 tests)
│   ├── verify-phase2.js            # Phase 2 dedicated test suite (16 tests)
│   ├── verify-phase3.js            # Phase 3 dedicated test suite (14 tests)
│   ├── verify-phase4.js            # Phase 4 dedicated test suite (15 tests)
│   └── verify-phase5.js            # Phase 5 dedicated test suite (15 tests)
├── client/                         # Frontend Application (React + Vite + Tailwind CSS)
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # Top-level state & service polling
│       ├── index.css
│       ├── services/
│       │   └── socket.js           # Socket.IO client singleton & room subscriber
│       └── components/
│           ├── Header.jsx          # Top navbar with live heartbeat, spec status & AI usage modal
│           ├── Sidebar.jsx         # Section navigation with Phase indicators
│           ├── Workspace.jsx       # Tab router, dashboard & live verification console
│           ├── StatusCard.jsx      # Reusable status metric widget
│           ├── SpecWorkspace.jsx   # Master OpenAPI processing workspace
│           ├── SpecUploader.jsx    # Drag-and-drop & browse file uploader
│           ├── SpecOverview.jsx    # Spec metadata, stats & method distribution
│           ├── EndpointList.jsx    # Searchable, filterable endpoint list
│           ├── EndpointDetail.jsx  # Endpoint viewer with tabs (Schema, Generator, Agent)
│           ├── AiTestGenerator.jsx # AI test case generation (Phase 3)
│           ├── AiAgentInvestigation.jsx # Live WebSocket agent streaming panel (Phase 5)
│           ├── EvaluationDashboard.jsx  # LLM evaluation benchmark runner & metrics (Phase 5)
│           └── AiUsageModal.jsx    # Aggregated token usage, cost estimates & call logs
├── server/                         # Backend Orchestrator Service (Node.js + Express)
│   ├── .env.example
│   ├── .env                        # Server environment variables
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma           # Prisma schema for pgvector, runs, and evaluation models
│   └── src/
│       ├── server.js               # HTTP + Socket.IO server bootstrap & signal handling
│       ├── app.js                  # Express middleware & route composition
│       ├── socket/
│       │   └── index.js            # Socket.IO connection manager, rooms & event emitter
│       ├── eval/                   # Phase 5 Evaluation Framework
│       │   ├── evaluator.js        # Rule-based deterministic evaluation engine & runner
│       │   └── datasets/
│       │       └── benchmark-v1.json # 16-case ground truth benchmark dataset
│       ├── config/
│       │   └── env.js              # Environment variable loader
│       ├── middlewares/
│       │   ├── errorHandler.js     # Centralized error handler
│       │   ├── notFoundHandler.js  # 404 route handler
│       │   └── upload.js           # Multer configuration (2 MB limit, in-memory)
│       ├── schemas/
│       │   └── testCase.schema.js  # Strict Zod schema validation
│       ├── rag/                    # Phase 4 RAG Subsystem
│       │   ├── chunker.js          # Semantic OpenAPI specification decomposition
│       │   ├── embeddingService.js # 768-dim text-embedding-004 client & deterministic fallback
│       │   ├── vectorStore.js      # pgvector storage + in-memory vector store
│       │   └── retrievalService.js # Top-K cosine similarity retrieval & prompt context
│       ├── agent/                  # Phase 4/5 Autonomous AI Agent Subsystem
│       │   ├── agentTools.js       # Controlled function calling declarations & handlers
│       │   └── agentOrchestrator.js# Bounded multi-step state machine with Socket.IO events
│       ├── execution/              # Phase 4 Test Execution Engine
│       │   └── testRunner.js       # Secure HTTP test runner with boundary checks & assertions
│       ├── diagnosis/              # Phase 4 AI Failure Diagnosis
│       │   └── failureExplainer.js # Evidence-backed Gemini root cause analyzer
│       ├── services/
│       │   ├── specStore.js        # In-memory OpenAPI specification store
│       │   ├── openApiParser.js    # Multi-format parser, validator & security sanitizer
│       │   ├── geminiService.js    # Gemini API client with function calling & Zod validation
│       │   ├── geminiTools.js      # Gemini tool schema declarations
│       │   └── usageStore.js       # Token and cost tracking service
│       └── routes/
│           ├── index.js            # Master API router mounting
│           ├── spec.routes.js      # OpenAPI upload & inspection endpoints
│           ├── ai.routes.js        # AI test synthesis & agent endpoints
│           └── eval.routes.js      # Phase 5 evaluation REST routes
└── sandbox-api/                    # Isolated Mock Target Application (Node.js + Express)
    ├── package.json
    └── src/
        ├── server.js
        ├── app.js
        ├── routes/users.routes.js
        └── data/users.data.js
```

---

## 2. Real-Time WebSockets Engine (`server/src/socket/index.js`)

### 2.1 Interface & Functions
```javascript
function initSocketIO(httpServer, options = {})
function getIO()
function emitAgentEvent(runId, eventType, data = {})
function sanitizePayload(obj, depth = 0)
function isValidRunId(runId)
function closeSocketIO()
```

### 2.2 Supported Event Schema
Every agent event emitted over Socket.IO follows a standard structured envelope:
```json
{
  "runId": "agent_1794939309983",
  "eventType": "agent:step",
  "timestamp": "2026-11-17T18:15:10.012Z",
  "data": {
    "runId": "agent_1794939309983",
    "stepNumber": 2,
    "stepType": "TOOL_CALL",
    "toolName": "retrieve_api_documentation",
    "notes": "Querying RAG vector store for endpoint documentation",
    "stepStatus": "SUCCESS"
  }
}
```

---

## 3. LLM Evaluation Engine (`server/src/eval/evaluator.js`)

### 3.1 Interface & Exported Functions
```javascript
function listDatasets()
function loadDataset(datasetId)
function getBenchmarkDataset(datasetId)
function validateDatasetSchema(dataset)
function calculateDeterministicMetrics(caseEvaluations = [])
function evaluateGeneratedTestsForCase(evalCase, generatedTests)
function runEvaluation({ datasetId, useLiveGemini, apiKeyOverride, modelOverride })
function getEvaluationRunById(runId)
function getAllEvaluationRuns()
function getEvaluationSummary()
```

### 3.2 Metric Calculation Implementation
```javascript
const overallScore = parseFloat(
  (
    0.20 * schemaValidity +
    0.20 * endpointAccuracy +
    0.20 * methodAccuracy +
    0.25 * expectedStatusAccuracy +
    0.15 * categoryCoverage
  ).toFixed(2)
);
const passed = overallScore >= 70.0;
```

---

## 4. REST API Specifications

### 4.1 Evaluation Endpoints

#### `GET /api/evaluations/datasets`
- **Description:** Lists all available ground-truth benchmark datasets.
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalDatasets": 1,
    "datasets": [
      {
        "id": "benchmark-v1",
        "name": "TestPilot Core REST API Benchmark",
        "version": "1.0.0",
        "description": "Standardized benchmark suite for evaluating LLM API test case generation against REST contracts.",
        "totalCases": 16,
        "specTitle": "TestPilot Sandbox Mock API"
      }
    ]
  }
}
```

#### `GET /api/evaluations/datasets/:id`
- **Description:** Retrieves full dataset definition including all 16 cases.
- **Parameters:** `id` (e.g., `benchmark-v1`).
- **Response (200 OK):** Full dataset JSON object with `cases` array.
- **Response (404 Not Found):** If dataset does not exist.

#### `POST /api/evaluations/run`
- **Description:** Executes benchmark evaluation against a dataset.
- **Request Body:**
```json
{
  "datasetId": "benchmark-v1",
  "useLiveGemini": false
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "eval_run_1794939309939_lk0st",
    "datasetId": "benchmark-v1",
    "datasetName": "TestPilot Core REST API Benchmark",
    "totalCases": 16,
    "passedCases": 16,
    "failedCases": 0,
    "overallScore": 99.53,
    "schemaValidityRate": 100.0,
    "endpointAccuracy": 100.0,
    "methodAccuracy": 100.0,
    "statusAccuracy": 98.12,
    "categoryCoverage": 100.0,
    "passed": true,
    "durationMs": 42,
    "caseResults": [...]
  }
}
```

#### `GET /api/evaluations/runs/:id`
- **Description:** Retrieves historical evaluation run results by ID.
- **Response (200 OK):** Run record with full case results.
- **Response (404 Not Found):** If ID not found.

#### `GET /api/evaluations/summary`
- **Description:** Aggregates statistics across all completed evaluation runs.
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalRuns": 5,
    "averageOverallScore": 98.4,
    "averageSchemaValidity": 100.0,
    "totalCasesEvaluated": 80,
    "passRate": 100.0,
    "recentRuns": [...]
  }
}
```

---

## 5. PostgreSQL Schema Definition (`server/prisma/schema.prisma`)

```prisma
model EvaluationRun {
  id                   String                 @id @default(uuid())
  datasetId            String                 @map("dataset_id")
  datasetName          String                 @map("dataset_name")
  totalCases           Int                    @map("total_cases")
  passedCases          Int                    @map("passed_cases")
  failedCases          Int                    @map("failed_cases")
  overallScore         Float                  @map("overall_score")
  schemaValidityRate   Float                  @map("schema_validity_rate")
  endpointAccuracy     Float                  @map("endpoint_accuracy")
  methodAccuracy       Float                  @map("method_accuracy")
  statusAccuracy       Float                  @map("status_accuracy")
  categoryCoverage     Float                  @map("category_coverage")
  passed               Boolean                @default(false)
  durationMs           Int                    @map("duration_ms")
  status               String                 @default("COMPLETED")
  createdAt            DateTime               @default(now()) @map("created_at")
  caseResults          EvaluationCaseResult[]

  @@map("evaluation_runs")
}

model EvaluationCaseResult {
  id                String        @id @default(uuid())
  runId             String        @map("run_id")
  run               EvaluationRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  caseId            String        @map("case_id")
  caseName          String        @map("case_name")
  endpoint          String
  scenarioType      String        @map("scenario_type")
  passed            Boolean       @default(false)
  score             Float
  schemaValid       Boolean       @default(false) @map("schema_valid")
  endpointMatch     Boolean       @default(false) @map("endpoint_match")
  methodMatch       Boolean       @default(false) @map("method_match")
  statusMatch       Boolean       @default(false) @map("status_match")
  categoryMatch     Boolean       @default(false) @map("category_match")
  generatedCount    Int           @map("generated_count")
  notes             String?
  createdAt         DateTime      @default(now()) @map("created_at")

  @@map("evaluation_case_results")
}
```

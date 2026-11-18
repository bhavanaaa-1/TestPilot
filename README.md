# TestPilot 🚀
> **AI-Powered API Testing Assistant**  
> *College Project Assessor Evaluation Baseline — Phase 6: Final Hardening & Project Assessor Readiness*

---

## 📌 Project Overview

**TestPilot** is an intelligent developer assistant designed to automate the entire API testing and quality engineering lifecycle:
1. **Spec Ingestion & Inspection (Phase 2):** Ingest and parse OpenAPI 3.0 / 3.1 specifications (JSON/YAML) with offline validation, external reference security protection, and interactive UI exploration.
2. **AI Test Synthesis (Phase 3):** Use Google Gemini 2.5 Flash via `@google/genai` to generate positive, negative, and boundary test cases with real function calling, strict Zod schema validation, and prompt-injection defense.
3. **RAG & Vector Retrieval (Phase 4):** Semantic document chunking of OpenAPI specifications, 768-dimensional text embeddings (`text-embedding-004`), and PostgreSQL + pgvector storage with cosine similarity search and in-memory fallback.
4. **Autonomous AI Testing Agent (Phase 4):** Multi-step bounded agent workflow (max 10 turns) with tool execution (`retrieve_api_context`, `inspect_endpoint`, `execute_test_case`, `get_test_execution_results`), explicit state transitions, and execution trace recording.
5. **Sandbox Test Execution Engine (Phase 4):** Secure HTTP test execution against isolated sandbox API environments (`http://localhost:4000`), strict URL/path boundaries, timeout and size caps, and expected vs actual condition evaluation.
6. **AI Failure Diagnostics (Phase 4):** Root cause analysis with Gemini citing runtime evidence and generating suggested fixes labeled as hypotheses.
7. **Real-Time WebSockets (Phase 5):** Direct Socket.IO integration on the existing Express HTTP server (`:5000`) streaming 9 real-time agent lifecycle transitions, room subscriptions, client reconnection handling, and automated payload sanitization.
8. **LLM Evaluation Framework (Phase 5):** Version-controlled ground-truth benchmark datasets (16 cases across all sandbox endpoints and categories), deterministic rule-based metric calculations (Schema, Endpoint, Method, Status, Category), PostgreSQL persistence, and an interactive evaluation dashboard.
9. **Final Hardening & Assessor Readiness (Phase 6):** Complete 70-test master regression suite, isolated per-phase runners, security audit, transparent Gemini verification, Docker persistence reliability, and assessor documentation.

---

## 💻 Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 5, JavaScript (ESM) | Responsive SPA dashboard with dark aesthetic |
| **Styling** | Tailwind CSS 3, Lucide React Icons | Modern dark-themed user interface |
| **Real-Time Client** | Socket.IO Client (v4.8) | Full-duplex WebSocket connection to server |
| **Backend** | Node.js (v24), Express 4 (CommonJS) | Centralized orchestrator, REST routes, error handling |
| **Real-Time Server** | Socket.IO (v4.8) on `http.createServer` | Co-located WebSocket server on port 5000 |
| **LLM & AI** | `@google/genai` (v0.1.1) | Official Google SDK for Gemini 2.5 Flash & text-embedding-004 |
| **Validation** | Zod (v3.24) | Strict runtime schema validation for generated test cases |
| **OpenAPI Engine** | `@apidevtools/swagger-parser`, `js-yaml` | Spec parsing, dereferencing prevention & AST traversal |
| **Database** | PostgreSQL 16 with `pgvector` C Extension | Relational data persistence & vector similarity search |
| **ORM & Migrations**| Prisma 6 & `pg` Driver | Schema migrations and parameterized SQL vector queries |
| **Containerization**| Docker & Docker Compose | Local zero-config PostgreSQL + pgvector environment |
| **Mock Target API** | Express 4 (:4000) | Isolated in-memory REST sandbox for test execution |

---

## 🎯 Current Milestone: Phase 6 — Final Hardening & Assessor Readiness

> [!IMPORTANT]
> **Evaluation Scope Notice:**  
> This deliverable represents **Phase 6: Final Hardening & Project Assessor Readiness**. All functionality from Phases 1 through 5 is fully operational and verified:
> - **70 Automated Regression Tests:** 100% pass rate across Foundation, OpenAPI, AI Synthesis, RAG/Agent/Sandbox, and WebSockets/Evaluation.
> - **Dual-Mode AI Capability:** Fully functional with live Google Gemini API credentials or completely deterministic offline fallback for 100% offline reproducibility.
> - **Zero-Secret Guarantee:** No credentials or API keys exposed in client code, console logs, WebSocket streams, or Git commits.

---

## 📂 Monorepo Folder Structure

```
testPilot/
├── .gitignore                      # Git exclusion rules (.env, node_modules, dist)
├── docker-compose.yml              # PostgreSQL 16 + pgvector container configuration
├── init.sql                        # PostgreSQL extension initialization (vector, uuid-ossp)
├── package.json                    # Root workspace orchestration scripts
├── README.md                       # Main project documentation & verification guide
├── docs/                           # Engineering design & requirements documentation
│   ├── PRD.md                      # Product Requirements Document (v6.0.0)
│   ├── HLD.md                      # High-Level Architecture & System Design (v6.0.0)
│   ├── LLD.md                      # Low-Level Design & REST API Specifications (v6.0.0)
│   └── PROJECT_ASSESSOR_CHECKLIST.md # Assessor evaluation checklist & demonstration guide
├── examples/                       # Sample OpenAPI Specifications
│   ├── sandbox-openapi.yaml        # Complete OAS 3.0.3 specification for Sandbox API
│   └── sandbox-openapi.json        # JSON equivalent specification
├── scripts/
│   ├── verify-all.js               # Master test runner (Phases 1-5, 70 tests)
│   ├── verify-phase1.js            # Phase 1 dedicated test runner (10 tests)
│   ├── verify-phase2.js            # Phase 2 dedicated test suite (16 tests)
│   ├── verify-phase3.js            # Phase 3 dedicated test suite (14 tests)
│   ├── verify-phase4.js            # Phase 4 dedicated test suite (15 tests)
│   ├── verify-phase5.js            # Phase 5 dedicated test suite (15 tests)
│   └── verify-live-gemini.js       # Live Gemini integration & fallback audit
├── client/                         # Frontend Application (React + Vite + Tailwind CSS)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # Top-level state & service polling
│       ├── services/
│       │   └── socket.js           # Socket.IO client singleton & room subscriber
│       └── components/
│           ├── Header.jsx          # Top navbar with live status & AI Usage modal
│           ├── Sidebar.jsx         # Section navigation with Phase indicators
│           ├── Workspace.jsx       # Tab router, dashboard & live verification console
│           ├── StatusCard.jsx      # Reusable status metric widget
│           ├── SpecWorkspace.jsx   # Master OpenAPI processing workspace
│           ├── SpecUploader.jsx    # Drag-and-drop & browse file uploader
│           ├── SpecOverview.jsx    # Spec metadata, stats & method distribution
│           ├── EndpointList.jsx    # Searchable, filterable endpoint list
│           ├── EndpointDetail.jsx  # Endpoint viewer with tabs (Schema, Generator, Agent)
│           ├── AiTestGenerator.jsx # Single-turn AI test generation (Phase 3)
│           ├── AiAgentInvestigation.jsx # Real-time WebSocket agent streaming panel (Phase 5)
│           ├── EvaluationDashboard.jsx  # LLM evaluation benchmark runner & metrics (Phase 5)
│           └── AiUsageModal.jsx    # Aggregated token usage, cost estimates & call logs
├── server/                         # Backend Orchestrator Service (Node.js + Express)
│   ├── .env.example
│   ├── .env                        # Server environment variables (ignored by Git)
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
│       ├── agent/                  # Autonomous AI Agent Subsystem
│       │   ├── agentTools.js       # Controlled function calling declarations & handlers
│       │   └── agentOrchestrator.js# Bounded multi-step state machine with Socket.IO events
│       ├── execution/              # Test Execution Engine
│       │   └── testRunner.js       # Secure HTTP test runner with boundary checks & assertions
│       ├── diagnosis/              # AI Failure Diagnosis
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
│           └── eval.routes.js      # Evaluation REST routes
└── sandbox-api/                    # Isolated Mock Target Application (Node.js + Express)
    ├── package.json
    └── src/
        ├── server.js
        ├── app.js
        ├── routes/users.routes.js
        └── data/users.data.js
```

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher (v24 tested)
- **Docker & Docker Compose:** For running PostgreSQL + pgvector locally
- **Google Gemini API Key (Optional for live LLM calls):** Can be obtained from [Google AI Studio](https://aistudio.google.com/). Automatic deterministic fallbacks operate if no key is provided.

### 2. Environment Configuration
Create `server/.env` based on `server/.env.example`:
```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
SANDBOX_API_URL=http://localhost:4000

# Google Gemini API Configuration (Optional: system falls back cleanly if unset)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004

# PostgreSQL + pgvector Database Configuration (Docker Compose)
DATABASE_URL=postgresql://testpilot:testpilot_secret@localhost:5433/testpilot?schema=public
POSTGRES_USER=testpilot
POSTGRES_PASSWORD=testpilot_secret
POSTGRES_DB=testpilot
POSTGRES_PORT=5433
```

### 3. Start PostgreSQL with pgvector
```bash
docker compose up -d
```
*Verify container status:*
```bash
docker ps
# Look for testpilot-postgres with healthy status on port 5433
```

### 4. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
npm --prefix sandbox-api install
```

### 5. Start Development Servers
Start all services in separate terminals:
```bash
# Terminal 1: Backend Server with WebSockets (:5000)
npm run dev:server

# Terminal 2: Isolated Mock Sandbox API (:4000)
npm run dev:sandbox

# Terminal 3: React Frontend Dashboard (:5173)
npm run dev:client
```

---

## 🧪 Automated Testing & Verification

| Command | Target Milestone | Tests | Purpose |
| :--- | :--- | :---: | :--- |
| `node scripts/verify-all.js` | **Master Regression Suite** | **70** | Full end-to-end regression across Phases 1–5 |
| `node scripts/verify-phase1.js` | Phase 1 Foundation | 10 | Backend health, error handler, and Sandbox CRUD |
| `node scripts/verify-phase2.js` | Phase 2 OpenAPI Processing | 16 | Upload, YAML/JSON parser, AST validator, security |
| `node scripts/verify-phase3.js` | Phase 3 Gemini Integration | 14 | Function calling, Zod schema validation, token tracker |
| `node scripts/verify-phase4.js` | Phase 4 RAG & Agent | 15 | pgvector search, agent state machine, sandbox execution |
| `node scripts/verify-phase5.js` | Phase 5 WebSockets & Eval | 15 | Socket.IO events, sanitization, benchmark evaluation |
| `node scripts/verify-live-gemini.js`| Live Gemini & Fallback Audit | — | Transparent live Gemini & offline fallback verification |

### Frontend Production Build
```bash
npm --prefix client run build
# Verified: 0 errors, production assets bundled cleanly in ~3.4s
```

---

## 📖 API Endpoint Overview

| Method | Endpoint | Subsystem | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Foundation | Basic service health, uptime, and version confirmation |
| `POST`| `/api/specs/upload` | OpenAPI | Upload and parse OpenAPI 3.0/3.1 YAML/JSON (2 MB limit) |
| `GET` | `/api/specs/current` | OpenAPI | Retrieve currently loaded specification metadata & stats |
| `GET` | `/api/specs/endpoints/:id` | OpenAPI | Inspect detailed endpoint contract, parameters & responses |
| `POST`| `/api/specs/load-sample` | OpenAPI | Load built-in sandbox mock OpenAPI specification |
| `POST`| `/api/ai/generate-tests` | AI Synthesis | Generate positive, negative, and boundary test cases |
| `GET` | `/api/ai/usage` | AI Synthesis | Get aggregated token usage, cost estimates & call counts |
| `POST`| `/api/ai/agent/run` | Autonomous Agent| Launch multi-step RAG investigation with WebSocket streaming |
| `GET` | `/api/ai/agent/runs/:id` | Autonomous Agent| Retrieve historical agent run record, trace steps & findings |
| `POST`| `/api/tests/execute` | Test Runner | Execute test suite against sandbox with boundary isolation |
| `GET` | `/api/evaluations/datasets` | Evaluation | List available ground-truth benchmark datasets |
| `GET` | `/api/evaluations/datasets/:id` | Evaluation | Retrieve full 16-case benchmark dataset specification |
| `POST`| `/api/evaluations/run` | Evaluation | Execute benchmark evaluation and calculate quality metrics |
| `GET` | `/api/evaluations/runs/:id` | Evaluation | Fetch completed evaluation run with case comparisons |
| `GET` | `/api/evaluations/summary` | Evaluation | Aggregated performance metrics across evaluation runs |

---

## 🖼️ User Interface & Dashboard Overview

```
+------------------------------------------------------------------------------------+
|  [TestPilot]   Backend: Online (:5000)   Sandbox: Online (:4000)   [AI Usage: $0.00]|
+------------------------------------------------------------------------------------+
| SIDEBAR         | WORKSPACE DASHBOARD                                              |
|                 |                                                                  |
| • Dashboard     |  +-------------------------+  +-------------------------------+  |
| • OpenAPI Specs |  | Spec: Sandbox Mock API  |  | Active Endpoints: 4           |  |
| • LLM Generator |  +-------------------------+  +-------------------------------+  |
| • AI Agent      |                                                                  |
| • Sandbox       |  AI Agent Live Investigation Panel (WebSocket Stream)            |
| • Diagnostics   |  +------------------------------------------------------------+  |
| • LLM Evaluation|  | [WebSocket Connected] Room: agent_1794939...                |  |
| • Documentation |  | Live Tests: 3 Run   |   Passed: 2   |   Failed: 1          |  |
|                 |  | Step: Executing sandbox test 2/3: Missing parameter (400)  |  |
|                 |  +------------------------------------------------------------+  |
+------------------------------------------------------------------------------------+
```
*(Visual interface is rendered dynamically in React at `http://localhost:5173`)*

---

## 🔒 Security Architecture & Defensive Safeguards

1. **External Reference Rejection:** The OpenAPI parser recursively inspects all `$ref` entries and explicitly rejects remote URLs (`http://`, `https://`) and external files, preventing SSRF and arbitrary local file disclosure.
2. **Strict Sandbox Boundary Isolation:** The test execution engine strictly isolates HTTP calls to the configured sandbox origin (`:4000`). Attempts to execute tests targeting external URLs, traversal sequences (`..`), or unlisted endpoints are rejected with a security violation error.
3. **Recursive Credential Masking:** All WebSocket event payloads pass through `sanitizePayload()`, replacing API keys, passwords, and tokens with `[REDACTED]` and masking Google API key strings.
4. **Parameterized SQL Queries:** All PostgreSQL queries (including pgvector similarity comparisons) use numbered query parameters (`$1`, `$2`), completely preventing SQL injection.
5. **Prompt Injection Defense:** External OpenAPI specifications are treated strictly as data, wrapped in unambiguous XML boundaries, and validated against Zod schemas.

---

## ⚙️ Google Gemini Configuration & Fallback Policy

- TestPilot uses the official `@google/genai` JavaScript SDK for Google Gemini 2.5 Flash and `text-embedding-004`.
- If a valid `GEMINI_API_KEY` is provided in `server/.env`, the system executes live calls to Google AI APIs.
- If `GEMINI_API_KEY` is absent or invalid, the system automatically activates its **deterministic fallback engine**:
  - Deterministic 768-dimensional vector generator ensures pgvector search operates with 100% mathematical consistency.
  - Deterministic test generator creates contract-conforming positive, negative, and boundary tests.
  - Offline benchmark evaluations execute with 100% reproducibility.
  - The system **never fabricates live success** or hides missing configuration.

---

## 📄 License
MIT License. Created for the college Project Assessor evaluation baseline.

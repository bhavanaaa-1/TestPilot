# TestPilot

> AI-assisted API testing platform for automated OpenAPI ingestion, context-aware test scenario generation, sandboxed execution, and root-cause failure analysis.

TestPilot is a developer platform designed to accelerate API validation. By combining OpenAPI schema parsing, Retrieval-Augmented Generation (RAG) backed by PostgreSQL vector storage, and an autonomous multi-step agent loop, TestPilot inspects API endpoints, synthesizes targeted positive, negative, and boundary test suites, executes them against an isolated sandbox environment, and analyzes unexpected status codes and payload mismatches in real time.

---

## The Problem

Traditional API quality assurance often relies on hand-crafted request suites and static assertions:
- **Manual Overhead:** Authoring and maintaining test suites across dozens of evolving endpoints is time-consuming and error-prone.
- **Incomplete Edge-Case Coverage:** Human-authored suites frequently overlook schema boundary limits, invalid types, and malformed payload scenarios.
- **Tightly Coupled Execution:** Testing directly against staging or production systems risks unexpected data mutations and state corruption.
- **Opaque Failure Diagnostics:** When an assertion fails, developers must manually cross-reference request payloads, schema definitions, and server logs to determine the root cause.

## The TestPilot Approach

TestPilot automates the end-to-end testing workflow:
1. **Schema-Driven Context:** Ingests OpenAPI 3.0 and 3.1 specifications (JSON/YAML) and extracts paths, parameters, schemas, and security requirements.
2. **Context-Aware Retrieval:** Chunks endpoint documentation into dense vector embeddings indexed in PostgreSQL using `pgvector` for similarity matching.
3. **Structured Test Generation:** Leverages Google Gemini models to generate schema-compliant test cases categorized into positive, negative, boundary, and edge scenarios, validated strictly with Zod schemas.
4. **Isolated Sandboxed Execution:** Dispatches HTTP requests exclusively against a sandboxed API runtime, enforcing origin bounds and path traversal protection.
5. **Automated Root-Cause Explanation:** Evaluates response status codes and body assertions, feeding discrepancies into a diagnosis engine that correlates expected vs. actual outcomes.
6. **Real-Time Visibility:** Streams lifecycle transitions and tool calls to a responsive dark-themed dashboard over WebSockets.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 18 + Vite)"]
        UI["TestPilot Dashboard UI"]
        WSClient["Socket.IO Client"]
    end

    subgraph Server["Backend Server (Express)"]
        Upload["OpenAPI Ingestion & Validation"]
        Parser["Parser & Endpoint Extractor"]
        Chunker["Documentation Chunker"]
        RAG["Retrieval Engine (Cosine Similarity)"]
        AI["AI Service (Gemini SDK / Fallback)"]
        Agent["ReAct Agent Orchestrator"]
        Runner["Test Execution Engine"]
        Diag["Failure Explainer"]
        WSServer["Socket.IO Event Gateway"]
    end

    subgraph Data["Persistence & Vector Layer"]
        PG["PostgreSQL 16 + pgvector"]
        MemFallback["In-Memory Vector Store Fallback"]
    end

    subgraph Target["Execution Environment"]
        Sandbox["Sandbox REST API (Express)"]
    end

    UI -->|"Upload Spec (JSON/YAML)"| Upload
    Upload --> Parser
    Parser --> Chunker
    Chunker -->|"768-dim Embeddings"| PG
    Chunker -.->|"Offline Fallback"| MemFallback
    UI -->|"Trigger Investigation"| Agent
    Agent -->|"Context Search"| RAG
    RAG --> PG
    Agent -->|"Generate Scenarios"| AI
    Agent -->|"Run Tests"| Runner
    Runner -->|"HTTP Requests"| Sandbox
    Sandbox -->|"HTTP Responses"| Runner
    Runner -->|"Assertion Failures"| Diag
    Diag --> Agent
    Agent -->|"Stream Events"| WSServer
    WSServer -->|"Real-time Updates"| WSClient
```

### End-to-End Workflow

1. **Specification Ingestion:** The developer uploads an OpenAPI specification (JSON or YAML). The parser enforces a 2 MB size cap, checks OpenAPI 3.0/3.1 conformance, rejects external `$ref` pointers, and extracts endpoint operations into stable IDs.
2. **RAG Indexing:** Endpoint summaries, parameter definitions, and request/response schemas are chunked and converted into 768-dimensional embeddings using Google's `text-embedding-004` model. Embeddings are stored in PostgreSQL via `pgvector` with HNSW cosine indexing (or an in-memory cosine fallback index).
3. **AI-Assisted Test Generation:** The agent queries RAG context for the selected endpoint and prompts Gemini to produce positive, negative, and edge test scenarios. The payload is validated against a strict Zod schema (`TestCaseSchema`).
4. **Sandboxed Execution:** The execution engine resolves target routes, validates that requests stay within the sandbox origin, and dispatches HTTP requests to the local sandbox API.
5. **Comparison & Failure Diagnosis:** Expected vs. actual status codes and payloads are diffed. Failures are processed by the failure explanation engine to generate hypothesis-labeled root-cause analyses.
6. **Real-Time Event Streaming:** An 8-stage state machine broadcasts agent events (`agent:started`, `agent:step`, `agent:tool-called`, `agent:retrieval-completed`, `agent:test-started`, `agent:test-completed`, `agent:diagnosis`, `agent:completed`) to the client over Socket.IO.
7. **Benchmark Evaluation:** An automated evaluation module tests generated test cases against a deterministic 16-case benchmark suite, computing status accuracy, boundary coverage, and composite quality scores.

---

## Key Features

- **Multi-Format OpenAPI Ingestion:** Supports OpenAPI 3.0.x and 3.1.x in both JSON and YAML formats with structural schema validation and error feedback.
- **RAG-Augmented Vector Search:** Fast cosine similarity retrieval across indexed endpoints using PostgreSQL 16 + `pgvector` and 768-dimensional embeddings.
- **Autonomous Agent Orchestrator:** Bounded ReAct-style agent loop with strict iteration limits (max 10 turns), tool authorization checks, and execution timeouts.
- **Categorized Test Generation:** Creates distinct test categories:
  - *Positive:* Valid requests verifying successful 2xx responses.
  - *Negative:* Malformed or unauthorized requests verifying 4xx responses.
  - *Boundary & Edge:* Min/max constraints, empty payloads, and unexpected parameter types.
- **Strict Schema Enforcement:** All generated test cases are checked at runtime with Zod to prevent malformed structures from entering execution queues.
- **Automated Root-Cause Analysis:** Combines deterministic heuristic rules with LLM explanations to isolate why an API request failed.
- **Real-Time WebSocket Stream:** Ephemeral investigation rooms with client subscriptions, lifecycle events, and automatic token/credential sanitization.
- **Standardized Evaluation Benchmark:** Built-in evaluation dataset (`benchmark-v1.json`) for quantitative scoring of test generation quality without manual review.
- **Dark-Themed Dashboard:** React 18 interface with interactive endpoint exploration, live agent logs, test execution viewers, and token consumption tracking.

---

## Technology Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React | Single-page application dashboard and real-time inspector |
| **Real-Time Comm** | Socket.IO Client / Server | WebSocket event streaming and run subscription rooms |
| **Backend API** | Node.js, Express 4, Multer, js-yaml | REST API server, upload processing, and pipeline coordination |
| **AI Integration** | Google GenAI SDK (`@google/genai`), Gemini 2.5 Flash | Test scenario generation, failure diagnosis, and bounded tool loop |
| **Embedding Model** | `text-embedding-004` (768 dimensions) | High-density semantic vector representation of API documentation |
| **Vector Database** | PostgreSQL 16 + pgvector, Prisma ORM | Relational entities, persistent chunk storage, and HNSW cosine vector search |
| **Validation** | Zod | Runtime schema validation for AI payloads and execution results |
| **Target Sandbox** | Node.js, Express 4 | Controlled local REST API exposing sample CRUD operations for safe testing |
| **Infrastructure** | Docker Compose, npm workspaces | Multi-service orchestration and local database virtualization |

---

## Project Structure

```
TestPilot/
├── client/                     # React 18 + Vite frontend application
│   ├── src/components/         # Dashboard views, uploader, agent trace, eval reports
│   ├── src/services/socket.js  # Socket.IO client service
│   ├── index.html              # HTML entrypoint
│   ├── tailwind.config.js      # Tailwind configuration
│   └── vite.config.js          # Vite build configuration
├── server/                     # Express backend API & agent orchestrator
│   ├── prisma/schema.prisma    # Relational and vector database schema
│   ├── src/agent/              # ReAct agent loop, tool handlers, bounded limits
│   ├── src/diagnosis/          # Failure explanation and evidence correlation
│   ├── src/eval/               # Evaluation framework and benchmark dataset
│   ├── src/execution/          # Sandboxed HTTP test runner and security checks
│   ├── src/rag/                # Chunker, embedding service, and pgvector store
│   ├── src/routes/             # Express API routes (specs, ai, rag, tests, eval)
│   ├── src/services/           # Gemini SDK service, OpenAPI parser, spec store
│   ├── src/socket/             # Socket.IO event gateway and payload sanitization
│   └── .env.example            # Backend environment template
├── sandbox-api/                # Isolated target REST API for safe test execution
│   ├── src/data/users.data.js  # In-memory mock data store
│   ├── src/routes/users.routes # Sample CRUD routes (GET, POST, DELETE)
│   └── .env.example            # Sandbox environment template
├── docs/                       # Project architecture and technical specifications
│   ├── PRD.md                  # Product Requirements Document
│   ├── HLD.md                  # High-Level Architecture Design
│   ├── LLD.md                  # Low-Level Component Design & Database Schema
│   └── PROJECT_ASSESSOR_CHECKLIST.md # Verification checklist & assessment rubric
├── examples/                   # Sample OpenAPI test specifications
│   ├── sandbox-openapi.json    # OpenAPI 3.0.3 sample spec (JSON)
│   └── sandbox-openapi.yaml    # OpenAPI 3.0.3 sample spec (YAML)
├── scripts/                    # Automated regression verification test suites
│   ├── verify-phase1.js        # Foundation & Sandbox API tests
│   ├── verify-phase2.js        # OpenAPI parsing & validation tests
│   ├── verify-phase3.js        # AI test generation tests
│   ├── verify-phase4.js        # RAG, vector search & agent orchestration tests
│   ├── verify-phase5.js        # WebSocket streaming & benchmark evaluation tests
│   ├── verify-live-gemini.js   # Live Gemini API verification script
│   └── verify-all.js           # Master verification runner (70 tests)
├── docker-compose.yml          # PostgreSQL 16 + pgvector container definition
├── init.sql                    # Database extension initialization script
├── package.json                # Root monorepo workspace configuration
└── README.md                   # Project documentation
```

---

## Installation & Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Docker & Docker Compose:** Required for PostgreSQL with pgvector (optional if using in-memory vector fallback)
- **Google Gemini API Key:** Optional for live AI features; an offline deterministic fallback is built in for development and evaluation without credentials

### 1. Clone the Repository

```bash
git clone https://github.com/bhavanaaa-1/TestPilot.git
cd TestPilot
```

### 2. Install Workspace Dependencies

Install dependencies across all monorepo workspaces (`client`, `server`, and `sandbox-api`):

```bash
npm run install:all
```

### 3. Configure Environment Variables

Create local `.env` files from the provided templates.

**On Windows (PowerShell):**
```powershell
Copy-Item server/.env.example server/.env
Copy-Item sandbox-api/.env.example sandbox-api/.env
```

**On macOS / Linux:**
```bash
cp server/.env.example server/.env
cp sandbox-api/.env.example sandbox-api/.env
```

Edit `server/.env` to configure your settings:

```ini
# Server Network
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
SANDBOX_API_URL=http://localhost:4000

# Google Gemini API (leave as placeholder to use deterministic fallback)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004

# PostgreSQL + pgvector (Docker Compose default)
DATABASE_URL=postgresql://testpilot:testpilot_secret@localhost:5433/testpilot?schema=public
```

### 4. Start PostgreSQL with pgvector

Launch the database container using Docker Compose:

```bash
docker compose up -d
```

Verify that the container is healthy:

```bash
docker compose ps
```

*Note: If Docker is unavailable, TestPilot will automatically fall back to its internal in-memory vector store.*

---

## Running the Application

To run the complete TestPilot platform locally, start the three services in **separate terminal windows**:

### Terminal 1: Backend Server & WebSocket Gateway

```bash
npm run dev:server
```
*Runs the Express API and Socket.IO server at `http://localhost:5000`.*

### Terminal 2: Sandbox API

```bash
npm run dev:sandbox
```
*Runs the mock target API at `http://localhost:4000`.*

### Terminal 3: Frontend Client

```bash
npm run dev:client
```
*Runs the Vite development server. Open `http://localhost:5173` in your browser.*

### Service Port Summary

| Service | Port | Description |
| :--- | :--- | :--- |
| **Frontend UI** | `5173` | React single-page dashboard (`http://localhost:5173`) |
| **Backend Server** | `5000` | Express REST API & Socket.IO server (`http://localhost:5000`) |
| **Sandbox API** | `4000` | Target mock API for HTTP test execution (`http://localhost:4000`) |
| **PostgreSQL** | `5433` | Host port mapped to PostgreSQL container port `5432` |

---

## Testing & Verification

TestPilot includes a comprehensive regression testing suite written in Node.js that exercises every layer of the platform without external test harness dependencies.

### Running Regression Tests

Execute all verification suites via the master runner:

```bash
npm test
```
*Or run individual phase suites:*

```bash
npm run verify:phase1   # Phase 1: Foundation, Health Check & Sandbox CRUD (10 tests)
npm run verify:phase2   # Phase 2: OpenAPI Parsing, Validation & Error Handling (16 tests)
npm run verify:phase3   # Phase 3: AI Test Generation, Zod Schema & Fallback (14 tests)
npm run verify:phase4   # Phase 4: RAG Chunking, pgvector Search & Agent Orchestrator (15 tests)
npm run verify:phase5   # Phase 5: WebSockets, Lifecycle Events & Evaluation Suite (15 tests)
```

### Production Client Build

Validate the React frontend bundle compilation:

```bash
npm run build:client
```

### Test Scope Distinction

The test suites span multiple validation layers:
- **Mocked & In-Memory Tests:** Verifies chunking algorithms, Zod schema constraints, and in-memory vector similarity calculations.
- **Deterministic Fallback Tests:** Tests the AI service and embedding pipeline using normalized, reproducible hash vectors when `GEMINI_API_KEY` is not set.
- **Database Integration Tests:** Connects to PostgreSQL and verifies `pgvector` extension loading, HNSW index usage, and parameterized cosine similarity queries.
- **Sandbox HTTP Execution Tests:** Boots real HTTP servers on ephemeral ports, dispatches live HTTP requests, and verifies status codes, timeouts, and error handling.
- **Live Gemini Verification:** An opt-in script (`npm run verify:live`) that verifies real network calls to Google's Gemini API when a valid `GEMINI_API_KEY` is present.

*Latest reported local verification: **70 / 70 tests passed**.*

---

## API Reference

The backend exposes a modular REST API mounted under `/api` (with `/health` accessible at both root and `/api/health`):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health check, uptime, and service status |
| `POST` | `/api/specs/upload` | Upload and validate an OpenAPI specification file (JSON/YAML, max 2 MB) |
| `GET` | `/api/specs/current` | Retrieve the currently parsed OpenAPI specification metadata and endpoints |
| `GET` | `/api/specs/endpoints/:id` | Retrieve detailed operations, parameters, and schemas for a specific endpoint |
| `POST` | `/api/specs/load-sample` | Convenience endpoint to load the bundled sandbox OpenAPI sample specification |
| `POST` | `/api/ai/generate-tests` | Generate categorized test cases for an endpoint using Gemini or fallback |
| `POST` | `/api/ai/agent/run` | Launch a multi-step autonomous investigation run for an endpoint |
| `GET` | `/api/ai/agent/runs/:id` | Fetch the execution status, tool traces, and final report of an agent run |
| `GET` | `/api/ai/usage` | Inspect aggregated Gemini token usage and estimated API cost metrics |
| `POST` | `/api/tests/execute` | Execute an array of test cases against the sandbox API and record results |
| `GET` | `/api/tests/runs/:id` | Retrieve the results and assertions of a recorded test execution run |
| `GET` | `/api/rag/status` | Retrieve vector store health, backend type (`pgvector` or in-memory), and chunk count |
| `POST` | `/api/rag/reindex` | Re-chunk and re-embed the currently loaded OpenAPI specification |
| `POST` | `/api/rag/query` | Execute a cosine-similarity search against indexed API documentation chunks |
| `GET` | `/api/evaluations/datasets` | List available evaluation benchmark datasets |
| `POST` | `/api/evaluations/run` | Execute benchmark evaluation suite and compute quantitative quality metrics |
| `GET` | `/api/evaluations/summary` | Retrieve aggregated evaluation statistics across all benchmark runs |

---

## Security Architecture

TestPilot implements defensive safeguards across every ingestion and execution boundary:

- **Upload Size Limit:** Multer enforces a strict 2 MB cap on uploaded OpenAPI specifications, preventing memory exhaustion attacks.
- **External Reference Rejection:** The OpenAPI parser recursively scans specifications and rejects documents containing external `$ref` URIs (e.g., `http://`, `https://`, file system paths), mitigating Server-Side Request Forgery (SSRF).
- **Execution Target Isolation:** The HTTP execution runner restricts requests strictly to the configured sandbox origin (`SANDBOX_API_URL`). Arbitrary target URLs and path traversal sequences (`..`, `\`) are blocked before dispatch.
- **Parameterized SQL Queries:** All vector similarity searches and database interactions use parameterized queries (`$1, $2`) via Prisma and native clients to prevent SQL injection.
- **WebSocket Credential Sanitization:** All outgoing WebSocket event payloads are recursively sanitized to redact Google API keys (`AIzaSy...`) and sensitive fields (`password`, `token`, `secret`, `authorization`).
- **Runtime Schema Validation:** All AI-generated test scenarios are validated against Zod schemas before being executed or returned to clients, ensuring malformed payloads cannot cause runtime crashes.
- **Environment Isolation:** Sensitive credentials and keys are loaded via environment variables; local `.env` files are excluded from version control via `.gitignore`.

---

## Current Limitations & Notes

- **In-Memory Specification Cache:** The currently loaded OpenAPI specification is held in application memory. Restarting the backend server clears the active specification; simply re-upload or click *Load Sample Spec* in the UI to reload it.
- **Execution Boundary:** By design, the test runner dispatches requests only to the designated sandbox API (`localhost:4000`) and will not execute arbitrary external API targets.
- **Live Gemini Availability:** Live text generation and 768-dimensional embeddings require a valid `GEMINI_API_KEY` and active internet connectivity. In the absence of an API key, the platform automatically utilizes a deterministic fallback mode that produces normalized, reproducible test suites and vectors for offline development.
- **Local Database Scope:** The PostgreSQL + pgvector setup is configured for local development via Docker Compose and has not been tuned or hardened for multi-tenant production hosting.
- **No Production Claim:** TestPilot is an engineering platform and prototype demonstrating AI agent workflows; it is not currently packaged as a production SaaS application.

---

## Project Documentation

Detailed technical documentation is available in the [`docs/`](docs/) directory:

- [Product Requirements Document (PRD)](docs/PRD.md) — Functional requirements, user stories, and acceptance criteria.
- [High-Level Architecture (HLD)](docs/HLD.md) — System architecture diagrams, component interactions, and data flows.
- [Low-Level Design (LLD)](docs/LLD.md) — Database schema, API specifications, and service algorithms.
- [Project Assessor Checklist](docs/PROJECT_ASSESSOR_CHECKLIST.md) — Evaluation guide and step-by-step verification checklist.

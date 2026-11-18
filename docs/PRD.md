# TestPilot — Product Requirements Document (PRD)

**Project Name:** TestPilot  
**Project Subtitle:** AI-Powered API Testing Assistant  
**Evaluation Scope:** College Project Assessor Evaluation  
**Current Milestone:** Phase 6: Final Hardening & Project Assessor Readiness  
**Document Version:** 6.0.0  
**Status:** Approved for Phase 6 Final Milestone  

---

## 1. Executive Summary

Modern software architectures rely heavily on RESTful APIs. However, API testing remains bottlenecked by manual test authoring, incomplete boundary case coverage, opaque agent workflows, and lack of objective model evaluation. **TestPilot** is an intelligent developer assistant designed to automate the entire API testing lifecycle:
1. **Spec Ingestion (Phase 2 - Complete):** Ingest, validate, and inspect industry-standard OpenAPI (OAS 3.0 & 3.1) specifications in JSON and YAML formats.
2. **AI Test Synthesis (Phase 3 - Complete):** Synthesize structured test suites (positive/happy path, negative assertions, edge/boundary conditions) via Google's Gemini API with real function calling, strict Zod schema validation, and prompt injection defense.
3. **RAG & Vector Retrieval (Phase 4 - Complete):** Semantic chunking of OpenAPI specifications, 768-dimensional text embeddings (`text-embedding-004`), PostgreSQL + pgvector storage with cosine similarity search and in-memory fallback.
4. **Autonomous AI Testing Agent (Phase 4 - Complete):** Multi-step bounded agent workflow (max 10 turns) with tool use (`retrieve_api_context`, `inspect_endpoint`, `execute_test_case`, `get_test_execution_results`), explicit state transitions, and execution trace recording.
5. **Sandbox Test Execution Engine (Phase 4 - Complete):** Secure HTTP test execution against isolated sandbox API environments (`http://localhost:4000`), strict URL/path boundaries, timeout and size caps, and expected vs actual condition evaluation.
6. **AI Failure Diagnostics (Phase 4 - Complete):** Evidence-backed failure explanations, hypothesis disclaimers, and suggested remediations.
7. **Real-Time WebSockets (Phase 5 - Complete):** Full-duplex WebSocket streaming using Socket.IO on the existing Express HTTP server (`:5000`), providing real-time visibility into agent state transitions, live pass/fail counters, streaming test results, and automatic payload sanitization.
8. **LLM Evaluation Framework (Phase 5 - Complete):** Version-controlled ground-truth benchmark datasets (16 cases across all sandbox endpoints), deterministic rule-based metric calculations (Schema Validity, Endpoint Accuracy, Method Accuracy, Status Accuracy, Category Coverage), PostgreSQL persistence, and an interactive evaluation dashboard.
9. **Final Hardening & Assessor Readiness (Phase 6 - Complete):** 70/70 master regression tests, security audit, database reliability verification, transparent Gemini audit, and assessor evaluation guide.

### Milestone Scope Notice
> **Important Note for Project Assessors:**  
> This deliverable represents **Phase 6: Final Hardening & Project Assessor Readiness**. All features across Phases 1 through 5 are fully operational, tested with 70 automated regression tests passing with 100% success rate, audited for security and credential protections, and documented for assessor evaluation. CI/CD automation pipelines and distributed execution are slated for future post-evaluation releases.

---

## 2. Problem Statement & Motivation

1. **Lack of Visibility in Agentic LLM Workflows:** Multi-step autonomous agents can take several seconds to execute. Without real-time streaming, users experience a "black box" spinner. TestPilot solves this with granular WebSocket state broadcasts.
2. **Subjective and Non-Reproducible Model Evaluation:** Standard LLM evaluations often rely on LLM-as-a-judge approaches, which suffer from non-deterministic scoring and bias. TestPilot introduces a deterministic, rule-based benchmark evaluation engine based on mathematical formulas and ground-truth specs.
3. **Execution Gap in Existing Tools:** Most AI testing tools generate tests but leave execution, assertion checking, and failure triage as manual tasks. TestPilot bridges this with an automated, sandboxed execution engine.
4. **Context Window Limitations in OpenAPI Specs:** Large API documents overwhelm standard LLM prompts. TestPilot's RAG architecture semantically chunks specifications and retrieves top-K relevant contracts via cosine similarity search.
5. **Security & Sensitive Data Exposure:** Emitting raw agent traces over WebSockets risks broadcasting API keys or credentials. TestPilot enforces automated recursion-depth-safe payload sanitization.

---

## 3. Product Vision & Phased Roadmap

| Phase | Milestone Name | Status | Key Deliverables |
|---|---|---|---|
| **Phase 1** | **Project Foundation** | **COMPLETE** | Monorepo structure, React+Vite frontend with dark dashboard, Express backend with `/health`, isolated Express Sandbox API with `/users` CRUD endpoints, full PRD/HLD/LLD documentation. |
| **Phase 2** | **OpenAPI Specification Processing** | **COMPLETE** | OpenAPI 3.0 & 3.1 parser/validator, JSON & YAML upload with Multer (2 MB limit), content-level verification, external `$ref` rejection, endpoint extraction with stable IDs, interactive spec workspace UI, sample Sandbox API spec (`examples/`). |
| **Phase 3** | **AI Integration & Intelligent Test Generation** | **COMPLETE** | Official `@google/genai` SDK integration, bounded function calling loop (3 tools), prompt injection defense, strict Zod validation schema, in-memory token & cost tracking, category filters (Positive, Negative, Boundary), AI Usage modal. |
| **Phase 4** | **RAG, Multi-Step AI Agent & Test Execution** | **COMPLETE** | Docker Compose PostgreSQL with pgvector, semantic OpenAPI chunker, 768-dim embedding service, vector store with cosine similarity, multi-step agent orchestrator (bounded 10 turns), 4 controlled agent tools, sandboxed HTTP test runner, expected vs actual assertion evaluator, AI failure diagnosis with evidence citing, full investigation frontend UI. |
| **Phase 5** | **WebSockets & LLM Evaluation Sets** | **COMPLETE** | Express HTTP + Socket.IO server, 9 real-time lifecycle events, room subscriptions, client reconnection handling, automated payload sanitization, 16-case benchmark dataset (`benchmark-v1.json`), deterministic metric calculations (Schema, Endpoint, Method, Status, Category), REST evaluation routes, PostgreSQL persistence, and interactive evaluation dashboard. |
| **Phase 6** | **Final Hardening & Project Assessor Readiness** | **COMPLETE** | Full 70-test master regression suite, isolated per-phase runners, security audit, database reliability verification, transparent Gemini audit, and assessor evaluation guide. |

---

## 4. Phase 5 Detailed Requirements

### 4.1 Real-Time Communication (Socket.IO)
- **Single Server Architecture:** Socket.IO mounted directly onto the existing Express HTTP server on port `5000` via `http.createServer(app)`.
- **Room Subscriptions:** Clients subscribe via `join-investigation` with `{ runId }` and unsubscribe via `leave-investigation`. Malformed identifiers must be rejected with `{ success: false, error: '...' }`.
- **9 Core Lifecycle Events:**
  1. `agent:started`: Emitted upon agent initialization.
  2. `agent:step`: Emitted on every turn/step transition.
  3. `agent:tool-called`: Emitted when agent invokes an autonomous tool.
  4. `agent:retrieval-completed`: Emitted after RAG context chunk retrieval.
  5. `agent:test-started`: Emitted when a test scenario begins sandbox execution.
  6. `agent:test-completed`: Emitted with runtime execution results and status.
  7. `agent:diagnosis`: Emitted when AI failure analysis completes.
  8. `agent:completed`: Emitted when the investigation finishes with summary report.
  9. `agent:error`: Emitted on unrecoverable execution errors.
- **Payload Sanitization:** Automated redaction of sensitive credentials (`apiKey`, `password`, `token`, `secret`, `AIzaSy...`).
- **Resilience:** Automatic reconnection handling with REST API fallback (`GET /api/ai/agent/runs/:id`).

### 4.2 LLM Evaluation Sets & Deterministic Scoring
- **Curated Benchmark Dataset:** `benchmark-v1.json` containing 16 test cases covering all sandbox endpoints (`GET /users`, `GET /users/{id}`, `POST /users`, `DELETE /users/{id}`) across positive, negative, and boundary scenarios.
- **Deterministic Quality Dimensions:**
  - **Schema Validity ($20\%$):** Compliance with strict Zod schema.
  - **Endpoint Accuracy ($20\%$):** Target URL and path parameter match.
  - **Method Accuracy ($20\%$):** HTTP verb match (`GET`, `POST`, `DELETE`).
  - **Status Accuracy ($25\%$):** Expected response code match against contract.
  - **Category Coverage ($15\%$):** Percentage of requested categories satisfied.
  - **Composite Score Formula:** $\text{Score} = 0.20V + 0.20E + 0.20M + 0.25S + 0.15C$. Passing threshold is $\ge 70.0\%$.
- **Database Persistence:** Persists evaluation runs (`evaluation_runs`) and individual case results (`evaluation_case_results`) in PostgreSQL.

---

## 5. Non-Functional Requirements

- **Zero Client-Side Secret Leakage:** GEMINI_API_KEY and database credentials never exposed to client or emitted over WebSockets.
- **Latency & Performance:** WebSockets connection latency $< 20\text{ms}$; 16-case benchmark evaluation completed $< 2\text{s}$ offline.
- **Stability & Regressions:** Zero regressions across all Phase 1-4 capabilities; 100% pass rate across all 70 master tests.

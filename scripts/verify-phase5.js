/**
 * TestPilot Phase 5 Verification Suite
 * Verifies WebSockets (Socket.IO), Real-Time Agent Events, Sanitization,
 * LLM Evaluation Datasets, Deterministic Scoring Engine, REST Routes, and PostgreSQL Persistence.
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { io: ioClient } = require('socket.io-client');

require('../server/src/config/env');

const serverApp = require('../server/src/app');
const sandboxApp = require('../sandbox-api/src/app');
const { initSocketIO, emitAgentEvent, closeSocketIO, sanitizePayload } = require('../server/src/socket');
const specStore = require('../server/src/services/specStore');
const { parseAndValidateOpenApi } = require('../server/src/services/openApiParser');
const {
  getBenchmarkDataset,
  calculateDeterministicMetrics,
} = require('../server/src/eval/evaluator');
const { initVectorStore, isPgvectorActive } = require('../server/src/rag/vectorStore');

const SERVER_PORT = 5055;
const SANDBOX_PORT = 4055;

let httpServer = null;
let sandboxServer = null;
let ioServer = null;

let passedTests = 0;
let totalTests = 0;

function reportPass(name, details = {}) {
  passedTests++;
  console.log(`✅ PASS | ${name}`);
  if (Object.keys(details).length > 0) {
    console.log(`       Details: ${JSON.stringify(details)}`);
  }
}

function reportFail(name, err) {
  console.error(`❌ FAIL | ${name}`);
  console.error(`       Error: ${err.message}`);
}

async function runPhase5Verification() {
  console.log('\n===============================================================');
  console.log('🧪 TESTPILOT PHASE 5 - WEBSOCKETS & LLM EVALUATION SETS');
  console.log('===============================================================\n');

  // Initialize Vector Store & PostgreSQL connection
  await initVectorStore().catch((err) => {
    console.warn('[WARN] initVectorStore warning:', err.message);
  });

  // Boot HTTP Server with Socket.IO
  await new Promise((resolve) => {
    httpServer = http.createServer(serverApp);
    ioServer = initSocketIO(httpServer);
    httpServer.listen(SERVER_PORT, '127.0.0.1', () => {
      console.log(`[BOOT] Backend Server with Socket.IO listening on http://127.0.0.1:${SERVER_PORT}`);
      resolve();
    });
  });

  // Boot Sandbox API
  await new Promise((resolve) => {
    sandboxServer = sandboxApp.listen(SANDBOX_PORT, '127.0.0.1', () => {
      console.log(`[BOOT] Sandbox API listening on http://127.0.0.1:${SANDBOX_PORT}`);
      resolve();
    });
    sandboxServer.on('error', () => resolve());
  });

  // Load sample specification into specStore
  const sampleYamlPath = path.join(__dirname, '../examples/sandbox-openapi.yaml');
  const sampleBuffer = fs.readFileSync(sampleYamlPath);
  const parsedSpec = await parseAndValidateOpenApi(sampleBuffer, 'sandbox-openapi.yaml');
  specStore.setCurrentSpec(parsedSpec);

  // --- SECTION 1: WEBSOCKET INITIALIZATION & CONNECTION ---
  console.log('\n--- Section 1: Socket.IO Connection & Handshake ---');

  let clientSocket = null;

  totalTests++;
  try {
    clientSocket = ioClient(`http://127.0.0.1:${SERVER_PORT}`, {
      transports: ['polling', 'websocket'],
      forceNew: true,
      reconnection: false,
    });

    const readyData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket.IO connection timeout')), 5000);
      clientSocket.on('connection:ready', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      clientSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert(readyData.socketId, 'Expected socketId in connection:ready payload');
    assert.strictEqual(readyData.serverVersion, '1.0.0-phase5');
    reportPass('Socket.IO client successfully connected and received connection:ready', {
      socketId: readyData.socketId,
      serverVersion: readyData.serverVersion,
    });
  } catch (err) {
    reportFail('Socket.IO client connection handshake', err);
  }

  // --- SECTION 2: ROOM SUBSCRIPTION & VALIDATION ---
  console.log('\n--- Section 2: Room Subscriptions & Lifecycle ---');

  const testRunId = `agent_eval_test_${Date.now()}`;

  totalTests++;
  try {
    const ack = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Subscription timeout')), 3000);
      clientSocket.emit('join-investigation', { runId: testRunId }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    assert.strictEqual(ack.success, true);
    assert.strictEqual(ack.runId, testRunId);
    assert.strictEqual(ack.room, `investigation:${testRunId}`);
    reportPass('Valid investigation room subscription acknowledged', ack);
  } catch (err) {
    reportFail('Valid investigation room subscription', err);
  }

  totalTests++;
  try {
    const errAck = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Rejection timeout')), 3000);
      clientSocket.emit('join-investigation', { runId: 'bad!id$#' }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    assert.strictEqual(errAck.success, false);
    assert(errAck.error.includes('Invalid runId format'));
    reportPass('Invalid runId correctly rejected with error payload', { error: errAck.error });
  } catch (err) {
    reportFail('Invalid runId rejection', err);
  }

  // --- SECTION 3: REAL-TIME EVENT STREAMING & ORDERING ---
  console.log('\n--- Section 3: Real-Time Agent Events & Sequence ---');

  totalTests++;
  try {
    const expectedEvents = [
      'agent:started',
      'agent:step',
      'agent:tool-called',
      'agent:retrieval-completed',
      'agent:test-started',
      'agent:test-completed',
      'agent:diagnosis',
      'agent:completed',
    ];

    const receivedEvents = [];

    const eventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (receivedEvents.length === expectedEvents.length) resolve(receivedEvents);
        else reject(new Error(`Timeout: Received only ${receivedEvents.length}/${expectedEvents.length} events`));
      }, 5000);

      expectedEvents.forEach((evt) => {
        clientSocket.on(evt, (payload) => {
          receivedEvents.push(payload.eventType);
          if (receivedEvents.length === expectedEvents.length) {
            clearTimeout(timeout);
            resolve(receivedEvents);
          }
        });
      });
    });

    // Emit all 8 events in proper lifecycle order
    emitAgentEvent(testRunId, 'agent:started', { endpointMethod: 'GET', endpointPath: '/users' });
    emitAgentEvent(testRunId, 'agent:step', { stepNumber: 1, stepType: 'RETRIEVE_CONTEXT' });
    emitAgentEvent(testRunId, 'agent:tool-called', { toolName: 'retrieve_api_documentation' });
    emitAgentEvent(testRunId, 'agent:retrieval-completed', { chunksRetrieved: 3 });
    emitAgentEvent(testRunId, 'agent:test-started', { testName: 'Valid user retrieval', category: 'positive' });
    emitAgentEvent(testRunId, 'agent:test-completed', { testName: 'Valid user retrieval', status: 'PASSED', durationMs: 12 });
    emitAgentEvent(testRunId, 'agent:diagnosis', { testName: 'Boundary test', likelyReason: 'Boundary mismatch' });
    emitAgentEvent(testRunId, 'agent:completed', { summary: 'Agent investigation complete', status: 'COMPLETED' });

    const results = await eventPromise;
    assert.deepStrictEqual(results, expectedEvents);
    reportPass('Received all 8 agent events in correct chronological order', { count: results.length });
  } catch (err) {
    reportFail('Real-time agent event streaming and ordering', err);
  }

  // --- SECTION 4: PAYLOAD SANITIZATION & SECRET REDACTION ---
  console.log('\n--- Section 4: Event Sanitization & Key Redaction ---');

  totalTests++;
  try {
    const dirtyData = {
      apiKey: 'AIzaSyDemoSecretKeyForTesting12345',
      userSecret: 'super-secret-password-xyz',
      nested: {
        authToken: 'Bearer secret_token_value',
        safeData: 'Public user endpoint info',
        rawKeyInString: 'Call completed with key AIzaSyDemoSecretKeyForTesting12345 successfully',
      },
    };

    const clean = sanitizePayload(dirtyData);

    assert.strictEqual(clean.apiKey, '[REDACTED]');
    assert.strictEqual(clean.userSecret, '[REDACTED]');
    assert.strictEqual(clean.nested.authToken, '[REDACTED]');
    assert.strictEqual(clean.nested.safeData, 'Public user endpoint info');
    assert(!clean.nested.rawKeyInString.includes('AIzaSyDemoSecretKeyForTesting12345'));
    assert(clean.nested.rawKeyInString.includes('[REDACTED_API_KEY]'));

    reportPass('Event payload successfully sanitizes API keys and tokens', {
      redactedFields: ['apiKey', 'userSecret', 'authToken', 'embeddedStringKey'],
    });
  } catch (err) {
    reportFail('Event sanitization and secret redaction', err);
  }

  // --- SECTION 5: BENCHMARK DATASET VALIDATION ---
  console.log('\n--- Section 5: LLM Evaluation Benchmark Dataset ---');

  totalTests++;
  try {
    const dataset = getBenchmarkDataset('benchmark-v1');
    assert(dataset, 'Expected benchmark-v1 dataset to exist');
    assert.strictEqual(dataset.id, 'benchmark-v1');
    assert.strictEqual(dataset.version, '1.0.0');
    assert(dataset.cases.length >= 15, `Expected >= 15 cases, got ${dataset.cases.length}`);

    // Verify all 4 sandbox endpoints are covered
    const endpoints = new Set(dataset.cases.map((tc) => `${tc.endpoint.method} ${tc.endpoint.path}`));
    assert(endpoints.has('GET /users'), 'Missing GET /users coverage');
    assert(endpoints.has('GET /users/{id}'), 'Missing GET /users/{id} coverage');
    assert(endpoints.has('POST /users'), 'Missing POST /users coverage');
    assert(endpoints.has('DELETE /users/{id}'), 'Missing DELETE /users/{id} coverage');

    // Verify categories
    const categories = new Set(dataset.cases.map((tc) => tc.scenarioType));
    assert(categories.has('positive'), 'Missing positive category');
    assert(categories.has('negative'), 'Missing negative category');
    assert(categories.has('boundary'), 'Missing boundary category');

    reportPass('Benchmark dataset v1.0.0 validated with 16 cases across 4 endpoints and 3 categories', {
      totalCases: dataset.cases.length,
      endpointsCovered: Array.from(endpoints),
      categoriesCovered: Array.from(categories),
    });
  } catch (err) {
    reportFail('Benchmark dataset validation', err);
  }

  // --- SECTION 6: DETERMINISTIC METRIC SCORING ENGINE ---
  console.log('\n--- Section 6: Evaluation Metric Calculations ---');

  totalTests++;
  try {
    // Test perfect match case
    const mockEvaluations = [
      {
        caseId: 'tc_1',
        schemaValid: true,
        endpointMatch: true,
        methodMatch: true,
        statusMatch: true,
        categoryMatch: true,
        score: 100,
        passed: true,
      },
      {
        caseId: 'tc_2',
        schemaValid: true,
        endpointMatch: true,
        methodMatch: true,
        statusMatch: true,
        categoryMatch: true,
        score: 100,
        passed: true,
      },
    ];

    const perfectMetrics = calculateDeterministicMetrics(mockEvaluations);
    assert.strictEqual(perfectMetrics.overallScore, 100);
    assert.strictEqual(perfectMetrics.schemaValidity, 100);
    assert.strictEqual(perfectMetrics.expectedStatusAccuracy, 100);
    assert.strictEqual(perfectMetrics.passed, true);

    // Test partial match case (one status mismatch: weight 25% halved)
    const partialEvaluations = [
      {
        caseId: 'tc_1',
        schemaValid: true,
        endpointMatch: true,
        methodMatch: true,
        statusMatch: true,
        categoryMatch: true,
        score: 100,
        passed: true,
      },
      {
        caseId: 'tc_2',
        schemaValid: true,
        endpointMatch: true,
        methodMatch: true,
        statusMatch: false,
        categoryMatch: true,
        score: 75,
        passed: true,
      },
    ];

    const partialMetrics = calculateDeterministicMetrics(partialEvaluations);
    assert.strictEqual(partialMetrics.schemaValidity, 100);
    assert.strictEqual(partialMetrics.expectedStatusAccuracy, 50);
    assert.strictEqual(partialMetrics.overallScore, 87.5);
    assert.strictEqual(partialMetrics.passed, true); // >= 70%

    reportPass('Deterministic evaluation scoring engine correctly applies formula & weights', {
      perfectScore: perfectMetrics.overallScore,
      partialScore: partialMetrics.overallScore,
      thresholdPassing: partialMetrics.passed,
    });
  } catch (err) {
    reportFail('Deterministic metric scoring engine', err);
  }

  // --- SECTION 7: REST API ENDPOINTS FOR EVALUATIONS ---
  console.log('\n--- Section 7: REST API Evaluation Endpoints ---');

  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/datasets`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const list = body.data.datasets || body.data;
    assert(Array.isArray(list));
    assert(list.some((d) => d.id === 'benchmark-v1'));
    reportPass('GET /api/evaluations/datasets returns benchmark datasets', { count: list.length });
  } catch (err) {
    reportFail('GET /api/evaluations/datasets', err);
  }

  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/datasets/benchmark-v1`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, 'benchmark-v1');
    assert.strictEqual(body.data.cases.length, 16);
    reportPass('GET /api/evaluations/datasets/benchmark-v1 returns full dataset', {
      name: body.data.name,
      cases: body.data.cases.length,
    });
  } catch (err) {
    reportFail('GET /api/evaluations/datasets/benchmark-v1', err);
  }

  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/datasets/unknown-dataset`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    reportPass('GET /api/evaluations/datasets/unknown-dataset returns 404 error');
  } catch (err) {
    reportFail('GET /api/evaluations/datasets/unknown 404 handler', err);
  }

  let executedEvalRunId = null;

  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: 'benchmark-v1' }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.data.id, 'Expected id in response');
    assert(body.data.overallScore >= 0, 'Expected numeric overallScore');
    assert.strictEqual(body.data.caseResults.length, 16);

    executedEvalRunId = body.data.id;

    reportPass('POST /api/evaluations/run executes 16-case benchmark and computes metrics', {
      runId: body.data.id,
      overallScore: `${body.data.overallScore}%`,
      casesEvaluated: body.data.caseResults.length,
      passedCases: body.data.passedCases,
    });
  } catch (err) {
    reportFail('POST /api/evaluations/run', err);
  }

  totalTests++;
  try {
    assert(executedEvalRunId, 'Previous test must provide runId');
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/runs/${executedEvalRunId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.id, executedEvalRunId);
    assert.strictEqual(body.data.caseResults.length, 16);
    reportPass('GET /api/evaluations/runs/:id retrieves stored evaluation run', { runId: body.data.id });
  } catch (err) {
    reportFail('GET /api/evaluations/runs/:id', err);
  }

  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/summary`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(body.data.totalRuns >= 1);
    assert(body.data.averageOverallScore >= 0);
    reportPass('GET /api/evaluations/summary returns aggregated evaluation metrics', {
      totalRuns: body.data.totalRuns,
      averageScore: `${body.data.averageOverallScore}%`,
    });
  } catch (err) {
    reportFail('GET /api/evaluations/summary', err);
  }

  // --- SECTION 8: POSTGRESQL PERSISTENCE AUDIT ---
  console.log('\n--- Section 8: PostgreSQL Persistence Audit ---');

  totalTests++;
  try {
    const pgActive = isPgvectorActive();
    assert(pgActive, 'Expected PostgreSQL with pgvector to be active');
    reportPass('PostgreSQL connection with pgvector confirmed active for evaluation persistence', {
      pgvectorActive: pgActive,
    });
  } catch (err) {
    reportFail('PostgreSQL persistence connection check', err);
  }

  // --- SECTION 9: LOCAL END-TO-END AGENT + WEBSOCKET INTEGRATION ---
  console.log('\n--- Section 9: Live Agent + WebSocket Stream + Sandbox End-to-End ---');

  totalTests++;
  try {
    const e2eRunId = `agent_e2e_${Date.now()}`;
    const capturedSteps = [];
    const targetEndpoint = parsedSpec.endpoints[0];

    // Client subscribes to e2e room
    await new Promise((resolve) => {
      clientSocket.emit('join-investigation', { runId: e2eRunId }, resolve);
    });

    const stepListener = (payload) => {
      if (payload && payload.runId === e2eRunId) {
        capturedSteps.push(payload.eventType);
      }
    };
    clientSocket.on('agent:event', stepListener);

    // Trigger Agent Investigation via REST
    const agentRes = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/ai/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: e2eRunId,
        endpointId: targetEndpoint.id,
        objective: 'Test sandbox live endpoint users retrieval',
        categories: ['positive'],
      }),
    });

    const agentData = await agentRes.json();
    assert.strictEqual(agentRes.status, 200);
    assert.strictEqual(agentData.success, true);
    assert.strictEqual(agentData.data.id, e2eRunId);
    assert(agentData.data.executedTests.length > 0);

    // Wait a brief tick for all socket events to settle
    await new Promise((resolve) => setTimeout(resolve, 500));
    clientSocket.off('agent:event', stepListener);

    assert(capturedSteps.length >= 3, `Expected at least 3 streaming events, got ${capturedSteps.length}`);
    assert(capturedSteps.includes('agent:started'), 'Expected agent:started in stream');

    reportPass('End-to-End live Agent execution emitted events over WebSocket, executed against Sandbox, and persisted', {
      runId: e2eRunId,
      eventsStreamed: capturedSteps.length,
      testsExecuted: agentData.data.executedTests.length,
      status: agentData.data.status,
    });
  } catch (err) {
    reportFail('End-to-End Live Agent + WebSocket Integration', err);
  }

  // Clean teardown
  if (clientSocket) {
    clientSocket.disconnect();
  }
  closeSocketIO();
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  if (sandboxServer) {
    await new Promise((resolve) => sandboxServer.close(resolve));
  }

  console.log('\n===============================================================');
  console.log(`🏁 PHASE 5 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase5Verification().catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  });
}

module.exports = { runPhase5Verification };

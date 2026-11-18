/**
 * TestPilot Master Verification Suite
 * Executes complete test suites across Phase 1, Phase 2, and Phase 3 against live Express servers.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const serverApp = require('../server/src/app');
const sandboxApp = require('../sandbox-api/src/app');
const specStore = require('../server/src/services/specStore');
const { parseAndValidateOpenApi } = require('../server/src/services/openApiParser');
const { FUNCTION_DECLARATIONS, executeTool } = require('../server/src/services/geminiTools');
const { validateGeneratedTests } = require('../server/src/schemas/testCase.schema');
const { calculateCost, recordUsage, getUsageStats, clearUsage } = require('../server/src/services/usageStore');
const { setMockGenerator, clearMockGenerator } = require('../server/src/services/geminiService');

// Phase 4 RAG, Agent, and Execution Subsystems
const { chunkSpecification } = require('../server/src/rag/chunker');
const {
  embedText,
  embedChunks,
  setMockEmbeddingGenerator,
  clearMockEmbeddingGenerator,
  generateDeterministicEmbedding,
  EMBEDDING_DIMENSION,
} = require('../server/src/rag/embeddingService');
const {
  storeChunks,
  searchSimilar,
  clearChunks,
} = require('../server/src/rag/vectorStore');
const { retrieveContext } = require('../server/src/rag/retrievalService');
const {
  executeSingleTest,
  executeTestSuite,
  validateTestSecurityAndPath,
  getExecutionRunById,
} = require('../server/src/execution/testRunner');
const { diagnoseTestFailure } = require('../server/src/diagnosis/failureExplainer');
const {
  runAgentInvestigation,
  getAgentRunById,
  AGENT_STATES,
  MAX_AGENT_TURNS,
} = require('../server/src/agent/agentOrchestrator');
const { executeAgentTool, ALLOWED_AGENT_TOOLS } = require('../server/src/agent/agentTools');

// Phase 5 WebSockets and Evaluation Subsystems
const { initSocketIO, emitAgentEvent, closeSocketIO, sanitizePayload } = require('../server/src/socket');
const {
  getBenchmarkDataset,
  calculateDeterministicMetrics,
  listDatasets,
  loadDataset,
} = require('../server/src/eval/evaluator');

const SERVER_PORT = 5000;
const SANDBOX_PORT = 4000;

let serverInstance;
let sandboxInstance;

const testResults = [];

function recordResult(testName, passed, details) {
  testResults.push({ testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} | ${testName}`);
  if (details) {
    console.log(`       Details: ${JSON.stringify(details)}`);
  }
}

async function uploadSpecFile(buffer, filename) {
  const formData = new FormData();
  formData.append('spec', new Blob([buffer]), filename);

  const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runAllTests() {
  console.log('\n==================================================================');
  console.log('🧪 TESTPILOT MASTER VERIFICATION SUITE (PHASES 1, 2, 3, 4, AND 5)');
  console.log('==================================================================\n');

  // Boot servers
  await new Promise((resolve) => {
    serverInstance = http.createServer(serverApp);
    initSocketIO(serverInstance);
    serverInstance.listen(SERVER_PORT, '127.0.0.1', () => {
      console.log(`[BOOT] Backend Server with Socket.IO listening on http://127.0.0.1:${SERVER_PORT}`);
      resolve();
    });
  });

  await new Promise((resolve) => {
    sandboxInstance = sandboxApp.listen(SANDBOX_PORT, '127.0.0.1', () => {
      console.log(`[BOOT] Sandbox API listening on http://127.0.0.1:${SANDBOX_PORT}`);
      resolve();
    });
  });

  console.log('\n========================================');
  console.log('PART 1: PHASE 1 REGRESSION TESTS (10 TESTS)');
  console.log('========================================');

  // 1. GET /health
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/health`);
    const data = await res.json();
    const passed = res.status === 200 && data.status === 'ok' && data.service === 'testpilot-server';
    recordResult('Backend GET /health', passed, { status: res.status, body: data });
  } catch (err) {
    recordResult('Backend GET /health', false, { error: err.message });
  }

  // 2. 404 Centralized Error Handler
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/invalid-endpoint`);
    const data = await res.json();
    const passed = res.status === 404 && data.error && data.error.status === 404;
    recordResult('Backend 404 Centralized Error Handling', passed, { status: res.status });
  } catch (err) {
    recordResult('Backend 404 Centralized Error Handling', false, { error: err.message });
  }

  // 3. Sandbox GET /users
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users`);
    const data = await res.json();
    const passed = res.status === 200 && Array.isArray(data) && data.length >= 3;
    recordResult('Sandbox GET /users (All Users)', passed, { status: res.status, count: data.length });
  } catch (err) {
    recordResult('Sandbox GET /users (All Users)', false, { error: err.message });
  }

  // 4. Sandbox GET /users/:id (Existing)
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users/1`);
    const data = await res.json();
    const passed = res.status === 200 && data.id === '1' && data.name === 'Alice Johnson';
    recordResult('Sandbox GET /users/:id (Existing ID: 1)', passed, { id: data.id, name: data.name });
  } catch (err) {
    recordResult('Sandbox GET /users/:id (Existing ID: 1)', false, { error: err.message });
  }

  // 5. Sandbox GET /users/:id (404)
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users/999`);
    const data = await res.json();
    const passed = res.status === 404 && data.error === 'Not Found';
    recordResult('Sandbox GET /users/:id (Non-existent ID: 999 -> 404)', passed, { status: res.status });
  } catch (err) {
    recordResult('Sandbox GET /users/:id (Non-existent ID: 999 -> 404)', false, { error: err.message });
  }

  // 6. Sandbox POST /users (Valid)
  let createdUserId = null;
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Grace Hopper', email: 'grace.hopper@navy.mil', role: 'developer' }),
    });
    const data = await res.json();
    createdUserId = data.id;
    const passed = res.status === 201 && data.id && data.name === 'Grace Hopper';
    recordResult('Sandbox POST /users (Valid Creation -> 201)', passed, { id: data.id });
  } catch (err) {
    recordResult('Sandbox POST /users (Valid Creation -> 201)', false, { error: err.message });
  }

  // 7. Sandbox POST /users (Validation Failure -> 400)
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'not-an-email' }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error === 'Bad Request';
    recordResult('Sandbox POST /users (Invalid Payload -> 400)', passed, { status: res.status });
  } catch (err) {
    recordResult('Sandbox POST /users (Invalid Payload -> 400)', false, { error: err.message });
  }

  // 8. Sandbox POST /users (Duplicate Email -> 409)
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate Alice', email: 'alice.johnson@example.com' }),
    });
    const data = await res.json();
    const passed = res.status === 409 && data.error === 'Conflict';
    recordResult('Sandbox POST /users (Duplicate Email -> 409 Conflict)', passed, { status: res.status });
  } catch (err) {
    recordResult('Sandbox POST /users (Duplicate Email -> 409 Conflict)', false, { error: err.message });
  }

  // 9. Sandbox DELETE /users/:id (Existing)
  try {
    const targetId = createdUserId || '2';
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users/${targetId}`, { method: 'DELETE' });
    const data = await res.json();
    const passed = res.status === 200 && data.message;
    recordResult(`Sandbox DELETE /users/:id (Target ID: ${targetId} -> 200)`, passed, { status: res.status });
  } catch (err) {
    recordResult('Sandbox DELETE /users/:id (Existing User -> 200)', false, { error: err.message });
  }

  // 10. Sandbox DELETE /users/:id (404)
  try {
    const res = await fetch(`http://localhost:${SANDBOX_PORT}/users/999`, { method: 'DELETE' });
    const data = await res.json();
    const passed = res.status === 404 && data.error === 'Not Found';
    recordResult('Sandbox DELETE /users/:id (Non-existent ID: 999 -> 404)', passed, { status: res.status });
  } catch (err) {
    recordResult('Sandbox DELETE /users/:id (Non-existent ID: 999 -> 404)', false, { error: err.message });
  }

  console.log('\n========================================');
  console.log('PART 2: PHASE 2 OPENAPI TESTS (16 TESTS)');
  console.log('========================================');

  // 11. Initial spec state is null
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/current`);
    const data = await res.json();
    const passed = res.status === 200 && data.success === true && data.data === null;
    recordResult('GET /api/specs/current (Initial state is null)', passed, { status: res.status });
  } catch (err) {
    recordResult('GET /api/specs/current (Initial state is null)', false, { error: err.message });
  }

  // 12. Upload Valid YAML
  let extractedEndpoints = [];
  try {
    const yamlContent = fs.readFileSync(path.join(__dirname, '../examples/sandbox-openapi.yaml'));
    const { status, ok, data } = await uploadSpecFile(yamlContent, 'sandbox-openapi.yaml');
    extractedEndpoints = data.data?.endpoints || [];
    const passed = status === 200 && ok && data.data?.stats?.totalEndpoints === 4;
    recordResult('Upload Valid YAML Specification (sandbox-openapi.yaml)', passed, {
      status,
      endpointsCount: data.data?.stats?.totalEndpoints,
    });
  } catch (err) {
    recordResult('Upload Valid YAML Specification', false, { error: err.message });
  }

  // 13. Endpoint Extraction Completeness
  try {
    const epGetUsers = extractedEndpoints.find((e) => e.method === 'GET' && e.path === '/users');
    const epGetUserById = extractedEndpoints.find((e) => e.method === 'GET' && e.path === '/users/{id}');
    const epPostUsers = extractedEndpoints.find((e) => e.method === 'POST' && e.path === '/users');
    const epDeleteUser = extractedEndpoints.find((e) => e.method === 'DELETE' && e.path === '/users/{id}');
    const passed = epGetUsers && epGetUserById && epPostUsers && epDeleteUser;
    recordResult('Endpoint Extraction Completeness (4 endpoints identified)', passed, {
      endpoints: extractedEndpoints.map((e) => `${e.method} ${e.path}`),
    });
  } catch (err) {
    recordResult('Endpoint Extraction Completeness', false, { error: err.message });
  }

  // 14. GET /api/specs/current (returns active spec)
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/current`);
    const data = await res.json();
    const passed = res.status === 200 && data.data?.info?.title === 'TestPilot Sandbox Mock API';
    recordResult('GET /api/specs/current (Returns loaded spec metadata)', passed, { title: data.data?.info?.title });
  } catch (err) {
    recordResult('GET /api/specs/current', false, { error: err.message });
  }

  // 15. GET /api/specs/endpoints/:id (Existing)
  try {
    const targetId = extractedEndpoints[0]?.id || 'getallusers';
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/endpoints/${targetId}`);
    const data = await res.json();
    const passed = res.status === 200 && data.data?.id === targetId;
    recordResult(`GET /api/specs/endpoints/:id (Fetch ID: ${targetId})`, passed, { status: res.status });
  } catch (err) {
    recordResult('GET /api/specs/endpoints/:id', false, { error: err.message });
  }

  // 16. GET /api/specs/endpoints/:id (404)
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/endpoints/non-existent-endpoint`);
    const data = await res.json();
    const passed = res.status === 404 && data.error?.status === 404;
    recordResult('GET /api/specs/endpoints/:id (Non-existent ID -> 404)', passed, { status: res.status });
  } catch (err) {
    recordResult('GET /api/specs/endpoints/:id', false, { error: err.message });
  }

  // 17. Upload Valid JSON
  try {
    const jsonContent = fs.readFileSync(path.join(__dirname, '../examples/sandbox-openapi.json'));
    const { status, ok, data } = await uploadSpecFile(jsonContent, 'sandbox-openapi.json');
    const passed = status === 200 && ok && data.data?.format === 'json';
    recordResult('Upload Valid JSON Specification (sandbox-openapi.json)', passed, { status, format: data.data?.format });
  } catch (err) {
    recordResult('Upload Valid JSON Specification', false, { error: err.message });
  }

  // 18. Reject Unsupported OpenAPI Version
  try {
    const v2Doc = Buffer.from(JSON.stringify({ swagger: '2.0', info: { title: 'V2', version: '1' }, paths: {} }));
    const { status, data } = await uploadSpecFile(v2Doc, 'v2.json');
    const passed = status === 400 && data.error?.code === 'UNSUPPORTED_VERSION';
    recordResult('Reject Unsupported OpenAPI Version (Swagger 2.0 -> 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Reject Unsupported OpenAPI Version', false, { error: err.message });
  }

  // 19. Reject Invalid JSON Syntax
  try {
    const badJson = Buffer.from('{ "openapi": "3.0.0", invalid }');
    const { status, data } = await uploadSpecFile(badJson, 'bad.json');
    const passed = status === 400 && data.error?.code === 'INVALID_JSON';
    recordResult('Reject Malformed JSON Syntax (Invalid JSON -> 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Reject Malformed JSON Syntax', false, { error: err.message });
  }

  // 20. Reject Invalid YAML Syntax
  try {
    const badYaml = Buffer.from('openapi: 3.0.0\ninfo:\n  title: [unclosed');
    const { status, data } = await uploadSpecFile(badYaml, 'bad.yaml');
    const passed = status === 400 && data.error?.code === 'INVALID_YAML';
    recordResult('Reject Malformed YAML Syntax (Invalid YAML -> 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Reject Malformed YAML Syntax', false, { error: err.message });
  }

  // 21. Reject Missing Required OpenAPI Fields
  try {
    const missingInfo = Buffer.from(JSON.stringify({ openapi: '3.0.0', paths: {} }));
    const { status, data } = await uploadSpecFile(missingInfo, 'no-info.json');
    const passed = status === 400 && data.error?.code === 'MISSING_REQUIRED_FIELD';
    recordResult('Reject Missing Required Fields (Missing info -> 400)', passed, { field: data.error?.field });
  } catch (err) {
    recordResult('Reject Missing Required Fields', false, { error: err.message });
  }

  // 22. Enforce 2 MB File Size Limit
  try {
    const largeBuffer = Buffer.alloc(2.2 * 1024 * 1024, ' ');
    const { status, data } = await uploadSpecFile(largeBuffer, 'large.yaml');
    const passed = status === 400 && data.error?.code === 'FILE_TOO_LARGE';
    recordResult('Enforce 2 MB File Size Limit (Oversized upload -> 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Enforce 2 MB File Size Limit', false, { error: err.message });
  }

  // 23. Reject Unsupported Binary Content
  try {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00]);
    const { status, data } = await uploadSpecFile(binary, 'binary.json');
    const passed = status === 400 && (data.error?.code === 'UNSUPPORTED_FILE_TYPE' || data.error?.code === 'INVALID_JSON');
    recordResult('Reject Unsupported Binary Content (Content inspection -> 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Reject Unsupported Binary Content', false, { error: err.message });
  }

  // 24. Reject External References ($ref remote URL)
  try {
    const extRefDoc = Buffer.from(
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Ext', version: '1.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  schema: { $ref: 'https://example.com/schema.json' },
                },
              },
            },
          },
        },
      })
    );
    const { status, data } = await uploadSpecFile(extRefDoc, 'ext.json');
    const passed = status === 400 && data.error?.code === 'EXTERNAL_REFERENCE_REJECTED';
    recordResult('Reject External References ($ref remote URL -> 400)', passed, { ref: data.error?.ref });
  } catch (err) {
    recordResult('Reject External References', false, { error: err.message });
  }

  // 25. POST /api/specs/load-sample
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/load-sample`, { method: 'POST' });
    const data = await res.json();
    const passed = res.status === 200 && data.success === true && data.data?.stats?.totalEndpoints === 4;
    recordResult('POST /api/specs/load-sample (Built-in sample loader)', passed, { title: data.data?.info?.title });
  } catch (err) {
    recordResult('POST /api/specs/load-sample', false, { error: err.message });
  }

  // 26. Verify Specification Alignment with Sandbox API Routes
  try {
    const resGetUsers = await fetch(`http://localhost:${SANDBOX_PORT}/users`);
    const resGetUser1 = await fetch(`http://localhost:${SANDBOX_PORT}/users/1`);
    const passed = resGetUsers.status === 200 && resGetUser1.status === 200;
    recordResult('Sample Specification Accurately Describes Sandbox API Routes', passed, {
      usersRouteStatus: resGetUsers.status,
      userByIdRouteStatus: resGetUser1.status,
    });
  } catch (err) {
    recordResult('Sample Specification Accurately Describes Sandbox API Routes', false, { error: err.message });
  }

  console.log('\n========================================');
  console.log('PART 3: PHASE 3 AI INTEGRATION TESTS (14 TESTS)');
  console.log('========================================');

  // 27. Function Calling Tool Declarations Schema
  try {
    const toolNames = FUNCTION_DECLARATIONS.map((t) => t.name);
    const hasEndpointsTool = toolNames.includes('get_api_endpoints');
    const hasDetailsTool = toolNames.includes('get_endpoint_details');
    const hasSearchTool = toolNames.includes('search_api_documentation');
    const validParams = FUNCTION_DECLARATIONS.every((t) => t.parameters && t.parameters.type === 'OBJECT');
    const passed = hasEndpointsTool && hasDetailsTool && hasSearchTool && validParams;
    recordResult('Function Calling Tool Declarations Schema', passed, { tools: toolNames });
  } catch (err) {
    recordResult('Function Calling Tool Declarations Schema', false, { error: err.message });
  }

  // 28. Tool Execution: get_api_endpoints
  try {
    const spec = specStore.getCurrentSpec();
    const resultAll = executeTool('get_api_endpoints', {}, spec);
    const passed = resultAll.total === 4 && Array.isArray(resultAll.endpoints);
    recordResult('Tool Execution: get_api_endpoints', passed, { total: resultAll.total });
  } catch (err) {
    recordResult('Tool Execution: get_api_endpoints', false, { error: err.message });
  }

  // 29. Tool Execution: get_endpoint_details
  try {
    const spec = specStore.getCurrentSpec();
    const valid = executeTool('get_endpoint_details', { endpointId: 'createuser' }, spec);
    const invalid = executeTool('get_endpoint_details', { endpointId: 'unknown' }, spec);
    const passed = valid.id === 'createuser' && invalid.error !== undefined;
    recordResult('Tool Execution: get_endpoint_details', passed, { validMethod: valid.method });
  } catch (err) {
    recordResult('Tool Execution: get_endpoint_details', false, { error: err.message });
  }

  // 30. Tool Execution: search_api_documentation
  try {
    const spec = specStore.getCurrentSpec();
    const result = executeTool('search_api_documentation', { query: 'user' }, spec);
    const passed = result.matchCount > 0 && Array.isArray(result.matches);
    recordResult('Tool Execution: search_api_documentation', passed, { matchCount: result.matchCount });
  } catch (err) {
    recordResult('Tool Execution: search_api_documentation', false, { error: err.message });
  }

  // 31. Security: Reject Unauthorized Tool Execution
  try {
    const spec = specStore.getCurrentSpec();
    const unauthorized = executeTool('execute_shell_command', {}, spec);
    const passed = unauthorized.error && unauthorized.error.includes('not recognized or permitted');
    recordResult('Security: Reject Unauthorized Tool Execution', passed, { error: unauthorized.error });
  } catch (err) {
    recordResult('Security: Reject Unauthorized Tool Execution', false, { error: err.message });
  }

  // 32. Zod Schema Validation: Valid Test Case
  try {
    const valid = validateGeneratedTests({
      endpointId: 'createuser',
      endpointPath: '/users',
      method: 'POST',
      tests: [
        {
          id: 'test_createuser_1',
          name: 'Create User',
          description: 'Valid input',
          method: 'POST',
          path: '/users',
          expectedStatus: 201,
          expectedResponse: { description: 'Success' },
          category: 'positive',
        },
      ],
    });
    const passed = valid.success === true;
    recordResult('Zod Schema Validation: Valid Test Case Acceptance', passed, { success: valid.success });
  } catch (err) {
    recordResult('Zod Schema Validation: Valid Test Case Acceptance', false, { error: err.message });
  }

  // 33. Zod Schema Validation: Reject Incomplete Output
  try {
    const invalid = validateGeneratedTests({
      endpointId: 'createuser',
      endpointPath: '/users',
      method: 'POST',
      tests: [{ id: 'incomplete' }],
    });
    const passed = invalid.success === false;
    recordResult('Zod Schema Validation: Rejection of Incomplete Model Output', passed, { rejected: true });
  } catch (err) {
    recordResult('Zod Schema Validation: Rejection of Incomplete Model Output', false, { error: err.message });
  }

  // 34. Prompt Injection Defense
  try {
    const hostileOutput = { hacked: true };
    const validation = validateGeneratedTests(hostileOutput);
    const passed = validation.success === false;
    recordResult('Prompt Injection Defense: Reject Non-Conforming Adversarial Output', passed, { passed: true });
  } catch (err) {
    recordResult('Prompt Injection Defense', false, { error: err.message });
  }

  // 35. Token Cost Calculation
  try {
    clearUsage();
    const cost = calculateCost('gemini-2.5-flash', 1_000_000, 1_000_000);
    const passed = cost.totalCost === 0.375;
    recordResult('Token Cost Calculation (gemini-2.5-flash)', passed, { totalCost: cost.totalCost });
  } catch (err) {
    recordResult('Token Cost Calculation', false, { error: err.message });
  }

  // 36. Usage Monitoring API (GET /api/ai/usage)
  try {
    recordUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 500,
      outputTokens: 300,
      durationMs: 1200,
      endpointId: 'createuser',
      testCount: 3,
      success: true,
    });
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/ai/usage`);
    const data = await res.json();
    const passed = res.status === 200 && data.data?.summary?.totalRequests >= 1;
    recordResult('Usage Monitoring API (GET /api/ai/usage)', passed, { totalRequests: data.data?.summary?.totalRequests });
  } catch (err) {
    recordResult('Usage Monitoring API (GET /api/ai/usage)', false, { error: err.message });
  }

  // 37. Reject Missing endpointId
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/ai/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error?.code === 'MISSING_ENDPOINT_ID';
    recordResult('Reject Missing endpointId (POST /api/ai/generate-tests -> 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Reject Missing endpointId', false, { error: err.message });
  }

  // 38. Reject Invalid endpointId
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/ai/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId: 'unknown-id-xyz' }),
    });
    const data = await res.json();
    const passed = res.status === 404 && data.error?.code === 'ENDPOINT_NOT_FOUND';
    recordResult('Reject Invalid endpointId (Non-existent ID -> 404)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Reject Invalid endpointId', false, { error: err.message });
  }

  // 39. Handle Missing Gemini API Key Gracefully
  try {
    clearMockGenerator();
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/ai/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId: 'createuser', apiKeyOverride: '' }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error?.code === 'GEMINI_API_KEY_MISSING';
    recordResult('Handle Missing Gemini API Key Gracefully (Status 400)', passed, { code: data.error?.code });
  } catch (err) {
    recordResult('Handle Missing Gemini API Key Gracefully', false, { error: err.message });
  }

  // 40. End-to-End AI Test Generation with Mocked Function Calling Loop
  try {
    setMockGenerator(async ({ endpoint, spec, categories, executeTool }) => {
      executeTool('get_endpoint_details', { endpointId: endpoint.id });
      return {
        usageMetadata: { inputTokens: 500, outputTokens: 400 },
        data: {
          endpointId: endpoint.id,
          endpointPath: endpoint.path,
          method: endpoint.method,
          tests: [
            {
              id: `test_${endpoint.id}_1`,
              name: 'Valid Creation',
              description: 'Happy path test case',
              method: 'POST',
              path: '/users',
              expectedStatus: 201,
              expectedResponse: { description: 'Created' },
              category: 'positive',
            },
            {
              id: `test_${endpoint.id}_2`,
              name: 'Missing Name Field',
              description: 'Negative test case',
              method: 'POST',
              path: '/users',
              expectedStatus: 400,
              expectedResponse: { description: 'Validation failed' },
              category: 'negative',
            },
            {
              id: `test_${endpoint.id}_3`,
              name: 'Minimum Boundary Violation',
              description: 'Boundary test case',
              method: 'POST',
              path: '/users',
              expectedStatus: 400,
              expectedResponse: { description: 'Boundary error' },
              category: 'boundary',
            },
          ],
        },
      };
    });

    const res = await fetch(`http://localhost:${SERVER_PORT}/api/ai/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId: 'createuser', categories: ['positive', 'negative', 'boundary'] }),
    });
    const data = await res.json();
    const passed = res.status === 200 && data.data?.tests?.length === 3 && data.data?.toolInvocations?.length > 0;
    recordResult('End-to-End AI Test Generation (Positive, Negative, Boundary)', passed, {
      testCount: data.data?.tests?.length,
      toolInvocations: data.data?.toolInvocations?.map((t) => t.toolName),
    });
  } catch (err) {
    recordResult('End-to-End AI Test Generation', false, { error: err.message });
  } finally {
    clearMockGenerator();
  }

  console.log('\n========================================');
  console.log('PART 4: PHASE 4 REGRESSION TESTS (15 TESTS)');
  console.log('========================================');

  // 41. Document Chunking
  try {
    const currentSpec = specStore.getCurrentSpec();
    const chunks = chunkSpecification(currentSpec);
    const types = new Set(chunks.map((c) => c.chunkType));
    const passed = Array.isArray(chunks) && chunks.length >= 5 && types.has('spec_overview') && types.has('endpoint_overview');
    recordResult('Phase 4: Document Chunking (Structured Decomposition)', passed, {
      totalChunks: chunks.length,
      types: Array.from(types),
    });
  } catch (err) {
    recordResult('Phase 4: Document Chunking', false, { error: err.message });
  }

  // 42. Embedding Generation
  try {
    const detVec = generateDeterministicEmbedding('TestPilot embedding generation verification');
    const passed = Array.isArray(detVec) && detVec.length === EMBEDDING_DIMENSION && typeof detVec[0] === 'number';
    recordResult('Phase 4: 768-dim Embedding Generation', passed, {
      dimension: detVec.length,
      sampleValue: detVec[0],
    });
  } catch (err) {
    recordResult('Phase 4: 768-dim Embedding Generation', false, { error: err.message });
  }

  // 43. Vector Store Insertion & Cosine Similarity Retrieval
  try {
    await clearChunks();
    const currentSpec = specStore.getCurrentSpec();
    const chunks = chunkSpecification(currentSpec);
    const embeddedChunks = await embedChunks(chunks);
    const storeResult = await storeChunks(embeddedChunks);

    const queryVec = generateDeterministicEmbedding('retrieve user by identifier ID');
    const searchResults = await searchSimilar(queryVec, { topK: 3 });
    const passed = storeResult.insertedCount > 0 && searchResults.length > 0 && searchResults[0].similarity > 0;
    recordResult('Phase 4: Vector Store Insertion & Cosine Search', passed, {
      backend: storeResult.backend,
      insertedCount: storeResult.insertedCount,
      topSimilarity: searchResults[0]?.similarity,
    });
  } catch (err) {
    recordResult('Phase 4: Vector Store Insertion & Cosine Search', false, { error: err.message });
  }

  // 44. Cosine Similarity Monotonic Ranking
  try {
    const queryVec = generateDeterministicEmbedding('POST /users create user with email and role');
    const results = await searchSimilar(queryVec, { topK: 5 });
    let isMonotonic = true;
    for (let i = 0; i < results.length - 1; i++) {
      if (results[i].similarity < results[i + 1].similarity) isMonotonic = false;
    }
    const passed = results.length > 0 && isMonotonic;
    recordResult('Phase 4: Cosine Similarity Monotonic Ranking Order', passed, {
      topScore: results[0]?.similarity,
      lowestScore: results[results.length - 1]?.similarity,
      isMonotonic,
    });
  } catch (err) {
    recordResult('Phase 4: Cosine Similarity Monotonic Ranking Order', false, { error: err.message });
  }

  // 45. RAG Context Construction
  try {
    const ragContext = await retrieveContext('what are the required fields for creating a user?', { topK: 2 });
    const passed = ragContext.matchCount > 0 && typeof ragContext.formattedContext === 'string' && ragContext.formattedContext.includes('[Context #1');
    recordResult('Phase 4: RAG Context Synthesis', passed, {
      matchCount: ragContext.matchCount,
      topSimilarity: `${(ragContext.topSimilarity * 100).toFixed(1)}%`,
    });
  } catch (err) {
    recordResult('Phase 4: RAG Context Synthesis', false, { error: err.message });
  }

  // 46. Agent State Machine States
  try {
    const expectedStates = ['INITIALIZING', 'RETRIEVING_CONTEXT', 'INSPECTING_CONTRACT', 'GENERATING_TESTS', 'EXECUTING_TESTS', 'ANALYZING_FAILURES', 'SYNTHESIZING_REPORT', 'COMPLETED', 'FAILED'];
    const passed = expectedStates.every((s) => AGENT_STATES[s] === s);
    recordResult('Phase 4: Agent State Machine Definitions', passed, { states: Object.keys(AGENT_STATES) });
  } catch (err) {
    recordResult('Phase 4: Agent State Machine Definitions', false, { error: err.message });
  }

  // 47. Bounded Agent Execution
  try {
    const passed = MAX_AGENT_TURNS <= 10;
    recordResult('Phase 4: Bounded Agent Execution Limits', passed, { maxTurns: MAX_AGENT_TURNS });
  } catch (err) {
    recordResult('Phase 4: Bounded Agent Execution Limits', false, { error: err.message });
  }

  // 48. Security: Reject Unauthorized Agent Tools
  try {
    let rejected = false;
    try {
      await executeAgentTool('execute_shell_command', { command: 'rm -rf /' });
    } catch (err) {
      if (err.message.includes('Security violation') || err.message.includes('not recognized')) {
        rejected = true;
      }
    }
    recordResult('Phase 4: Security - Reject Unauthorized Agent Tools', rejected, {
      blockedTool: 'execute_shell_command',
      allowedTools: Array.from(ALLOWED_AGENT_TOOLS),
    });
  } catch (err) {
    recordResult('Phase 4: Security - Reject Unauthorized Agent Tools', false, { error: err.message });
  }

  // 49. Live Test Execution against Sandbox API
  try {
    const currentSpec = specStore.getCurrentSpec();
    const validCreateTest = {
      id: 'test_live_create_master',
      name: 'Create Sandbox User Live',
      description: 'Creates user via sandbox POST /users',
      category: 'positive',
      method: 'POST',
      path: '/users',
      headers: { 'Content-Type': 'application/json' },
      requestBody: {
        name: 'Master Verification User',
        email: `master_${Date.now()}@testpilot.dev`,
        role: 'member',
      },
      expectedStatus: 201,
      expectedResponseConditions: ['Response status is 201', 'contains id'],
    };
    const execResult = await executeSingleTest(validCreateTest, currentSpec);
    const passed = execResult.actualStatus === 201 && execResult.status === 'PASSED' && Boolean(execResult.actualResponseBody?.id);
    recordResult('Phase 4: Test Execution Engine (Live Sandbox HTTP Call)', passed, {
      actualStatus: execResult.actualStatus,
      status: execResult.status,
      durationMs: execResult.durationMs,
    });
  } catch (err) {
    recordResult('Phase 4: Test Execution Engine', false, { error: err.message });
  }

  // 50. Strict Path & Sandbox URL Boundary Enforcement
  try {
    const currentSpec = specStore.getCurrentSpec();
    let externalRejected = false;
    try {
      validateTestSecurityAndPath({ method: 'GET', path: 'https://evil.attacker.com/steal' }, currentSpec);
    } catch (err) {
      if (err.message.includes('External URL')) externalRejected = true;
    }

    let traversalRejected = false;
    try {
      validateTestSecurityAndPath({ method: 'GET', path: '/users/../../etc/passwd' }, currentSpec);
    } catch (err) {
      if (err.message.includes('Path traversal')) traversalRejected = true;
    }

    let unlistedRejected = false;
    try {
      validateTestSecurityAndPath({ method: 'POST', path: '/admin/wipe-database' }, currentSpec);
    } catch (err) {
      if (err.message.includes('does not exist in the loaded specification')) unlistedRejected = true;
    }

    const passed = externalRejected && traversalRejected && unlistedRejected;
    recordResult('Phase 4: Security - Path & Sandbox URL Isolation', passed, {
      externalRejected,
      traversalRejected,
      unlistedRejected,
    });
  } catch (err) {
    recordResult('Phase 4: Security - Path & Sandbox URL Isolation', false, { error: err.message });
  }

  // 51. Expected vs Actual Comparison & Failure Classification
  try {
    const currentSpec = specStore.getCurrentSpec();
    const failingTest = {
      id: 'test_expect_failure_master',
      name: 'Intentional Mismatch Verification',
      description: 'Expects 200 OK for non-existent user 999999',
      category: 'negative',
      method: 'GET',
      path: '/users/999999',
      expectedStatus: 200,
      expectedResponseConditions: ['Response status is 200'],
    };
    const failResult = await executeSingleTest(failingTest, currentSpec);
    const passed = failResult.actualStatus === 404 && failResult.statusMatches === false && failResult.status === 'FAILED';
    recordResult('Phase 4: Expected vs Actual Comparison & Failure Classification', passed, {
      expected: 200,
      actual: failResult.actualStatus,
      status: failResult.status,
    });
  } catch (err) {
    recordResult('Phase 4: Expected vs Actual Comparison', false, { error: err.message });
  }

  // 52. AI Failure Diagnosis & Root Cause Explainer
  try {
    const currentSpec = specStore.getCurrentSpec();
    const mockFailedResult = {
      testCaseId: 'test_create_conflict_master',
      testName: 'Duplicate Email Conflict Test',
      category: 'negative',
      method: 'POST',
      path: '/users',
      targetUrl: 'http://localhost:4000/users',
      expectedStatus: 201,
      actualStatus: 409,
      errorMessage: 'Status mismatch: Expected HTTP 201, received HTTP 409',
      actualResponseBody: { error: 'Conflict', message: 'User with this email already exists' },
      expectedResponseConditions: ['Response status is 201'],
    };
    const diagnosis = await diagnoseTestFailure(mockFailedResult, currentSpec.endpoints[1]);
    const passed = Boolean(diagnosis.likelyReason) && Array.isArray(diagnosis.evidence) && Boolean(diagnosis.suggestedCorrection) && diagnosis.isHypothesis === true;
    recordResult('Phase 4: AI Failure Diagnosis & Root Cause Explainer', passed, {
      likelyReason: diagnosis.likelyReason,
      evidenceCount: diagnosis.evidence?.length,
      isHypothesis: diagnosis.isHypothesis,
    });
  } catch (err) {
    recordResult('Phase 4: AI Failure Diagnosis', false, { error: err.message });
  }

  // 53. Execution Timeout & Network Error Graceful Handling
  try {
    const currentSpec = specStore.getCurrentSpec();
    const timeoutTest = {
      id: 'test_timeout_master',
      name: 'Timeout Protection Test',
      description: 'Tests that a 1ms timeout aborts gracefully',
      category: 'boundary',
      method: 'GET',
      path: '/users',
      expectedStatus: 200,
      expectedResponseConditions: ['status is 200'],
    };
    const result = await executeSingleTest(timeoutTest, currentSpec, { timeoutMs: 1 });
    const passed = result.status === 'FAILED' && (result.errorMessage.includes('timed out') || result.errorMessage.includes('Network error'));
    recordResult('Phase 4: Execution Timeout & Network Error Handling', passed, {
      status: result.status,
      errorMessage: result.errorMessage,
    });
  } catch (err) {
    recordResult('Phase 4: Execution Timeout Handling', false, { error: err.message });
  }

  // 54. Persistence of Run Records & Test Case Results
  try {
    const currentSpec = specStore.getCurrentSpec();
    const suite = [
      {
        id: 'tc_master_1',
        name: 'Suite Test 1 - GET Users',
        description: 'Verify all users retrieval response',
        category: 'positive',
        method: 'GET',
        path: '/users',
        expectedStatus: 200,
        expectedResponseConditions: ['Response status is 200'],
      },
      {
        id: 'tc_master_2',
        name: 'Suite Test 2 - GET User by ID',
        description: 'Verify single user retrieval by ID',
        category: 'positive',
        method: 'GET',
        path: '/users/1',
        expectedStatus: 200,
        expectedResponseConditions: ['Response status is 200'],
      },
    ];
    const suiteRun = await executeTestSuite(suite, currentSpec);
    const retrieved = getExecutionRunById(suiteRun.id);
    const passed = suiteRun.id && suiteRun.totalTests === 2 && Boolean(retrieved) && retrieved.results.length === 2;
    recordResult('Phase 4: Persistence of Execution Runs & Results', passed, {
      runId: suiteRun.id,
      totalTests: suiteRun.totalTests,
      retrievedSuccessfully: Boolean(retrieved),
    });
  } catch (err) {
    recordResult('Phase 4: Persistence of Execution Runs & Results', false, { error: err.message });
  }

  // 55. End-to-End Autonomous Agent Investigation Workflow
  try {
    const agentRun = await runAgentInvestigation({
      endpointId: 'createuser',
      objective: 'Investigate POST /users contract compliance and edge-case behavior',
      categories: ['positive', 'negative', 'boundary'],
    });
    const retrievedAgentRun = getAgentRunById(agentRun.id);
    const passed = agentRun.id && agentRun.status === AGENT_STATES.COMPLETED && agentRun.executedTests.length > 0 && agentRun.traceSteps.length > 0 && Boolean(retrievedAgentRun);
    recordResult('Phase 4: End-to-End Autonomous Agent Investigation Workflow', passed, {
      runId: agentRun.id,
      status: agentRun.status,
      executedTestsCount: agentRun.executedTests.length,
      traceStepsCount: agentRun.traceSteps.length,
      durationMs: agentRun.durationMs,
    });
  } catch (err) {
    recordResult('Phase 4: End-to-End Autonomous Agent Investigation Workflow', false, { error: err.message });
  }

  console.log('\n========================================');
  console.log('PART 5: PHASE 5 WEBSOCKETS & LLM EVALUATION TESTS (15 TESTS)');
  console.log('========================================');

  let masterClientSocket = null;
  const phase5RunId = `agent_p5_suite_${Date.now()}`;

  // 56. Socket.IO HTTP Server Binding & Connection Handshake
  try {
    masterClientSocket = ioClient(`http://127.0.0.1:${SERVER_PORT}`, {
      transports: ['polling', 'websocket'],
      forceNew: true,
      reconnection: false,
    });

    const readyData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket.IO connection timeout')), 4000);
      masterClientSocket.on('connection:ready', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      masterClientSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const passed = readyData.socketId && readyData.serverVersion === '1.0.0-phase5';
    recordResult('Phase 5: Socket.IO HTTP Server Binding & Handshake', passed, {
      socketId: readyData.socketId,
      serverVersion: readyData.serverVersion,
    });
  } catch (err) {
    recordResult('Phase 5: Socket.IO HTTP Server Binding & Handshake', false, { error: err.message });
  }

  // 57. Investigation Room Subscription & Acknowledgment
  try {
    const ack = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Subscription timeout')), 3000);
      masterClientSocket.emit('join-investigation', { runId: phase5RunId }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    const passed = ack.success === true && ack.runId === phase5RunId && ack.room === `investigation:${phase5RunId}`;
    recordResult('Phase 5: Investigation Room Subscription & Acknowledgment', passed, ack);
  } catch (err) {
    recordResult('Phase 5: Investigation Room Subscription & Acknowledgment', false, { error: err.message });
  }

  // 58. Rejection of Malformed Room Subscription Identifiers
  try {
    const errAck = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Rejection timeout')), 3000);
      masterClientSocket.emit('join-investigation', { runId: '!!bad$$id' }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    const passed = errAck.success === false && errAck.error && errAck.error.includes('Invalid runId');
    recordResult('Phase 5: Rejection of Malformed Room Subscription Identifiers', passed, { error: errAck.error });
  } catch (err) {
    recordResult('Phase 5: Rejection of Malformed Room Subscription Identifiers', false, { error: err.message });
  }

  // 59. Room Unsubscription & Teardown
  try {
    const leaveAck = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Unsubscription timeout')), 3000);
      masterClientSocket.emit('leave-investigation', { runId: phase5RunId }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    const passed = leaveAck.success === true && leaveAck.runId === phase5RunId;
    recordResult('Phase 5: Room Unsubscription & Teardown', passed, leaveAck);
    // Re-join for subsequent streaming test
    await new Promise((resolve) => {
      masterClientSocket.emit('join-investigation', { runId: phase5RunId }, resolve);
    });
  } catch (err) {
    recordResult('Phase 5: Room Unsubscription & Teardown', false, { error: err.message });
  }

  // 60. Real-Time Agent Event Lifecycle Sequence (8 core transitions)
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
    const received = [];

    const seqPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (received.length === expectedEvents.length) resolve(received);
        else reject(new Error(`Timeout: Received ${received.length}/${expectedEvents.length} events`));
      }, 5000);

      expectedEvents.forEach((evt) => {
        masterClientSocket.on(evt, (p) => {
          received.push(p.eventType);
          if (received.length === expectedEvents.length) {
            clearTimeout(timeout);
            resolve(received);
          }
        });
      });
    });

    emitAgentEvent(phase5RunId, 'agent:started', { endpointMethod: 'GET', endpointPath: '/users' });
    emitAgentEvent(phase5RunId, 'agent:step', { stepNumber: 1, stepType: 'RETRIEVE_CONTEXT' });
    emitAgentEvent(phase5RunId, 'agent:tool-called', { toolName: 'retrieve_api_documentation' });
    emitAgentEvent(phase5RunId, 'agent:retrieval-completed', { chunksRetrieved: 3 });
    emitAgentEvent(phase5RunId, 'agent:test-started', { testName: 'All users happy path', category: 'positive' });
    emitAgentEvent(phase5RunId, 'agent:test-completed', { testName: 'All users happy path', status: 'PASSED', durationMs: 15 });
    emitAgentEvent(phase5RunId, 'agent:diagnosis', { testName: 'Edge case', likelyReason: 'Boundary test check' });
    emitAgentEvent(phase5RunId, 'agent:completed', { summary: 'Done', status: 'COMPLETED' });

    const results = await seqPromise;
    const passed = JSON.stringify(results) === JSON.stringify(expectedEvents);
    recordResult('Phase 5: Real-Time Agent Event Lifecycle Sequence (8 Events)', passed, {
      receivedCount: results.length,
    });
  } catch (err) {
    recordResult('Phase 5: Real-Time Agent Event Lifecycle Sequence (8 Events)', false, { error: err.message });
  }

  // 61. Event Payload Sanitization & Credential Masking
  try {
    const dirty = {
      apiKey: 'AIzaSyDemoSecretKeyForTesting12345',
      userSecret: 'super-secret-password-xyz',
      nested: {
        authToken: 'Bearer secret_token_value',
        safeData: 'Public user endpoint info',
        rawKeyInString: 'Call completed with key AIzaSyDemoSecretKeyForTesting12345 successfully',
      },
    };
    const clean = sanitizePayload(dirty);
    const passed =
      clean.apiKey === '[REDACTED]' &&
      clean.userSecret === '[REDACTED]' &&
      clean.nested.authToken === '[REDACTED]' &&
      clean.nested.safeData === 'Public user endpoint info' &&
      clean.nested.rawKeyInString.includes('[REDACTED_API_KEY]') &&
      !clean.nested.rawKeyInString.includes('AIzaSyDemoSecretKeyForTesting12345');

    recordResult('Phase 5: Event Payload Sanitization & Credential Masking', passed, {
      apiKeyRedacted: clean.apiKey === '[REDACTED]',
      userSecretRedacted: clean.userSecret === '[REDACTED]',
      authTokenRedacted: clean.nested.authToken === '[REDACTED]',
      textKeyRedacted: clean.nested.rawKeyInString.includes('[REDACTED_API_KEY]'),
    });
  } catch (err) {
    recordResult('Phase 5: Event Payload Sanitization & Credential Masking', false, { error: err.message });
  }

  // 62. Benchmark Dataset Structural Integrity
  try {
    const dataset = getBenchmarkDataset('benchmark-v1');
    const passed = dataset && dataset.id === 'benchmark-v1' && dataset.version === '1.0.0' && dataset.cases.length === 16;
    recordResult('Phase 5: Benchmark Dataset Structural Integrity (v1.0.0, 16 Cases)', passed, {
      id: dataset?.id,
      version: dataset?.version,
      caseCount: dataset?.cases?.length,
    });
  } catch (err) {
    recordResult('Phase 5: Benchmark Dataset Structural Integrity (v1.0.0, 16 Cases)', false, { error: err.message });
  }

  // 63. Benchmark Endpoint & Category Coverage Verification
  try {
    const dataset = getBenchmarkDataset('benchmark-v1');
    const coveredMethods = new Set(dataset.cases.map((c) => `${c.endpoint.method} ${c.endpoint.path}`));
    const coveredCats = new Set(dataset.cases.map((c) => c.scenarioType));
    const passed =
      coveredMethods.has('GET /users') &&
      coveredMethods.has('GET /users/{id}') &&
      coveredMethods.has('POST /users') &&
      coveredMethods.has('DELETE /users/{id}') &&
      coveredCats.has('positive') &&
      coveredCats.has('negative') &&
      coveredCats.has('boundary');

    recordResult('Phase 5: Benchmark Endpoint & Category Coverage (4 Endpoints, 3 Categories)', passed, {
      endpoints: Array.from(coveredMethods),
      categories: Array.from(coveredCats),
    });
  } catch (err) {
    recordResult('Phase 5: Benchmark Endpoint & Category Coverage (4 Endpoints, 3 Categories)', false, { error: err.message });
  }

  // 64. Deterministic Quality Metric Formula & Weight Verification
  try {
    const sampleEvaluations = [
      { caseId: 'c1', schemaValid: true, endpointMatch: true, methodMatch: true, statusMatch: true, categoryMatch: true },
      { caseId: 'c2', schemaValid: true, endpointMatch: true, methodMatch: true, statusMatch: false, categoryMatch: true },
    ];
    const metrics = calculateDeterministicMetrics(sampleEvaluations);
    // formula: 0.2(100) + 0.2(100) + 0.2(100) + 0.25(50) + 0.15(100) = 20 + 20 + 20 + 12.5 + 15 = 87.5
    const passed = metrics.overallScore === 87.5 && metrics.expectedStatusAccuracy === 50 && metrics.passed === true;
    recordResult('Phase 5: Deterministic Quality Metric Formula & Weights (87.5% Composite)', passed, {
      overallScore: metrics.overallScore,
      statusAccuracy: metrics.expectedStatusAccuracy,
      passed: metrics.passed,
    });
  } catch (err) {
    recordResult('Phase 5: Deterministic Quality Metric Formula & Weights (87.5% Composite)', false, { error: err.message });
  }

  // 65. REST API: Listing Available Benchmark Datasets
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/datasets`);
    const json = await res.json();
    const list = json.data?.datasets || json.data;
    const passed = res.status === 200 && json.success === true && Array.isArray(list) && list.some((d) => d.id === 'benchmark-v1');
    recordResult('Phase 5: REST API Listing Benchmark Datasets (GET /datasets)', passed, {
      datasetCount: list?.length,
    });
  } catch (err) {
    recordResult('Phase 5: REST API Listing Benchmark Datasets (GET /datasets)', false, { error: err.message });
  }

  // 66. REST API: Full Dataset Retrieval
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/datasets/benchmark-v1`);
    const json = await res.json();
    const passed = res.status === 200 && json.data.id === 'benchmark-v1' && json.data.cases.length === 16;
    recordResult('Phase 5: REST API Full Dataset Retrieval (GET /datasets/:id)', passed, {
      id: json.data?.id,
      cases: json.data?.cases?.length,
    });
  } catch (err) {
    recordResult('Phase 5: REST API Full Dataset Retrieval (GET /datasets/:id)', false, { error: err.message });
  }

  let masterEvalRunId = null;

  // 67. REST API: Execution of 16-Case Benchmark Evaluation
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: 'benchmark-v1' }),
    });
    const json = await res.json();
    masterEvalRunId = json.data?.id;
    const passed = res.status === 200 && json.success === true && json.data.overallScore >= 70 && json.data.caseResults.length === 16;
    recordResult('Phase 5: REST API 16-Case Benchmark Execution (POST /run)', passed, {
      runId: masterEvalRunId,
      overallScore: `${json.data?.overallScore}%`,
      casesEvaluated: json.data?.caseResults?.length,
      passedCases: json.data?.passedCases,
    });
  } catch (err) {
    recordResult('Phase 5: REST API 16-Case Benchmark Execution (POST /run)', false, { error: err.message });
  }

  // 68. REST API: Evaluation Run Retrieval by ID
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/runs/${masterEvalRunId}`);
    const json = await res.json();
    const passed = res.status === 200 && json.data.id === masterEvalRunId && json.data.caseResults.length === 16;
    recordResult('Phase 5: REST API Evaluation Run Retrieval by ID (GET /runs/:id)', passed, {
      runId: json.data?.id,
      overallScore: json.data?.overallScore,
    });
  } catch (err) {
    recordResult('Phase 5: REST API Evaluation Run Retrieval by ID (GET /runs/:id)', false, { error: err.message });
  }

  // 69. REST API: Aggregated Metrics Summary
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/evaluations/summary`);
    const json = await res.json();
    const passed = res.status === 200 && json.data.totalRuns >= 1 && json.data.averageOverallScore >= 0;
    recordResult('Phase 5: REST API Aggregated Metrics Summary (GET /summary)', passed, {
      totalRuns: json.data?.totalRuns,
      averageOverallScore: `${json.data?.averageOverallScore}%`,
    });
  } catch (err) {
    recordResult('Phase 5: REST API Aggregated Metrics Summary (GET /summary)', false, { error: err.message });
  }

  // 70. Phase 5: End-to-End Live Agent Event Streaming & Sandbox Execution
  try {
    const liveAgentRunId = `agent_e2e_m_${Date.now()}`;
    const captured = [];

    await new Promise((resolve) => {
      masterClientSocket.emit('join-investigation', { runId: liveAgentRunId }, resolve);
    });

    const onEvt = (p) => {
      if (p && p.runId === liveAgentRunId) captured.push(p.eventType);
    };
    masterClientSocket.on('agent:event', onEvt);

    const agentRes = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/ai/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: liveAgentRunId,
        endpointId: 'getallusers',
        objective: 'Test real-time event emission and execution',
        categories: ['positive'],
      }),
    });
    const agentJson = await agentRes.json();
    await new Promise((resolve) => setTimeout(resolve, 500));
    masterClientSocket.off('agent:event', onEvt);

    const passed =
      agentRes.status === 200 &&
      agentJson.data.id === liveAgentRunId &&
      agentJson.data.executedTests.length > 0 &&
      captured.length >= 3 &&
      captured.includes('agent:started');

    recordResult('Phase 5: End-to-End Live Agent Event Streaming & Execution', passed, {
      runId: liveAgentRunId,
      eventsStreamed: captured.length,
      executedTests: agentJson.data?.executedTests?.length,
      status: agentJson.data?.status,
    });
  } catch (err) {
    recordResult('Phase 5: End-to-End Live Agent Event Streaming & Execution', false, { error: err.message });
  }

  if (masterClientSocket) {
    masterClientSocket.disconnect();
  }
  closeSocketIO();

  // Teardown
  console.log('\n[TEARDOWN] Shutting down test servers...');
  await new Promise((resolve) => serverInstance.close(resolve));
  await new Promise((resolve) => sandboxInstance.close(resolve));
  console.log('[TEARDOWN] Servers closed successfully.\n');

  // Summary
  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  console.log('==================================================================');
  console.log(`📊 MASTER VERIFICATION SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED`);
  console.log('==================================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[FATAL] Master verification runner failed:', err);
  if (serverInstance) serverInstance.close();
  if (sandboxInstance) sandboxInstance.close();
  process.exit(1);
});

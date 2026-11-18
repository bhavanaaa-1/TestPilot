/**
 * TestPilot Phase 4 Verification Suite
 * Verifies RAG Pipeline, Vector Storage, Multi-Step Agent, Test Execution Engine, and Failure Explainer.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Load environment first
require('../server/src/config/env');

const serverApp = require('../server/src/app');
const sandboxApp = require('../sandbox-api/src/app');
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
  initVectorStore,
  storeChunks,
  searchSimilar,
  calculateCosineSimilarity,
  clearChunks,
  getStats,
  isPgvectorActive,
} = require('../server/src/rag/vectorStore');
const { retrieveContext, indexSpecification, reindexCurrentSpec } = require('../server/src/rag/retrievalService');
const {
  executeSingleTest,
  executeTestSuite,
  validateTestSecurityAndPath,
  evaluateCondition,
  getExecutionRunById,
} = require('../server/src/execution/testRunner');
const { diagnoseTestFailure, setMockDiagnosisGenerator, clearMockDiagnosisGenerator } = require('../server/src/diagnosis/failureExplainer');
const {
  runAgentInvestigation,
  getAgentRunById,
  AGENT_STATES,
  MAX_AGENT_TURNS,
} = require('../server/src/agent/agentOrchestrator');
const { executeAgentTool, ALLOWED_AGENT_TOOLS } = require('../server/src/agent/agentTools');
const specStore = require('../server/src/services/specStore');
const { parseAndValidateOpenApi } = require('../server/src/services/openApiParser');

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

let serverInstance = null;
let sandboxInstance = null;

async function runPhase4Verification() {
  console.log('\n======================================================');
  console.log('🧪 TESTPILOT PHASE 4 - RAG, AGENT & TEST EXECUTION VERIFICATION');
  console.log('======================================================\n');

  // Boot sandbox server if not running
  await new Promise((resolve) => {
    sandboxInstance = sandboxApp.listen(4000, () => {
      console.log('[BOOT] Sandbox API listening on http://localhost:4000');
      resolve();
    });
    sandboxInstance.on('error', () => {
      // Already running
      resolve();
    });
  });

  // Load sample specification into specStore for testing
  const sampleYamlPath = path.join(__dirname, '../examples/sandbox-openapi.yaml');
  const sampleBuffer = fs.readFileSync(sampleYamlPath);
  const parsedSpec = await parseAndValidateOpenApi(sampleBuffer, 'sandbox-openapi.yaml');
  specStore.setCurrentSpec(parsedSpec);

  // --- SECTION 1: DOCUMENT CHUNKING ---
  totalTests++;
  try {
    const chunks = chunkSpecification(parsedSpec);
    assert(Array.isArray(chunks), 'Chunks must be an array');
    assert(chunks.length >= 5, `Expected at least 5 chunks, got ${chunks.length}`);

    const types = new Set(chunks.map((c) => c.chunkType));
    assert(types.has('spec_overview'), 'Missing spec_overview chunk');
    assert(types.has('endpoint_overview'), 'Missing endpoint_overview chunk');
    assert(types.has('responses'), 'Missing responses chunk');

    const postUserChunk = chunks.find((c) => c.method === 'POST' && c.path === '/users');
    assert(postUserChunk, 'Missing POST /users chunk');
    assert(postUserChunk.content.includes('POST /users'), 'Content should mention POST /users');

    reportPass('Document Chunking: Structured OpenAPI Decomposition', {
      totalChunks: chunks.length,
      types: Array.from(types),
      sampleChunkId: postUserChunk.id,
    });
  } catch (err) {
    reportFail('Document Chunking', err);
  }

  // --- SECTION 2: EMBEDDING GENERATION (MOCKED & DETERMINISTIC) ---
  totalTests++;
  try {
    // 2a. Mocked embedding generator
    const mockVec = new Array(EMBEDDING_DIMENSION).fill(0.1);
    setMockEmbeddingGenerator(async (text) => mockVec);

    const testText = 'Create a new user account with email and name';
    const embedded = await embedText(testText);
    assert.strictEqual(embedded.length, EMBEDDING_DIMENSION);
    assert.strictEqual(embedded[0], 0.1);

    clearMockEmbeddingGenerator();

    // 2b. Deterministic fallback embedding generator
    const detVec = generateDeterministicEmbedding(testText);
    assert.strictEqual(detVec.length, EMBEDDING_DIMENSION);
    assert(typeof detVec[0] === 'number', 'Values must be numbers');

    reportPass('Embedding Generation (Mocked & Deterministic Fallback)', {
      dimension: detVec.length,
      mockVerified: true,
      deterministicVerified: true,
    });
  } catch (err) {
    reportFail('Embedding Generation', err);
  }

  // --- SECTION 3: VECTOR INSERTION & COSINE SIMILARITY RETRIEVAL ---
  totalTests++;
  try {
    await clearChunks();
    const chunks = chunkSpecification(parsedSpec);
    const embeddedChunks = await embedChunks(chunks);

    const storeResult = await storeChunks(embeddedChunks);
    assert(storeResult.insertedCount > 0, 'Should insert chunks');

    const queryVec = generateDeterministicEmbedding('retrieve user by identifier ID');
    const searchResults = await searchSimilar(queryVec, { topK: 3 });

    assert(Array.isArray(searchResults), 'Search results must be an array');
    assert(searchResults.length > 0, 'Should return matching chunks');
    assert(searchResults[0].similarity > 0, 'Similarity must be positive');

    reportPass('Vector Insertion & Retrieval (pgvector / In-Memory Store)', {
      backend: storeResult.backend,
      insertedCount: storeResult.insertedCount,
      topMatch: searchResults[0].id,
      topSimilarity: searchResults[0].similarity,
    });
  } catch (err) {
    reportFail('Vector Insertion & Retrieval', err);
  }

  // --- SECTION 4: SIMILARITY RANKING ACCURACY ---
  totalTests++;
  try {
    const userQuery = 'POST /users create user with email and role';
    const queryVec = generateDeterministicEmbedding(userQuery);
    const results = await searchSimilar(queryVec, { topK: 5 });

    // Assert results are sorted descending by similarity
    for (let i = 0; i < results.length - 1; i++) {
      assert(
        results[i].similarity >= results[i + 1].similarity,
        `Ranking failure: rank ${i} (${results[i].similarity}) < rank ${i + 1} (${results[i + 1].similarity})`
      );
    }

    reportPass('Cosine Similarity Ranking Order', {
      topScore: results[0].similarity,
      lowestScore: results[results.length - 1].similarity,
      isMonotonic: true,
    });
  } catch (err) {
    reportFail('Similarity Ranking', err);
  }

  // --- SECTION 5: RAG CONTEXT SYNTHESIS ---
  totalTests++;
  try {
    const ragContext = await retrieveContext('what are the required fields for creating a user?', { topK: 2 });
    assert(ragContext.matchCount > 0, 'Should find relevant context');
    assert(typeof ragContext.formattedContext === 'string', 'Context should be string');
    assert(ragContext.formattedContext.includes('[Context #1'), 'Should format with context headers');

    reportPass('RAG Context Construction', {
      matchCount: ragContext.matchCount,
      topSimilarity: `${(ragContext.topSimilarity * 100).toFixed(1)}%`,
      hasFormattedHeaders: true,
    });
  } catch (err) {
    reportFail('RAG Context Construction', err);
  }

  // --- SECTION 6: AGENT STATE MACHINE TRANSITIONS ---
  totalTests++;
  try {
    assert.strictEqual(AGENT_STATES.INITIALIZING, 'INITIALIZING');
    assert.strictEqual(AGENT_STATES.RETRIEVING_CONTEXT, 'RETRIEVING_CONTEXT');
    assert.strictEqual(AGENT_STATES.INSPECTING_CONTRACT, 'INSPECTING_CONTRACT');
    assert.strictEqual(AGENT_STATES.EXECUTING_TESTS, 'EXECUTING_TESTS');
    assert.strictEqual(AGENT_STATES.COMPLETED, 'COMPLETED');

    reportPass('Agent State Machine State Definitions', {
      states: Object.keys(AGENT_STATES),
    });
  } catch (err) {
    reportFail('Agent State Machine', err);
  }

  // --- SECTION 7: BOUNDED AGENT LOOP ENFORCEMENT ---
  totalTests++;
  try {
    assert(MAX_AGENT_TURNS <= 10, 'Max agent turns should be bounded to 10');
    reportPass('Bounded Agent Execution Limits', {
      maxTurns: MAX_AGENT_TURNS,
      recursionSafe: true,
    });
  } catch (err) {
    reportFail('Bounded Agent Execution', err);
  }

  // --- SECTION 8: UNAUTHORIZED TOOL REJECTION ---
  totalTests++;
  try {
    let rejected = false;
    try {
      await executeAgentTool('execute_shell_command', { command: 'rm -rf /' });
    } catch (err) {
      if (err.message.includes('Security violation') || err.message.includes('not recognized')) {
        rejected = true;
      }
    }
    assert(rejected, 'Arbitrary tool execution must be rejected');

    reportPass('Security: Reject Unauthorized Agent Tools', {
      blockedTool: 'execute_shell_command',
      allowedTools: Array.from(ALLOWED_AGENT_TOOLS),
    });
  } catch (err) {
    reportFail('Unauthorized Tool Rejection', err);
  }

  // --- SECTION 9: LIVE TEST EXECUTION AGAINST SANDBOX API ---
  totalTests++;
  try {
    const validCreateTest = {
      id: 'test_live_create_1',
      name: 'Create Sandbox User Valid',
      description: 'Creates user via sandbox POST /users',
      category: 'positive',
      method: 'POST',
      path: '/users',
      headers: { 'Content-Type': 'application/json' },
      requestBody: {
        name: 'Phase 4 Verification User',
        email: `phase4_${Date.now()}@testpilot.dev`,
        role: 'member',
      },
      expectedStatus: 201,
      expectedResponseConditions: ['Response status is 201', 'contains id'],
    };

    const execResult = await executeSingleTest(validCreateTest, parsedSpec);
    assert.strictEqual(execResult.actualStatus, 201);
    assert.strictEqual(execResult.status, 'PASSED');
    assert(execResult.actualResponseBody?.id, 'Should receive created user id');

    reportPass('Test Execution Engine (Live Sandbox HTTP Call)', {
      targetUrl: execResult.targetUrl,
      actualStatus: execResult.actualStatus,
      status: execResult.status,
      durationMs: execResult.durationMs,
    });
  } catch (err) {
    reportFail('Test Execution Engine', err);
  }

  // --- SECTION 10: PATH AND URL SECURITY RESTRICTIONS ---
  totalTests++;
  try {
    // 10a. External URL rejection
    let externalRejected = false;
    try {
      validateTestSecurityAndPath({ method: 'GET', path: 'https://evil.attacker.com/steal' }, parsedSpec);
    } catch (err) {
      if (err.message.includes('External URL')) externalRejected = true;
    }
    assert(externalRejected, 'External URLs must be rejected');

    // 10b. Path traversal rejection
    let traversalRejected = false;
    try {
      validateTestSecurityAndPath({ method: 'GET', path: '/users/../../etc/passwd' }, parsedSpec);
    } catch (err) {
      if (err.message.includes('Path traversal')) traversalRejected = true;
    }
    assert(traversalRejected, 'Path traversal must be rejected');

    // 10c. Endpoint not in spec rejection
    let unlistedRejected = false;
    try {
      validateTestSecurityAndPath({ method: 'POST', path: '/admin/wipe-database' }, parsedSpec);
    } catch (err) {
      if (err.message.includes('does not exist in the loaded specification')) unlistedRejected = true;
    }
    assert(unlistedRejected, 'Unlisted endpoints must be rejected');

    reportPass('Security: Strict Path & Sandbox URL Boundary Enforcement', {
      externalRejected,
      traversalRejected,
      unlistedRejected,
    });
  } catch (err) {
    reportFail('Path & URL Restrictions', err);
  }

  // --- SECTION 11: EXPECTED VS ACTUAL COMPARISON & CONDITION ASSERTIONS ---
  totalTests++;
  try {
    const failingTest = {
      id: 'test_expect_failure_1',
      name: 'Intentional Mismatch Verification',
      description: 'Expects 200 OK for non-existent user 999999',
      category: 'negative',
      method: 'GET',
      path: '/users/999999',
      expectedStatus: 200, // Intentional mismatch (sandbox will return 404)
      expectedResponseConditions: ['Response status is 200'],
    };

    const failResult = await executeSingleTest(failingTest, parsedSpec);
    assert.strictEqual(failResult.actualStatus, 404);
    assert.strictEqual(failResult.statusMatches, false);
    assert.strictEqual(failResult.status, 'FAILED');
    assert(failResult.errorMessage.includes('Status mismatch'));

    reportPass('Expected vs Actual Response Comparison & Classification', {
      expected: 200,
      actual: 404,
      statusMatches: false,
      classifiedAs: failResult.status,
    });
  } catch (err) {
    reportFail('Expected vs Actual Comparison', err);
  }

  // --- SECTION 12: AI FAILURE DIAGNOSIS & EXPLAINER ---
  totalTests++;
  try {
    const mockFailedResult = {
      testCaseId: 'test_create_conflict',
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

    const diagnosis = await diagnoseTestFailure(mockFailedResult, parsedSpec.endpoints[1]);
    assert(diagnosis.likelyReason, 'Diagnosis must contain likelyReason');
    assert(Array.isArray(diagnosis.evidence), 'Evidence must be an array');
    assert(diagnosis.suggestedCorrection, 'Must provide suggestedCorrection');
    assert.strictEqual(diagnosis.isHypothesis, true, 'Must clearly state isHypothesis: true');

    reportPass('AI Failure Diagnosis & Root Cause Explainer', {
      likelyReason: diagnosis.likelyReason,
      evidenceCount: diagnosis.evidence.length,
      isHypothesis: diagnosis.isHypothesis,
      hasCorrection: Boolean(diagnosis.suggestedCorrection),
    });
  } catch (err) {
    reportFail('AI Failure Diagnosis', err);
  }

  // --- SECTION 13: EXECUTION TIMEOUT HANDLING ---
  totalTests++;
  try {
    const timeoutTest = {
      id: 'test_timeout_case',
      name: 'Timeout Protection Test',
      description: 'Tests that a 1ms timeout aborts gracefully',
      category: 'boundary',
      method: 'GET',
      path: '/users',
      expectedStatus: 200,
      expectedResponseConditions: ['status is 200'],
    };

    // Use an impossibly low timeout (1ms) to force timeout handling
    const result = await executeSingleTest(timeoutTest, parsedSpec, { timeoutMs: 1 });
    assert.strictEqual(result.status, 'FAILED');
    assert(result.errorMessage.includes('timed out') || result.errorMessage.includes('Network error'));

    reportPass('Execution Timeout & Network Error Graceful Handling', {
      status: result.status,
      errorMessage: result.errorMessage,
    });
  } catch (err) {
    reportFail('Timeout Handling', err);
  }

  // --- SECTION 14: PERSISTENCE OF EXECUTION RUNS & RESULTS ---
  totalTests++;
  try {
    const suite = [
      {
        id: 'tc_p4_1',
        name: 'Suite Test 1 - GET Users',
        description: 'Verify all users retrieval response',
        category: 'positive',
        method: 'GET',
        path: '/users',
        expectedStatus: 200,
        expectedResponseConditions: ['Response status is 200'],
      },
      {
        id: 'tc_p4_2',
        name: 'Suite Test 2 - GET User by ID',
        description: 'Verify single user retrieval by ID',
        category: 'positive',
        method: 'GET',
        path: '/users/1',
        expectedStatus: 200,
        expectedResponseConditions: ['Response status is 200'],
      },
    ];

    const suiteRun = await executeTestSuite(suite, parsedSpec);
    assert(suiteRun.id, 'Suite run must have an ID');
    assert.strictEqual(suiteRun.totalTests, 2);

    const retrieved = getExecutionRunById(suiteRun.id);
    assert(retrieved, 'Should retrieve run by ID from store');
    assert.strictEqual(retrieved.id, suiteRun.id);
    assert.strictEqual(retrieved.results.length, 2);

    reportPass('Persistence of Run Records & Test Case Results', {
      runId: suiteRun.id,
      totalTests: suiteRun.totalTests,
      passedCount: suiteRun.passedCount,
      retrievedSuccessfully: true,
    });
  } catch (err) {
    reportFail('Persistence of Run Results', err);
  }

  // --- SECTION 15: COMPLETE END-TO-END AUTONOMOUS AGENT INVESTIGATION ---
  totalTests++;
  try {
    const agentRun = await runAgentInvestigation({
      endpointId: 'createuser',
      objective: 'Investigate POST /users contract compliance and edge-case behavior',
      categories: ['positive', 'negative', 'boundary'],
    });

    assert(agentRun.id, 'Agent run must have an ID');
    assert.strictEqual(agentRun.status, AGENT_STATES.COMPLETED);
    assert(agentRun.executedTests.length > 0, 'Agent should have executed tests');
    assert(agentRun.traceSteps.length > 0, 'Agent should have recorded trace steps');
    assert(agentRun.summary, 'Agent should have generated an executive summary');
    assert(Array.isArray(agentRun.evidence), 'Agent should have evidence observations');

    const retrievedAgentRun = getAgentRunById(agentRun.id);
    assert.strictEqual(retrievedAgentRun.id, agentRun.id);

    reportPass('End-to-End Autonomous Agent Investigation Workflow', {
      runId: agentRun.id,
      status: agentRun.status,
      executedTestsCount: agentRun.executedTests.length,
      traceStepsCount: agentRun.traceSteps.length,
      durationMs: agentRun.durationMs,
    });
  } catch (err) {
    reportFail('Autonomous Agent Investigation', err);
  }

  if (sandboxInstance && sandboxInstance.close) {
    try {
      sandboxInstance.close();
    } catch {
      // Ignored
    }
  }

  console.log('\n======================================================');
  console.log(`📊 PHASE 4 VERIFICATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runPhase4Verification().catch((err) => {
    console.error('Fatal Phase 4 test runner error:', err);
    process.exit(1);
  });
}

module.exports = { runPhase4Verification };

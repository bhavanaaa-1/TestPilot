/**
 * TestPilot Live Gemini Integration Verification Script
 * Audits Google Gemini API connection using the official @google/genai SDK.
 * If GEMINI_API_KEY is configured: validates live text generation, embedding generation,
 * pgvector similarity search, and autonomous agent orchestration.
 * If GEMINI_API_KEY is missing: verifies deterministic fallback mode operates cleanly
 * and outputs an honest status report without fabricating live results.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

require('../server/src/config/env');
const config = require('../server/src/config/env');

let GoogleGenAI;
try {
  GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch {
  GoogleGenAI = require('../server/node_modules/@google/genai').GoogleGenAI;
}
const { embedText, EMBEDDING_DIMENSION } = require('../server/src/rag/embeddingService');
const { initVectorStore, storeChunks, searchSimilar, clearChunks, isPgvectorActive } = require('../server/src/rag/vectorStore');
const specStore = require('../server/src/services/specStore');
const { parseAndValidateOpenApi } = require('../server/src/services/openApiParser');
const { runAgentInvestigation } = require('../server/src/agent/agentOrchestrator');
const sandboxApp = require('../sandbox-api/src/app');

const SANDBOX_PORT = 4059;

async function verifyLiveGemini() {
  console.log('\n===============================================================');
  console.log('🔍 TESTPILOT - LIVE GEMINI INTEGRATION & FALLBACK AUDIT');
  console.log('===============================================================\n');

  const apiKey = config.GEMINI_API_KEY;
  const isKeyConfigured = Boolean(apiKey && apiKey.trim().length > 10 && !apiKey.includes('your_'));

  console.log(`[STATUS] GEMINI_API_KEY configured: ${isKeyConfigured ? 'YES (Valid key string present)' : 'NO (Missing or placeholder in server/.env)'}`);
  console.log(`[CONFIG] Model: ${config.GEMINI_MODEL}`);
  console.log(`[CONFIG] Embedding Model: text-embedding-004 (${EMBEDDING_DIMENSION} dimensions)`);

  // Initialize PostgreSQL vector store
  await initVectorStore().catch((err) => {
    console.warn('[WARN] PostgreSQL pgvector initialization warning:', err.message);
  });

  const pgActive = isPgvectorActive();
  console.log(`[DATABASE] PostgreSQL + pgvector active: ${pgActive ? 'YES' : 'NO (Using in-memory fallback)'}`);

  // Load sample OpenAPI specification into memory
  const sampleYaml = fs.readFileSync(path.join(__dirname, '../examples/sandbox-openapi.yaml'));
  const parsedSpec = await parseAndValidateOpenApi(sampleYaml, 'sandbox-openapi.yaml');
  specStore.setCurrentSpec(parsedSpec);

  // Boot sandbox server for test execution
  let sandboxServer = null;
  await new Promise((resolve) => {
    sandboxServer = sandboxApp.listen(SANDBOX_PORT, '127.0.0.1', () => {
      resolve();
    });
    sandboxServer.on('error', () => resolve());
  });

  const auditReport = {
    apiKeyConfigured: isKeyConfigured,
    geminiLiveTextGeneration: 'NOT_TESTED',
    geminiLiveEmbedding: 'NOT_TESTED',
    pgvectorStorageAndSearch: 'NOT_TESTED',
    liveAgentInvestigation: 'NOT_TESTED',
    fallbackGenerationPassed: false,
    fallbackEmbeddingPassed: false,
    notes: [],
  };

  if (!isKeyConfigured) {
    console.log('\n⚠️ NOTICE: GEMINI_API_KEY is not configured in server/.env.');
    console.log('Testing deterministic offline fallback mode (No live external API calls will be fabricated)...\n');
    auditReport.notes.push('GEMINI_API_KEY missing or placeholder in server/.env. System operating in deterministic fallback mode.');

    // 1. Verify Fallback Embedding
    try {
      const fallbackVec = await embedText('GET /users retrieve all users');
      assert.strictEqual(fallbackVec.length, EMBEDDING_DIMENSION, `Expected ${EMBEDDING_DIMENSION} dimensions`);
      auditReport.fallbackEmbeddingPassed = true;
      console.log('✅ PASS | Deterministic 768-dim embedding generator operational.');
    } catch (err) {
      console.error('❌ FAIL | Deterministic embedding fallback:', err.message);
    }

    // 2. Verify pgvector storage with deterministic embedding
    if (pgActive) {
      try {
        await clearChunks();
        const testChunk = {
          id: 'chunk_test_audit_1',
          endpointMethod: 'GET',
          endpointPath: '/users',
          chunkType: 'ENDPOINT_SUMMARY',
          content: 'GET /users returns user list',
          tokenCount: 8,
          embedding: await embedText('GET /users returns user list'),
        };
        await storeChunks([testChunk]);
        const searchResults = await searchSimilar(testChunk.embedding, 1);
        assert(searchResults.length > 0);
        auditReport.pgvectorStorageAndSearch = 'LIVE_DB_WITH_FALLBACK_EMBEDDINGS';
        console.log('✅ PASS | PostgreSQL pgvector successfully stored and retrieved vectors with cosine similarity.');
      } catch (err) {
        console.error('❌ FAIL | pgvector storage check:', err.message);
      }
    }

    // 3. Verify Deterministic Agent Investigation against Sandbox
    try {
      const agentRun = await runAgentInvestigation({
        endpointId: 'getallusers',
        objective: 'Audit sandbox API user list retrieval in fallback mode',
        categories: ['positive'],
      });
      assert.strictEqual(agentRun.status, 'COMPLETED');
      assert(agentRun.executedTests.length > 0);
      auditReport.fallbackGenerationPassed = true;
      console.log(`✅ PASS | Deterministic autonomous agent completed investigation (${agentRun.executedTests.length} tests executed against sandbox).`);
    } catch (err) {
      console.error('❌ FAIL | Deterministic agent investigation:', err.message);
    }
  } else {
    console.log('\n📡 Performing LIVE Google Gemini API verification...\n');

    // 1. Live Gemini Text Generation
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: 'Return a JSON array of 1 API test case with keys: testName, method, path, expectedStatus.',
      });
      assert(response.text, 'Expected response text from Gemini');
      auditReport.geminiLiveTextGeneration = 'LIVE_SUCCESS';
      console.log('✅ PASS | Live Gemini Text Generation confirmed with model:', config.GEMINI_MODEL);
    } catch (err) {
      auditReport.geminiLiveTextGeneration = `FAILED: ${err.message}`;
      console.error('❌ FAIL | Live Gemini Text Generation:', err.message);
    }

    // 2. Live Gemini Embedding
    try {
      const ai = new GoogleGenAI({ apiKey });
      const embedRes = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: 'TestPilot OpenAPI specification documentation retrieval',
      });
      const vec = embedRes.embedding?.values;
      assert(Array.isArray(vec) && vec.length === EMBEDDING_DIMENSION);
      auditReport.geminiLiveEmbedding = 'LIVE_SUCCESS';
      console.log('✅ PASS | Live Gemini 768-dim Embedding confirmed with text-embedding-004');

      // 3. Store Live Embedding in PostgreSQL pgvector
      if (pgActive) {
        await clearChunks();
        const liveChunk = {
          id: 'chunk_live_gemini_1',
          endpointMethod: 'GET',
          endpointPath: '/users',
          chunkType: 'ENDPOINT_SUMMARY',
          content: 'Live Gemini embedded OpenAPI documentation for /users endpoint',
          tokenCount: 12,
          embedding: vec,
        };
        await storeChunks([liveChunk]);
        const results = await searchSimilar(vec, 1);
        assert(results.length > 0);
        auditReport.pgvectorStorageAndSearch = 'LIVE_SUCCESS';
        console.log('✅ PASS | Stored and retrieved live Gemini embeddings through PostgreSQL pgvector.');
      }
    } catch (err) {
      auditReport.geminiLiveEmbedding = `FAILED: ${err.message}`;
      console.error('❌ FAIL | Live Gemini Embedding:', err.message);
    }

    // 4. Live Agent Investigation with Gemini
    try {
      const liveRun = await runAgentInvestigation({
        endpointId: 'getallusers',
        objective: 'Live Gemini autonomous testing of GET /users',
        categories: ['positive'],
      });
      assert.strictEqual(liveRun.status, 'COMPLETED');
      auditReport.liveAgentInvestigation = 'LIVE_SUCCESS';
      console.log(`✅ PASS | Complete Live Agent Investigation finished with status: ${liveRun.status}`);
    } catch (err) {
      auditReport.liveAgentInvestigation = `FAILED: ${err.message}`;
      console.error('❌ FAIL | Live Agent Investigation:', err.message);
    }
  }

  // Teardown sandbox
  if (sandboxServer) {
    await new Promise((resolve) => sandboxServer.close(resolve));
  }

  console.log('\n===============================================================');
  console.log('📋 AUDIT REPORT SUMMARY:');
  console.log('===============================================================');
  console.log(JSON.stringify(auditReport, null, 2));
  console.log('===============================================================\n');

  return auditReport;
}

if (require.main === module) {
  verifyLiveGemini().catch((err) => {
    console.error('Fatal audit error:', err);
    process.exitCode = 1;
  });
}

module.exports = { verifyLiveGemini };

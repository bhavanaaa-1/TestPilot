/**
 * Vector Store for RAG Pipeline
 * Manages chunk storage and cosine-similarity vector searches in PostgreSQL (pgvector).
 * Provides a resilient in-memory fallback index if PostgreSQL is not currently connected.
 */

const pg = require('pg');
const config = require('../config/env');
const { EMBEDDING_DIMENSION } = require('./embeddingService');

const { Pool } = pg;

let pool = null;
let isPgvectorEnabled = false;
let dbInitAttempted = false;

// Resilient in-memory vector store fallback
const inMemoryChunks = new Map();

function calculateCosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getDbPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || 'testpilot'}:${process.env.POSTGRES_PASSWORD || 'testpilot_secret'}@localhost:${process.env.POSTGRES_PORT || '5433'}/${process.env.POSTGRES_DB || 'testpilot'}`;

    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.warn(`[WARN] PostgreSQL Pool error: ${err.message}`);
    });
  }
  return pool;
}

async function initVectorStore() {
  if (dbInitAttempted && isPgvectorEnabled) return true;
  dbInitAttempted = true;

  try {
    const currentPool = getDbPool();
    const client = await currentPool.connect();

    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

      await client.query(`
        CREATE TABLE IF NOT EXISTS api_doc_chunks (
          id VARCHAR(255) PRIMARY KEY,
          spec_title VARCHAR(255),
          spec_version VARCHAR(50),
          endpoint_id VARCHAR(255),
          path VARCHAR(255),
          method VARCHAR(20),
          chunk_type VARCHAR(50),
          content TEXT NOT NULL,
          metadata JSONB,
          embedding vector(${EMBEDDING_DIMENSION}),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS api_doc_chunks_embedding_idx 
          ON api_doc_chunks USING hnsw (embedding vector_cosine_ops);
        `);
      } catch {
        // HNSW fallback
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS test_execution_runs (
          id VARCHAR(255) PRIMARY KEY,
          spec_title VARCHAR(255),
          endpoint_id VARCHAR(255),
          status VARCHAR(50) DEFAULT 'COMPLETED',
          total_tests INT DEFAULT 0,
          passed_count INT DEFAULT 0,
          failed_count INT DEFAULT 0,
          duration_ms INT DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS test_case_results (
          id VARCHAR(255) PRIMARY KEY,
          run_id VARCHAR(255) REFERENCES test_execution_runs(id) ON DELETE CASCADE,
          test_case_id VARCHAR(255),
          test_name VARCHAR(255),
          category VARCHAR(50),
          method VARCHAR(20),
          path VARCHAR(255),
          target_url TEXT,
          request_headers JSONB,
          request_body JSONB,
          expected_status INT,
          actual_status INT,
          status_matches BOOLEAN DEFAULT FALSE,
          expected_conditions JSONB,
          condition_evaluations JSONB,
          actual_response_body JSONB,
          actual_response_headers JSONB,
          duration_ms INT DEFAULT 0,
          status VARCHAR(50),
          error_message TEXT,
          diagnosis JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS agent_runs (
          id VARCHAR(255) PRIMARY KEY,
          endpoint_id VARCHAR(255),
          objective TEXT,
          status VARCHAR(50) DEFAULT 'IN_PROGRESS',
          spec_title VARCHAR(255),
          endpoint_path VARCHAR(255),
          endpoint_method VARCHAR(20),
          test_execution_run_id VARCHAR(255),
          summary TEXT,
          evidence JSONB,
          suggested_fixes JSONB,
          total_tokens INT DEFAULT 0,
          estimated_cost DOUBLE PRECISION DEFAULT 0.0,
          duration_ms INT DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE IF NOT EXISTS agent_trace_steps (
          id VARCHAR(255) PRIMARY KEY,
          agent_run_id VARCHAR(255) REFERENCES agent_runs(id) ON DELETE CASCADE,
          step_number INT,
          step_type VARCHAR(50),
          tool_name VARCHAR(100),
          tool_args JSONB,
          tool_result JSONB,
          step_status VARCHAR(50) DEFAULT 'SUCCESS',
          notes TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS evaluation_runs (
          id VARCHAR(255) PRIMARY KEY,
          dataset_id VARCHAR(100),
          dataset_version VARCHAR(50),
          dataset_name VARCHAR(255),
          total_cases INT DEFAULT 0,
          passed_cases INT DEFAULT 0,
          failed_cases INT DEFAULT 0,
          overall_score DOUBLE PRECISION DEFAULT 0.0,
          schema_validity_rate DOUBLE PRECISION DEFAULT 0.0,
          endpoint_accuracy DOUBLE PRECISION DEFAULT 0.0,
          method_accuracy DOUBLE PRECISION DEFAULT 0.0,
          status_accuracy DOUBLE PRECISION DEFAULT 0.0,
          category_coverage DOUBLE PRECISION DEFAULT 0.0,
          duration_ms INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'COMPLETED',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS evaluation_case_results (
          id VARCHAR(255) PRIMARY KEY,
          evaluation_run_id VARCHAR(255) REFERENCES evaluation_runs(id) ON DELETE CASCADE,
          case_id VARCHAR(100),
          endpoint VARCHAR(100),
          scenario_type VARCHAR(50),
          passed BOOLEAN DEFAULT false,
          score DOUBLE PRECISION DEFAULT 0.0,
          metrics JSONB,
          generated_tests JSONB,
          reference_tests JSONB,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      isPgvectorEnabled = true;
      console.log('✅ [RAG] PostgreSQL + pgvector vector store initialized successfully.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    isPgvectorEnabled = false;
    return false;
  }
}

function isPgvectorActive() {
  return isPgvectorEnabled;
}

async function storeChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { insertedCount: 0, backend: isPgvectorEnabled ? 'pgvector' : 'in-memory' };
  }

  for (const chunk of chunks) {
    inMemoryChunks.set(chunk.id, chunk);
  }

  if (!dbInitAttempted) {
    await initVectorStore();
  }

  if (isPgvectorEnabled) {
    const currentPool = getDbPool();
    const client = await currentPool.connect();
    try {
      await client.query('BEGIN;');
      for (const chunk of chunks) {
        const vectorStr = `[${chunk.embedding.join(',')}]`;
        await client.query(
          `
          INSERT INTO api_doc_chunks (
            id, spec_title, spec_version, endpoint_id, path, method, chunk_type, content, metadata, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            created_at = NOW();
          `,
          [
            chunk.id,
            chunk.specTitle || null,
            chunk.specVersion || null,
            chunk.endpointId || null,
            chunk.path || null,
            chunk.method || null,
            chunk.chunkType || 'general',
            chunk.content,
            JSON.stringify(chunk.metadata || {}),
            vectorStr,
          ]
        );
      }
      await client.query('COMMIT;');
      return { insertedCount: chunks.length, backend: 'pgvector' };
    } catch (err) {
      await client.query('ROLLBACK;');
    } finally {
      client.release();
    }
  }

  return { insertedCount: chunks.length, backend: 'in-memory' };
}

async function searchSimilar(queryVector, options = {}) {
  const { topK = 5, minSimilarity = 0.25, endpointId = null, chunkType = null } = options;

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new Error('searchSimilar requires a non-empty queryVector array');
  }

  if (isPgvectorEnabled) {
    try {
      const currentPool = getDbPool();
      const vectorStr = `[${queryVector.join(',')}]`;

      const result = await currentPool.query(
        `
        SELECT 
          id, spec_title AS "specTitle", spec_version AS "specVersion",
          endpoint_id AS "endpointId", path, method, chunk_type AS "chunkType",
          content, metadata,
          1 - (embedding <=> $1::vector) AS similarity
        FROM api_doc_chunks
        WHERE ($2::text IS NULL OR endpoint_id = $2)
          AND ($3::text IS NULL OR chunk_type = $3)
          AND (1 - (embedding <=> $1::vector)) >= $4
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $5;
        `,
        [vectorStr, endpointId, chunkType, minSimilarity, topK]
      );

      return result.rows.map((row) => ({
        ...row,
        similarity: parseFloat(Number(row.similarity).toFixed(4)),
      }));
    } catch (err) {
      // Fallback to in-memory
    }
  }

  const results = [];
  for (const chunk of inMemoryChunks.values()) {
    if (endpointId && chunk.endpointId && chunk.endpointId !== endpointId) {
      continue;
    }
    if (chunkType && chunk.chunkType !== chunkType) {
      continue;
    }

    const similarity = calculateCosineSimilarity(queryVector, chunk.embedding);
    if (similarity >= minSimilarity) {
      results.push({
        id: chunk.id,
        specTitle: chunk.specTitle,
        specVersion: chunk.specVersion,
        endpointId: chunk.endpointId,
        path: chunk.path,
        method: chunk.method,
        chunkType: chunk.chunkType,
        content: chunk.content,
        metadata: chunk.metadata,
        similarity: parseFloat(similarity.toFixed(4)),
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

async function clearChunks(specTitle = null) {
  if (specTitle) {
    for (const [id, chunk] of inMemoryChunks.entries()) {
      if (chunk.specTitle === specTitle) {
        inMemoryChunks.delete(id);
      }
    }
  } else {
    inMemoryChunks.clear();
  }

  if (isPgvectorEnabled) {
    try {
      const currentPool = getDbPool();
      if (specTitle) {
        await currentPool.query('DELETE FROM api_doc_chunks WHERE spec_title = $1;', [specTitle]);
      } else {
        await currentPool.query('TRUNCATE TABLE api_doc_chunks;');
      }
    } catch {
      // Ignored
    }
  }

  return { success: true };
}

async function getStats() {
  let pgCount = 0;
  if (isPgvectorEnabled) {
    try {
      const currentPool = getDbPool();
      const res = await currentPool.query('SELECT COUNT(*) AS total FROM api_doc_chunks;');
      pgCount = parseInt(res.rows[0].total, 10);
    } catch {
      // Ignored
    }
  }

  return {
    backend: isPgvectorEnabled ? 'PostgreSQL + pgvector' : 'In-Memory Vector Store',
    isPgvectorEnabled,
    dimension: EMBEDDING_DIMENSION,
    totalChunks: isPgvectorEnabled ? pgCount : inMemoryChunks.size,
    inMemoryChunksCount: inMemoryChunks.size,
  };
}

async function persistExecutionRun(runRecord) {
  if (!runRecord || !runRecord.id) return false;
  if (!dbInitAttempted) await initVectorStore();
  if (!isPgvectorEnabled) return false;

  try {
    const currentPool = getDbPool();
    const client = await currentPool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(
        `INSERT INTO test_execution_runs (id, spec_title, endpoint_id, total_tests, passed_count, failed_count, duration_ms, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           total_tests = EXCLUDED.total_tests,
           passed_count = EXCLUDED.passed_count,
           failed_count = EXCLUDED.failed_count,
           duration_ms = EXCLUDED.duration_ms,
           status = EXCLUDED.status;`,
        [
          runRecord.id,
          runRecord.specTitle || 'Unknown Spec',
          runRecord.endpointId || null,
          runRecord.totalTests || 0,
          runRecord.passedCount || 0,
          runRecord.failedCount || 0,
          runRecord.durationMs || 0,
          runRecord.status || 'COMPLETED',
          runRecord.createdAt || new Date(),
        ]
      );

      if (Array.isArray(runRecord.results)) {
        for (const res of runRecord.results) {
          const resId = `${runRecord.id}_${res.testCaseId || Math.random().toString(36).substring(2, 7)}`;
          await client.query(
            `INSERT INTO test_case_results (
               id, run_id, test_case_id, test_name, category, method, path, target_url,
               expected_status, actual_status, status_matches, condition_evaluations,
               actual_response_body, actual_response_headers, duration_ms, status, error_message, diagnosis
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             ON CONFLICT (id) DO NOTHING;`,
            [
              resId,
              runRecord.id,
              res.testCaseId || 'tc_unknown',
              res.testName || 'Unknown Test',
              res.category || 'positive',
              res.method || 'GET',
              res.path || '/',
              res.targetUrl || '',
              res.expectedStatus || 200,
              res.actualStatus || null,
              Boolean(res.statusMatches),
              JSON.stringify(res.conditionEvaluations || []),
              JSON.stringify(res.actualResponseBody || null),
              JSON.stringify(res.actualResponseHeaders || {}),
              res.durationMs || 0,
              res.status || 'FAILED',
              res.errorMessage || null,
              JSON.stringify(res.diagnosis || null),
            ]
          );
        }
      }
      await client.query('COMMIT;');
      return true;
    } catch (err) {
      await client.query('ROLLBACK;');
      return false;
    } finally {
      client.release();
    }
  } catch (err) {
    return false;
  }
}

async function persistAgentRun(agentRun) {
  if (!agentRun || !agentRun.id) return false;
  if (!dbInitAttempted) await initVectorStore();
  if (!isPgvectorEnabled) return false;

  try {
    const currentPool = getDbPool();
    const client = await currentPool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(
        `INSERT INTO agent_runs (
           id, endpoint_id, objective, status, spec_title, endpoint_path, endpoint_method,
           summary, evidence, suggested_fixes, duration_ms, created_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           summary = EXCLUDED.summary,
           evidence = EXCLUDED.evidence,
           suggested_fixes = EXCLUDED.suggested_fixes,
           duration_ms = EXCLUDED.duration_ms,
           completed_at = EXCLUDED.completed_at;`,
        [
          agentRun.id,
          agentRun.endpointId || null,
          agentRun.objective || '',
          agentRun.status || 'COMPLETED',
          agentRun.specTitle || 'TestPilot API Spec',
          agentRun.endpointPath || null,
          agentRun.endpointMethod || null,
          agentRun.summary || '',
          JSON.stringify(agentRun.evidence || []),
          JSON.stringify(agentRun.suggestedFixes || []),
          agentRun.durationMs || 0,
          agentRun.createdAt || new Date(),
          agentRun.completedAt || new Date(),
        ]
      );

      if (Array.isArray(agentRun.traceSteps)) {
        for (const step of agentRun.traceSteps) {
          const stepId = `${agentRun.id}_step_${step.stepNumber}`;
          await client.query(
            `INSERT INTO agent_trace_steps (
               id, agent_run_id, step_number, step_type, tool_name, tool_args, tool_result, step_status, notes, timestamp
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING;`,
            [
              stepId,
              agentRun.id,
              step.stepNumber,
              step.stepType || 'TOOL_CALL',
              step.toolName || null,
              JSON.stringify(step.toolArgs || null),
              JSON.stringify(step.toolResult || null),
              step.stepStatus || 'SUCCESS',
              step.notes || '',
              step.timestamp || new Date(),
            ]
          );
        }
      }
      await client.query('COMMIT;');
      return true;
    } catch (err) {
      await client.query('ROLLBACK;');
      return false;
    } finally {
      client.release();
    }
  } catch (err) {
    return false;
  }
}

async function persistEvaluationRun(evalRun) {
  if (!evalRun || !evalRun.id) return false;
  if (!dbInitAttempted) await initVectorStore();
  if (!isPgvectorEnabled) return false;

  try {
    const currentPool = getDbPool();
    const client = await currentPool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(
        `INSERT INTO evaluation_runs (
           id, dataset_id, dataset_version, dataset_name, total_cases, passed_cases, failed_cases,
           overall_score, schema_validity_rate, endpoint_accuracy, method_accuracy, status_accuracy,
           category_coverage, duration_ms, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           passed_cases = EXCLUDED.passed_cases,
           failed_cases = EXCLUDED.failed_cases,
           overall_score = EXCLUDED.overall_score,
           status = EXCLUDED.status;`,
        [
          evalRun.id,
          evalRun.datasetId || 'benchmark-v1',
          evalRun.datasetVersion || '1.0.0',
          evalRun.datasetName || 'Benchmark',
          evalRun.totalCases || 0,
          evalRun.passedCases || 0,
          evalRun.failedCases || 0,
          evalRun.overallScore || 0.0,
          evalRun.schemaValidityRate || 0.0,
          evalRun.endpointAccuracy || 0.0,
          evalRun.methodAccuracy || 0.0,
          evalRun.statusAccuracy || 0.0,
          evalRun.categoryCoverage || 0.0,
          evalRun.durationMs || 0,
          evalRun.status || 'COMPLETED',
          evalRun.createdAt || new Date(),
        ]
      );

      if (Array.isArray(evalRun.caseResults)) {
        for (const c of evalRun.caseResults) {
          const caseResId = `${evalRun.id}_${c.caseId}`;
          await client.query(
            `INSERT INTO evaluation_case_results (
               id, evaluation_run_id, case_id, endpoint, scenario_type, passed, score,
               metrics, generated_tests, reference_tests, notes, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO NOTHING;`,
            [
              caseResId,
              evalRun.id,
              c.caseId,
              c.endpoint || '',
              c.scenarioType || 'positive',
              Boolean(c.passed),
              c.score || 0.0,
              JSON.stringify(c.metrics || {}),
              JSON.stringify(c.generatedTests || []),
              JSON.stringify(c.referenceTests || []),
              c.notes || '',
              new Date(),
            ]
          );
        }
      }
      await client.query('COMMIT;');
      return true;
    } catch (err) {
      await client.query('ROLLBACK;');
      return false;
    } finally {
      client.release();
    }
  } catch (err) {
    return false;
  }
}

module.exports = {
  calculateCosineSimilarity,
  getDbPool,
  initVectorStore,
  isPgvectorActive,
  storeChunks,
  searchSimilar,
  clearChunks,
  getStats,
  persistExecutionRun,
  persistAgentRun,
  persistEvaluationRun,
};

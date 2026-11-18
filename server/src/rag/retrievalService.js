/**
 * RAG Retrieval Service
 * Coordinates the end-to-end Retrieval-Augmented Generation pipeline:
 * specification indexing, vector retrieval, and context synthesis.
 */

const { chunkSpecification } = require('./chunker');
const { embedChunks, embedText } = require('./embeddingService');
const { storeChunks, searchSimilar, clearChunks, getStats, initVectorStore } = require('./vectorStore');
const specStore = require('../services/specStore');

let lastIndexedSpecTitle = null;
let lastIndexedAt = null;

async function indexSpecification(spec) {
  if (!spec || !spec.info) {
    throw new Error('indexSpecification requires a valid specification object with spec.info');
  }

  const startTime = performance.now();
  await initVectorStore();

  const chunks = chunkSpecification(spec);
  await clearChunks(spec.info.title);
  const embeddedChunks = await embedChunks(chunks);
  const storeResult = await storeChunks(embeddedChunks);

  const durationMs = Math.round(performance.now() - startTime);
  lastIndexedSpecTitle = spec.info.title;
  lastIndexedAt = new Date().toISOString();

  return {
    success: true,
    specTitle: spec.info.title,
    specVersion: spec.info.version,
    chunksIndexed: chunks.length,
    backend: storeResult.backend,
    durationMs,
    indexedAt: lastIndexedAt,
  };
}

async function retrieveContext(query, options = {}) {
  const { topK = 4, minSimilarity = 0.1, endpointId = null, chunkType = null } = options;

  if (!query || typeof query !== 'string') {
    throw new Error('retrieveContext requires a valid search query string');
  }

  const queryVector = await embedText(query);
  const matches = await searchSimilar(queryVector, {
    topK,
    minSimilarity,
    endpointId,
    chunkType,
  });

  const contextSections = matches.map((m, idx) => {
    const header = `[Context #${idx + 1} | Type: ${m.chunkType} | Similarity: ${(m.similarity * 100).toFixed(1)}%]`;
    return `${header}\n${m.content}`;
  });

  const formattedContext = contextSections.length > 0
    ? contextSections.join('\n\n---\n\n')
    : 'No directly matching specification documentation retrieved.';

  return {
    query,
    matchCount: matches.length,
    topSimilarity: matches.length > 0 ? matches[0].similarity : 0,
    matches,
    formattedContext,
  };
}

async function reindexCurrentSpec() {
  const spec = specStore.getCurrentSpec();
  if (!spec) {
    throw new Error('No specification currently loaded in TestPilot memory to index.');
  }
  return await indexSpecification(spec);
}

async function getRagStatus() {
  const storeStats = await getStats();
  const currentSpec = specStore.getCurrentSpec();

  return {
    indexed: Boolean(lastIndexedSpecTitle),
    lastIndexedSpecTitle,
    lastIndexedAt,
    activeSpecLoaded: Boolean(currentSpec),
    activeSpecTitle: currentSpec?.info?.title || null,
    vectorStore: storeStats,
  };
}

module.exports = {
  indexSpecification,
  retrieveContext,
  reindexCurrentSpec,
  getRagStatus,
};

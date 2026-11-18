/**
 * Gemini Vector Embedding Service
 * Generates dense 768-dimensional embeddings for RAG retrieval
 * using Google's text-embedding-004 model via @google/genai.
 */

const { GoogleGenAI } = require('@google/genai');
const config = require('../config/env');

const EMBEDDING_DIMENSION = 768;
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';

let mockEmbeddingGenerator = null;

function setMockEmbeddingGenerator(fn) {
  mockEmbeddingGenerator = fn;
}

function clearMockEmbeddingGenerator() {
  mockEmbeddingGenerator = null;
}

/**
 * Creates a deterministic, normalized 768-dimensional pseudo-embedding from text.
 * Used for offline integration testing and fallback when API key is unconfigured.
 */
function generateDeterministicEmbedding(text, dimension = EMBEDDING_DIMENSION) {
  const vector = new Array(dimension).fill(0);
  const normalizedText = String(text || '').toLowerCase();
  const words = normalizedText.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    vector[0] = 1.0;
    return vector;
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimension;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[idx] += sign * (1.0 / (i + 1));

    const nextIdx = (idx + 1) % dimension;
    vector[nextIdx] += sign * 0.5;
  }

  // Normalize to unit length (L2 norm)
  let norm = 0;
  for (let i = 0; i < dimension; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimension; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }
  } else {
    vector[0] = 1.0;
  }

  return vector;
}

async function embedText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('embedText requires a non-empty string argument');
  }

  if (mockEmbeddingGenerator) {
    return await mockEmbeddingGenerator(text);
  }

  const apiKey = options.apiKey || config.GEMINI_API_KEY;
  const modelName = options.model || process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  if (!apiKey || apiKey === 'placeholder_or_unset') {
    return generateDeterministicEmbedding(text, EMBEDDING_DIMENSION);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: modelName,
      contents: text,
    });

    if (response?.embedding?.values && Array.isArray(response.embedding.values)) {
      return response.embedding.values;
    }

    throw new Error('Gemini embedding API response did not contain embedding.values array');
  } catch (err) {
    console.warn(`[WARN] Gemini embedContent failed: ${err.message}. Using deterministic embedding fallback.`);
    return generateDeterministicEmbedding(text, EMBEDDING_DIMENSION);
  }
}

async function embedChunks(chunks, options = {}) {
  if (!Array.isArray(chunks)) {
    throw new Error('embedChunks requires an array of chunk objects');
  }

  const results = [];
  for (const chunk of chunks) {
    const embedding = await embedText(chunk.content, options);
    results.push({
      ...chunk,
      embedding,
    });
  }
  return results;
}

module.exports = {
  EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  setMockEmbeddingGenerator,
  clearMockEmbeddingGenerator,
  generateDeterministicEmbedding,
  embedText,
  embedChunks,
};

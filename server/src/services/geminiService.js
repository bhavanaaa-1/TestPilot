const { GoogleGenAI } = require('@google/genai');
const config = require('../config/env');
const { FUNCTION_DECLARATIONS, executeTool } = require('./geminiTools');
const { SYSTEM_INSTRUCTION, buildTestGenerationPrompt } = require('./promptBuilder');
const { validateGeneratedTests } = require('../schemas/testCase.schema');
const usageStore = require('./usageStore');

const MAX_TOOL_TURNS = 5;

// Mock generator hook for testing without external API calls
let mockGenerator = null;

function setMockGenerator(fn) {
  mockGenerator = fn;
}

function clearMockGenerator() {
  mockGenerator = null;
}

/**
 * Creates or retrieves the GoogleGenAI client
 */
function getGenAiClient(apiKeyOverride) {
  const apiKey = apiKeyOverride || config.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    const error = new Error(
      'Google Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env to use AI features.'
    );
    error.status = 400;
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

/**
 * Strips code fences and parses JSON response from model text
 */
function parseModelJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Model produced an empty or non-string response');
  }

  let text = rawText.trim();
  // Strip ```json and ``` code block wrappers if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Attempt parse
  try {
    return JSON.parse(text);
  } catch (err) {
    const error = new Error(`Failed to parse model output as JSON: ${err.message}`);
    error.status = 502;
    error.code = 'MODEL_OUTPUT_INVALID_JSON';
    error.rawOutput = rawText.slice(0, 500);
    throw error;
  }
}

/**
 * Generates automated API tests for a selected endpoint using Google Gemini with function calling
 */
async function generateTestsForEndpoint({
  endpoint,
  spec,
  categories = ['positive', 'negative', 'boundary'],
  apiKeyOverride,
  modelOverride,
}) {
  if (!endpoint || !endpoint.id) {
    const error = new Error("Invalid endpoint specified for test generation.");
    error.status = 400;
    error.code = 'INVALID_ENDPOINT';
    throw error;
  }

  const modelName = modelOverride || config.GEMINI_MODEL || 'gemini-2.5-flash';
  const startTime = Date.now();
  const toolInvocations = [];

  // 1. If mock generator is active (for automated unit testing), delegate to mock
  if (typeof mockGenerator === 'function') {
    const mockResult = await mockGenerator({
      endpoint,
      spec,
      categories,
      modelName,
      executeTool: (name, args) => {
        const res = executeTool(name, args, spec);
        toolInvocations.push({
          toolName: name,
          args,
          resultSummary: res.error ? 'Error: ' + res.error : 'Success',
          timestamp: new Date().toISOString(),
        });
        return res;
      },
    });

    const durationMs = Date.now() - startTime;
    const inputTokens = mockResult.usageMetadata?.inputTokens || 420;
    const outputTokens = mockResult.usageMetadata?.outputTokens || 280;
    const totalTokens = inputTokens + outputTokens;

    // Validate with Zod
    const validation = validateGeneratedTests(mockResult.data);
    if (!validation.success) {
      const error = new Error(`Generated tests failed schema validation: ${validation.error.message}`);
      error.status = 502;
      error.code = 'SCHEMA_VALIDATION_FAILED';
      error.details = validation.error.format();
      throw error;
    }

    const usageRecord = usageStore.recordUsage({
      model: modelName,
      inputTokens,
      outputTokens,
      totalTokens,
      durationMs,
      endpointId: endpoint.id,
      testCount: validation.data.tests.length,
      toolCallsCount: toolInvocations.length,
      success: true,
    });

    return {
      tests: validation.data.tests,
      endpointId: endpoint.id,
      endpointPath: endpoint.path,
      method: endpoint.method,
      usage: usageRecord,
      toolInvocations,
    };
  }

  // 2. Real Gemini Client instantiation
  const ai = getGenAiClient(apiKeyOverride);

  const promptText = buildTestGenerationPrompt({ endpoint, spec, categories });

  const contents = [
    {
      role: 'user',
      parts: [{ text: promptText }],
    },
  ];

  const requestConfig = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    temperature: 0.2,
  };

  let finalResponse = null;
  let turn = 0;
  let lastUsage = null;

  try {
    // Bounded function-calling loop
    while (turn < MAX_TOOL_TURNS) {
      turn++;

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: requestConfig,
      });

      if (response.usageMetadata) {
        lastUsage = response.usageMetadata;
      }

      // Check if model requested function calls
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // Execute tool calls
        for (const fc of functionCalls) {
          const result = executeTool(fc.name, fc.args, spec);
          toolInvocations.push({
            toolName: fc.name,
            args: fc.args,
            resultSummary: result.error ? 'Error' : 'Success',
            timestamp: new Date().toISOString(),
          });

          // Add model tool call turn
          contents.push({
            role: 'model',
            parts: [{ functionCall: fc }],
          });

          // Add tool response turn
          contents.push({
            role: 'tool',
            parts: [
              {
                functionResponse: {
                  name: fc.name,
                  response: result,
                },
              },
            ],
          });
        }
      } else {
        // Model returned final content
        finalResponse = response;
        break;
      }
    }

    if (!finalResponse) {
      const error = new Error('Function calling loop exceeded maximum iterations without producing final tests.');
      error.status = 504;
      error.code = 'MAX_TURNS_EXCEEDED';
      throw error;
    }

    const durationMs = Date.now() - startTime;
    const rawText = finalResponse.text;
    const parsedData = parseModelJson(rawText);

    // Validate with Zod
    const validation = validateGeneratedTests(parsedData);
    if (!validation.success) {
      const error = new Error(`Model generated tests failed strict schema validation: ${validation.error.message}`);
      error.status = 502;
      error.code = 'SCHEMA_VALIDATION_FAILED';
      error.details = validation.error.format();
      throw error;
    }

    const inputTokens = lastUsage?.promptTokenCount || Math.round(promptText.length / 4);
    const outputTokens = lastUsage?.candidatesTokenCount || Math.round((rawText || '').length / 4);
    const totalTokens = lastUsage?.totalTokenCount || inputTokens + outputTokens;

    const usageRecord = usageStore.recordUsage({
      model: modelName,
      inputTokens,
      outputTokens,
      totalTokens,
      durationMs,
      endpointId: endpoint.id,
      testCount: validation.data.tests.length,
      toolCallsCount: toolInvocations.length,
      success: true,
    });

    return {
      tests: validation.data.tests,
      endpointId: endpoint.id,
      endpointPath: endpoint.path,
      method: endpoint.method,
      usage: usageRecord,
      toolInvocations,
    };
  } catch (err) {
    // Standardize Gemini API errors
    if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
      const error = new Error('Gemini API rate limit exceeded. Please wait a moment before generating more tests.');
      error.status = 429;
      error.code = 'RATE_LIMIT_EXCEEDED';
      throw error;
    }

    if (err.status === 401 || err.status === 403 || err.message?.includes('API_KEY_INVALID') || err.message?.includes('permission')) {
      const error = new Error('Invalid or unauthorized Gemini API key. Please verify your GEMINI_API_KEY in server/.env.');
      error.status = 401;
      error.code = 'INVALID_API_KEY';
      throw error;
    }

    // Pass through if already status-coded
    if (err.status) {
      throw err;
    }

    const error = new Error(`Gemini API error: ${err.message}`);
    error.status = 502;
    error.code = 'GEMINI_API_ERROR';
    throw error;
  }
}

module.exports = {
  getGenAiClient,
  generateTestsForEndpoint,
  parseModelJson,
  setMockGenerator,
  clearMockGenerator,
};

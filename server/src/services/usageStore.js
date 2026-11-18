/**
 * In-Memory Token and Cost Usage Store
 * Tracks Gemini API token consumption, duration, and estimated pricing.
 */

// Published Gemini API Pricing per 1,000,000 tokens (USD)
const PRICING_TABLE = {
  'gemini-2.5-flash': {
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    displayName: 'Gemini 2.5 Flash',
  },
  'gemini-1.5-flash': {
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    displayName: 'Gemini 1.5 Flash',
  },
  'gemini-1.5-pro': {
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    displayName: 'Gemini 1.5 Pro',
  },
  default: {
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    displayName: 'Standard Gemini Model',
  },
};

const MAX_RECENT_REQUESTS = 50;

let totalRequests = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalTokens = 0;
let totalEstimatedCost = 0;
let recentRequests = [];

/**
 * Calculates estimated cost for given token counts and model
 */
function calculateCost(modelName = '', inputTokens = 0, outputTokens = 0) {
  const normalizedModel = (modelName || '').toLowerCase().trim();
  const rates = PRICING_TABLE[normalizedModel] || PRICING_TABLE.default;

  const inputCost = (inputTokens / 1_000_000) * rates.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPricePerMillion;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Number(inputCost.toFixed(6)),
    outputCost: Number(outputCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    rates,
  };
}

/**
 * Records an AI generation request in memory
 */
function recordUsage({
  model = 'gemini-2.5-flash',
  inputTokens = 0,
  outputTokens = 0,
  totalTokens: customTotal,
  durationMs = 0,
  endpointId = '',
  testCount = 0,
  success = true,
  toolCallsCount = 0,
}) {
  const calcTotal = customTotal !== undefined ? customTotal : inputTokens + outputTokens;
  const costDetails = calculateCost(model, inputTokens, outputTokens);

  totalRequests += 1;
  totalInputTokens += inputTokens;
  totalOutputTokens += outputTokens;
  totalTokens += calcTotal;
  totalEstimatedCost += costDetails.totalCost;

  const record = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    totalTokens: calcTotal,
    durationMs,
    endpointId,
    testCount,
    toolCallsCount,
    success,
    estimatedCost: costDetails.totalCost,
    estimatedCostFormatted: `$${costDetails.totalCost.toFixed(6)}`,
  };

  recentRequests.unshift(record);
  if (recentRequests.length > MAX_RECENT_REQUESTS) {
    recentRequests = recentRequests.slice(0, MAX_RECENT_REQUESTS);
  }

  return record;
}

/**
 * Returns aggregated statistics and recent requests
 */
function getUsageStats() {
  return {
    summary: {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalEstimatedCost: Number(totalEstimatedCost.toFixed(6)),
      totalEstimatedCostFormatted: `$${totalEstimatedCost.toFixed(6)}`,
      pricingTable: PRICING_TABLE,
      disclaimer: 'Estimated cost calculated from published rates per 1M tokens. Not an actual billing invoice.',
    },
    recentRequests: [...recentRequests],
  };
}

/**
 * Resets usage records (useful for automated testing)
 */
function clearUsage() {
  totalRequests = 0;
  totalInputTokens = 0;
  totalOutputTokens = 0;
  totalTokens = 0;
  totalEstimatedCost = 0;
  recentRequests = [];
}

module.exports = {
  PRICING_TABLE,
  calculateCost,
  recordUsage,
  getUsageStats,
  clearUsage,
};

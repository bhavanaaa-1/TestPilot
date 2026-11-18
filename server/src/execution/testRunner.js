/**
 * API Test Execution Engine
 * Safely dispatches validated test cases against the configured sandbox API,
 * evaluates status codes and response assertions, and records execution metrics.
 */

const { TestCaseSchema } = require('../schemas/testCase.schema');
const { persistExecutionRun } = require('../rag/vectorStore');
const config = require('../config/env');

const DEFAULT_SANDBOX_BASE_URL = 'http://localhost:4000';
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const MAX_RESPONSE_SIZE_BYTES = 1024 * 1024; // 1 MB limit
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// In-memory test execution store
const executionRuns = new Map();

function getSandboxBaseUrl() {
  return process.env.SANDBOX_API_BASE_URL || config.SANDBOX_URL || DEFAULT_SANDBOX_BASE_URL;
}

function validateTestSecurityAndPath(testCase, spec) {
  const method = String(testCase.method || '').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Execution rejected: Unsupported HTTP method '${method}'. Allowed methods: ${Array.from(ALLOWED_METHODS).join(', ')}`);
  }

  const rawPath = String(testCase.path || '').trim();
  if (/^https?:\/\//i.test(rawPath)) {
    throw new Error(`Security violation: External URL '${rawPath}' is forbidden. All test executions are strictly isolated to the sandbox API origin.`);
  }

  if (rawPath.includes('..') || rawPath.includes('\\')) {
    throw new Error(`Security violation: Path traversal or invalid characters detected in path: '${rawPath}'`);
  }

  if (!rawPath.startsWith('/')) {
    throw new Error(`Invalid path: '${rawPath}'. Path must start with '/'`);
  }

  if (spec && Array.isArray(spec.endpoints) && spec.endpoints.length > 0) {
    const isPathPermitted = spec.endpoints.some((ep) => {
      if (ep.method !== method) return false;
      if (ep.path === rawPath) return true;
      const epRegexStr = '^' + ep.path.replace(/\{[^}]+\}/g, '[^/]+').replace(/:[a-zA-Z0-9_]+/g, '[^/]+') + '$';
      const epRegex = new RegExp(epRegexStr);
      return epRegex.test(rawPath);
    });

    if (!isPathPermitted) {
      throw new Error(`Security violation: Endpoint '${method} ${rawPath}' does not exist in the loaded specification.`);
    }
  }

  return true;
}

function resolveTargetPath(path, queryParams = {}, requestBody = null) {
  let resolved = path;
  resolved = resolved.replace(/\{([^}]+)\}/g, (match, paramName) => {
    if (queryParams && queryParams[paramName] !== undefined) {
      return encodeURIComponent(String(queryParams[paramName]));
    }
    if (paramName === 'id' && requestBody?.id) {
      return encodeURIComponent(String(requestBody.id));
    }
    return match;
  });
  return resolved;
}

function evaluateCondition(conditionStr, actualStatus, actualBody) {
  const cond = String(conditionStr || '').toLowerCase();
  let passed = true;
  let reason = 'Assertion passed';

  const statusMatch = cond.match(/(?:status|code)\s*(?:is|=|matches)?\s*(\d{3})/i);
  if (statusMatch) {
    const expectedFromText = parseInt(statusMatch[1], 10);
    if (actualStatus !== expectedFromText) {
      return {
        condition: conditionStr,
        passed: false,
        reason: `Expected status ${expectedFromText} mentioned in condition, but got ${actualStatus}`,
      };
    }
  }

  if (cond.includes('error') || cond.includes('fail') || cond.includes('reject')) {
    if (actualStatus < 400 && !(actualBody?.error || actualBody?.message)) {
      return {
        condition: conditionStr,
        passed: false,
        reason: 'Condition expected error indication, but received 2xx success',
      };
    }
  }

  if (actualBody && typeof actualBody === 'object') {
    if (cond.includes('id') && !cond.includes('invalid id') && !cond.includes('without id')) {
      const hasId =
        actualBody.id !== undefined ||
        actualBody.data?.id !== undefined ||
        (Array.isArray(actualBody) && actualBody.length > 0 && actualBody[0]?.id !== undefined) ||
        (Array.isArray(actualBody.data) && actualBody.data.length > 0 && actualBody.data[0]?.id !== undefined);
      if (!hasId && actualStatus < 400) {
        return {
          condition: conditionStr,
          passed: false,
          reason: 'Expected response to contain "id", but property was missing in body',
        };
      }
    }
  }

  return { condition: conditionStr, passed, reason };
}

async function executeSingleTest(testCase, spec, options = {}) {
  const parsed = TestCaseSchema.safeParse(testCase);
  if (!parsed.success) {
    const errorMessages = (parsed.error?.issues || parsed.error?.errors || []).map((e) => e.message).join(', ');
    throw new Error(`Test case validation failed: ${errorMessages}`);
  }
  const validTest = parsed.data;

  validateTestSecurityAndPath(validTest, spec);

  const sandboxBase = options.sandboxBaseUrl || getSandboxBaseUrl();
  const timeoutMs = options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const targetPath = resolveTargetPath(validTest.path, validTest.queryParams, validTest.requestBody);
  let targetUrl = `${sandboxBase.replace(/\/+$/, '')}${targetPath.startsWith('/') ? targetPath : '/' + targetPath}`;

  if (validTest.queryParams && Object.keys(validTest.queryParams).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(validTest.queryParams)) {
      if (!targetPath.includes(`{${k}}`)) {
        searchParams.append(k, String(v));
      }
    }
    const queryStr = searchParams.toString();
    if (queryStr) {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + queryStr;
    }
  }

  const headers = {
    'Accept': 'application/json',
    ...(validTest.headers || {}),
  };

  let body = null;
  if (['POST', 'PUT', 'PATCH'].includes(validTest.method) && validTest.requestBody !== undefined && validTest.requestBody !== null) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = typeof validTest.requestBody === 'string' ? validTest.requestBody : JSON.stringify(validTest.requestBody);
  }

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = performance.now();

  try {
    const response = await fetch(targetUrl, {
      method: validTest.method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutTimer);

    const durationMs = Math.round(performance.now() - startTime);
    const actualStatus = response.status;

    const actualHeaders = {};
    response.headers.forEach((val, key) => {
      actualHeaders[key] = val;
    });

    let actualBody = null;
    const contentType = response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        actualBody = await response.json();
      } else {
        const text = await response.text();
        if (text.length > MAX_RESPONSE_SIZE_BYTES) {
          actualBody = { warning: 'Response truncated: exceeded 1MB limit', preview: text.slice(0, 1000) };
        } else {
          try {
            actualBody = JSON.parse(text);
          } catch {
            actualBody = text;
          }
        }
      }
    } catch {
      actualBody = null;
    }

    const statusMatches = actualStatus === validTest.expectedStatus;
    const conditionEvaluations = (validTest.expectedResponseConditions || []).map((cond) =>
      evaluateCondition(cond, actualStatus, actualBody)
    );

    const allConditionsPassed = conditionEvaluations.every((c) => c.passed);
    const testPassed = statusMatches && allConditionsPassed;

    return {
      testCaseId: validTest.id,
      testName: validTest.name,
      category: validTest.category,
      method: validTest.method,
      path: validTest.path,
      targetUrl,
      requestHeaders: headers,
      requestBody: validTest.requestBody,
      expectedStatus: validTest.expectedStatus,
      actualStatus,
      statusMatches,
      expectedConditions: validTest.expectedResponseConditions,
      conditionEvaluations,
      actualResponseBody: actualBody,
      actualResponseHeaders: actualHeaders,
      durationMs,
      status: testPassed ? 'PASSED' : 'FAILED',
      errorMessage: testPassed
        ? null
        : !statusMatches
        ? `Status mismatch: Expected HTTP ${validTest.expectedStatus}, received HTTP ${actualStatus}`
        : 'One or more condition assertions failed',
    };
  } catch (err) {
    clearTimeout(timeoutTimer);
    const durationMs = Math.round(performance.now() - startTime);
    const isTimeout = err.name === 'AbortError';

    return {
      testCaseId: validTest.id,
      testName: validTest.name,
      category: validTest.category,
      method: validTest.method,
      path: validTest.path,
      targetUrl,
      requestHeaders: headers,
      requestBody: validTest.requestBody,
      expectedStatus: validTest.expectedStatus,
      actualStatus: null,
      statusMatches: false,
      expectedConditions: validTest.expectedResponseConditions,
      conditionEvaluations: [],
      actualResponseBody: null,
      actualResponseHeaders: null,
      durationMs,
      status: 'FAILED',
      errorMessage: isTimeout ? `Request timed out after ${timeoutMs}ms` : `Network error: ${err.message}`,
    };
  }
}

async function executeTestSuite(testCases, spec, options = {}) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error('executeTestSuite requires a non-empty array of test cases');
  }

  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = performance.now();
  const results = [];

  for (const tc of testCases) {
    const result = await executeSingleTest(tc, spec, options);
    results.push(result);
  }

  const durationMs = Math.round(performance.now() - startTime);
  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  const failedCount = results.filter((r) => r.status === 'FAILED').length;

  const runRecord = {
    id: runId,
    specTitle: spec?.info?.title || 'Unknown Spec',
    endpointId: testCases[0]?.endpointId || null,
    totalTests: results.length,
    passedCount,
    failedCount,
    durationMs,
    status: failedCount === 0 ? 'PASSED' : 'FAILED',
    createdAt: new Date().toISOString(),
    results,
  };

  executionRuns.set(runId, runRecord);
  await persistExecutionRun(runRecord).catch(() => {});
  return runRecord;
}

function getExecutionRunById(runId) {
  return executionRuns.get(runId) || null;
}

function getAllExecutionRuns() {
  return Array.from(executionRuns.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  DEFAULT_SANDBOX_BASE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_SIZE_BYTES,
  ALLOWED_METHODS,
  getSandboxBaseUrl,
  validateTestSecurityAndPath,
  resolveTargetPath,
  evaluateCondition,
  executeSingleTest,
  executeTestSuite,
  getExecutionRunById,
  getAllExecutionRuns,
};

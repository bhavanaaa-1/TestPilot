/**
 * AI Failure Diagnosis & Root Cause Explainer
 * Analyzes failed test execution results against contract schemas and RAG documentation
 * using Gemini to explain root causes, cite evidence, and propose non-destructive corrections.
 */

const { GoogleGenAI } = require('@google/genai');
const config = require('../config/env');
const { retrieveContext } = require('../rag/retrievalService');

let mockDiagnosisGenerator = null;

function setMockDiagnosisGenerator(fn) {
  mockDiagnosisGenerator = fn;
}

function clearMockDiagnosisGenerator() {
  mockDiagnosisGenerator = null;
}

async function diagnoseTestFailure(failedTest, endpoint = null, options = {}) {
  if (!failedTest) {
    throw new Error('diagnoseTestFailure requires a failedTest result object');
  }

  if (mockDiagnosisGenerator) {
    return await mockDiagnosisGenerator(failedTest, endpoint);
  }

  const query = `${failedTest.method} ${failedTest.path} error response status ${failedTest.actualStatus || failedTest.expectedStatus} ${failedTest.errorMessage || ''}`;
  let ragContextText = 'No specific RAG context retrieved.';
  try {
    const ragResult = await retrieveContext(query, {
      topK: 2,
      endpointId: endpoint?.id || null,
    });
    ragContextText = ragResult.formattedContext;
  } catch {
    // Non-fatal if RAG is unindexed
  }

  const apiKey = options.apiKey || config.GEMINI_API_KEY;
  const modelName = options.model || config.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'placeholder_or_unset') {
    return {
      testCaseId: failedTest.testCaseId,
      testName: failedTest.testName,
      endpoint: `${failedTest.method} ${failedTest.path}`,
      likelyReason: failedTest.errorMessage || `Expected status ${failedTest.expectedStatus} but received ${failedTest.actualStatus}`,
      evidence: [
        `Actual HTTP status was ${failedTest.actualStatus ?? 'connection failure'}`,
        `Expected status defined in test contract was ${failedTest.expectedStatus}`,
        failedTest.actualResponseBody?.message ? `API responded with message: "${failedTest.actualResponseBody.message}"` : 'No error payload returned by sandbox',
      ],
      suggestedCorrection: failedTest.actualStatus === 409
        ? 'Generate unique dynamic email addresses in test payloads to avoid collision with existing database records.'
        : failedTest.actualStatus === 400
        ? 'Verify that all required fields specified in the OpenAPI request body schema are present.'
        : 'Review the sandbox API implementation to ensure status codes conform to the OpenAPI 3.0 contract.',
      recommendedAdditionalTest: `Execute a GET request against ${failedTest.path} prior to execution to verify initial state.`,
      isHypothesis: true,
      disclaimer: 'This diagnosis is an automated AI hypothesis based on execution observations and does not constitute a guaranteed fix.',
    };
  }

  const prompt = `You are a Senior QA Automation Architect and Root Cause Analysis Specialist.
Analyze the following failing API test execution against its specification.

TEST DETAILS:
- Test Name: ${failedTest.testName}
- Category: ${failedTest.category}
- Method: ${failedTest.method}
- Target Path: ${failedTest.path}
- Target URL: ${failedTest.targetUrl}
- Expected Status: ${failedTest.expectedStatus}
- Actual Status: ${failedTest.actualStatus ?? 'None (Network Error / Timeout)'}
- Error Message: ${failedTest.errorMessage || 'None'}
- Request Headers: ${JSON.stringify(failedTest.requestHeaders || {})}
- Request Body: ${JSON.stringify(failedTest.requestBody || null)}
- Actual Response Body: ${JSON.stringify(failedTest.actualResponseBody || null)}

RELEVANT SPECIFICATION DOCUMENTATION (RETRIEVED VIA RAG):
${ragContextText}

Respond ONLY with a valid JSON object matching this exact schema:
{
  "likelyReason": "string - clear root cause explanation of why the test failed",
  "evidence": ["string - concrete observation 1", "string - concrete observation 2"],
  "suggestedCorrection": "string - actionable suggestion to fix the client test or server API",
  "recommendedAdditionalTest": "string - recommended follow-up test case",
  "isHypothesis": true,
  "disclaimer": "This diagnosis is an AI hypothesis and should be verified against application source code."
}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      testCaseId: failedTest.testCaseId,
      testName: failedTest.testName,
      endpoint: `${failedTest.method} ${failedTest.path}`,
      likelyReason: parsed.likelyReason || 'Unspecified failure reason',
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [parsed.evidence || 'Status code mismatch'],
      suggestedCorrection: parsed.suggestedCorrection || 'Review endpoint contract and parameters',
      recommendedAdditionalTest: parsed.recommendedAdditionalTest || 'Verify endpoint initial state',
      isHypothesis: true,
      disclaimer: 'This diagnosis is an automated AI hypothesis based on execution observations and does not constitute a guaranteed fix.',
    };
  } catch (err) {
    console.warn(`[WARN] Gemini failure diagnosis call failed: ${err.message}. Returning observation diagnosis.`);
    return {
      testCaseId: failedTest.testCaseId,
      testName: failedTest.testName,
      endpoint: `${failedTest.method} ${failedTest.path}`,
      likelyReason: `Execution discrepancy: ${failedTest.errorMessage || 'Status code did not match expected value'}`,
      evidence: [
        `Actual status code was ${failedTest.actualStatus}`,
        `Expected status was ${failedTest.expectedStatus}`,
      ],
      suggestedCorrection: 'Inspect sandbox API route logic and ensure request body satisfies validation constraints.',
      recommendedAdditionalTest: 'Test with minimal valid payload.',
      isHypothesis: true,
      disclaimer: 'This diagnosis is an automated AI hypothesis based on execution observations and does not constitute a guaranteed fix.',
    };
  }
}

module.exports = {
  setMockDiagnosisGenerator,
  clearMockDiagnosisGenerator,
  diagnoseTestFailure,
};

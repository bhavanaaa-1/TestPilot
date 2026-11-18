/**
 * Agent Tool Declarations and Execution Handlers
 * Defines controlled tools available to the multi-step AI Agent during investigations.
 */

const { retrieveContext } = require('../rag/retrievalService');
const specStore = require('../services/specStore');
const { executeSingleTest } = require('../execution/testRunner');

/**
 * Tool Declarations for Gemini Function Calling
 */
const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: 'retrieve_api_context',
    description:
      'Search the RAG vector database for relevant API documentation, parameter rules, and response contracts for the investigated endpoint.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query to retrieve relevant specification context for',
        },
        topK: {
          type: 'INTEGER',
          description: 'Maximum number of documentation chunks to retrieve (1 to 5, default 3)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'inspect_endpoint',
    description:
      'Retrieve the full OpenAPI contract, path parameters, request body schema, and expected response status definitions for a specific endpoint.',
    parameters: {
      type: 'OBJECT',
      properties: {
        endpointId: {
          type: 'STRING',
          description: 'The unique identifier of the endpoint to inspect (e.g., postusers, getallusers)',
        },
      },
      required: ['endpointId'],
    },
  },
  {
    name: 'execute_test_case',
    description:
      'Execute a validated test case against the isolated Sandbox API and verify the returned HTTP status code, response headers, and contract assertions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        testCase: {
          type: 'OBJECT',
          description: 'Complete validated test case object adhering to TestCaseSchema',
          properties: {
            id: { type: 'STRING', description: 'Unique test case identifier' },
            name: { type: 'STRING', description: 'Brief human-readable test name' },
            description: { type: 'STRING', description: 'Description of the test objective' },
            category: { type: 'STRING', description: 'Category: positive, negative, or boundary' },
            method: { type: 'STRING', description: 'HTTP method (GET, POST, PUT, PATCH, DELETE)' },
            path: { type: 'STRING', description: 'Endpoint path (e.g., /users, /users/1)' },
            headers: { type: 'OBJECT', description: 'HTTP request headers' },
            queryParams: { type: 'OBJECT', description: 'URL query parameters' },
            requestBody: { type: 'OBJECT', description: 'JSON request payload if applicable' },
            expectedStatus: { type: 'INTEGER', description: 'Expected integer HTTP status code' },
            expectedResponseConditions: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: 'List of assertion conditions to verify against the response',
            },
          },
          required: ['id', 'name', 'category', 'method', 'path', 'expectedStatus'],
        },
      },
      required: ['testCase'],
    },
  },
  {
    name: 'get_test_execution_results',
    description:
      'Retrieve a summary and detailed history of all test cases executed so far during this investigation run.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

const ALLOWED_AGENT_TOOLS = new Set([
  'retrieve_api_context',
  'inspect_endpoint',
  'execute_test_case',
  'get_test_execution_results',
]);

async function executeAgentTool(toolName, args, context = {}) {
  if (!ALLOWED_AGENT_TOOLS.has(toolName)) {
    throw new Error(`Security violation: Tool '${toolName}' is not recognized or permitted in the agent execution sandbox.`);
  }

  const { spec, runState } = context;

  switch (toolName) {
    case 'retrieve_api_context': {
      const query = String(args.query || '').trim();
      const topK = Math.min(Math.max(parseInt(args.topK || 3, 10), 1), 5);
      const ragResult = await retrieveContext(query, {
        topK,
        endpointId: runState?.endpointId || null,
      });

      return {
        query,
        matchCount: ragResult.matchCount,
        topSimilarity: ragResult.topSimilarity,
        formattedContext: ragResult.formattedContext,
        matches: ragResult.matches.map((m) => ({
          chunkType: m.chunkType,
          similarity: m.similarity,
          content: m.content,
        })),
      };
    }

    case 'inspect_endpoint': {
      const epId = String(args.endpointId || runState?.endpointId || '').trim();
      const endpoint = specStore.getEndpointById(epId);
      if (!endpoint) {
        return {
          error: `Endpoint '${epId}' not found in the currently loaded specification.`,
          found: false,
        };
      }
      return {
        found: true,
        id: endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
        summary: endpoint.summary,
        description: endpoint.description,
        parameters: endpoint.parameters || [],
        requestBody: endpoint.requestBody || null,
        responses: endpoint.responses || {},
      };
    }

    case 'execute_test_case': {
      const tc = args.testCase;
      if (!tc || typeof tc !== 'object') {
        throw new Error('execute_test_case requires a valid testCase object argument');
      }

      if (!tc.id) {
        tc.id = `tc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      }
      if (!tc.expectedResponseConditions || !Array.isArray(tc.expectedResponseConditions)) {
        tc.expectedResponseConditions = [`Response status is ${tc.expectedStatus}`];
      }

      const executionResult = await executeSingleTest(tc, spec);

      if (runState && Array.isArray(runState.executedTests)) {
        runState.executedTests.push(executionResult);
      }

      return {
        testCaseId: executionResult.testCaseId,
        testName: executionResult.testName,
        method: executionResult.method,
        path: executionResult.path,
        targetUrl: executionResult.targetUrl,
        expectedStatus: executionResult.expectedStatus,
        actualStatus: executionResult.actualStatus,
        statusMatches: executionResult.statusMatches,
        status: executionResult.status,
        durationMs: executionResult.durationMs,
        errorMessage: executionResult.errorMessage,
        actualResponseBody: executionResult.actualResponseBody,
      };
    }

    case 'get_test_execution_results': {
      const executed = runState?.executedTests || [];
      const passed = executed.filter((t) => t.status === 'PASSED').length;
      const failed = executed.filter((t) => t.status === 'FAILED').length;

      return {
        totalExecuted: executed.length,
        passedCount: passed,
        failedCount: failed,
        results: executed.map((t) => ({
          testCaseId: t.testCaseId,
          testName: t.testName,
          category: t.category,
          status: t.status,
          actualStatus: t.actualStatus,
          expectedStatus: t.expectedStatus,
          errorMessage: t.errorMessage,
        })),
      };
    }

    default:
      throw new Error(`Unhandled tool: ${toolName}`);
  }
}

module.exports = {
  AGENT_FUNCTION_DECLARATIONS,
  ALLOWED_AGENT_TOOLS,
  executeAgentTool,
};

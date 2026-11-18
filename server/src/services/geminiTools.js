/**
 * Gemini Function Calling Tool Declarations and In-Memory Execution Handlers.
 * All tools operate strictly within the bounds of the loaded OpenAPI specification.
 * Arbitrary network, shell, or filesystem operations are strictly prohibited.
 */

const FUNCTION_DECLARATIONS = [
  {
    name: 'get_api_endpoints',
    description: 'Retrieve a list of all available API endpoints (path, method, summary, tags, and stable ID) from the currently loaded OpenAPI specification.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tag: {
          type: 'STRING',
          description: 'Optional tag filter to only list endpoints matching a specific tag (e.g. Users)',
        },
      },
    },
  },
  {
    name: 'get_endpoint_details',
    description: 'Retrieve comprehensive contract details for a specific endpoint by its stable endpoint ID, including full parameter schemas, request body schemas, and response contracts.',
    parameters: {
      type: 'OBJECT',
      properties: {
        endpointId: {
          type: 'STRING',
          description: 'The stable identifier of the endpoint (e.g. getallusers, createuser, getuserbyid, deleteuser)',
        },
      },
      required: ['endpointId'],
    },
  },
  {
    name: 'search_api_documentation',
    description: 'Search the loaded OpenAPI specification title, description, schema definitions, and endpoint summaries for relevant keywords.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or keyword to look for in the OpenAPI spec (e.g. user, validation, email, error, role)',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Sanitizes input strings against control characters or injection payloads.
 */
function sanitizeString(val) {
  if (typeof val !== 'string') return '';
  return val.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 200);
}

/**
 * Tool 1: List API Endpoints
 */
function handleGetApiEndpoints(args, currentSpec) {
  if (!currentSpec || !Array.isArray(currentSpec.endpoints)) {
    return { error: 'No specification currently loaded' };
  }

  const tagFilter = sanitizeString(args?.tag);
  let list = currentSpec.endpoints;

  if (tagFilter) {
    list = list.filter((ep) =>
      (ep.tags || []).some((t) => t.toLowerCase() === tagFilter.toLowerCase())
    );
  }

  return {
    total: list.length,
    endpoints: list.map((ep) => ({
      id: ep.id,
      path: ep.path,
      method: ep.method,
      summary: ep.summary || '',
      tags: ep.tags || [],
    })),
  };
}

/**
 * Tool 2: Get Endpoint Details
 */
function handleGetEndpointDetails(args, currentSpec) {
  if (!currentSpec || !Array.isArray(currentSpec.endpoints)) {
    return { error: 'No specification currently loaded' };
  }

  const endpointId = sanitizeString(args?.endpointId);
  if (!endpointId) {
    return { error: "Missing required argument 'endpointId'" };
  }

  const ep = currentSpec.endpoints.find(
    (e) => e.id.toLowerCase() === endpointId.toLowerCase()
  );

  if (!ep) {
    return {
      error: `Endpoint with ID '${endpointId}' not found in loaded specification.`,
      availableEndpointIds: currentSpec.endpoints.map((e) => e.id),
    };
  }

  return {
    id: ep.id,
    path: ep.path,
    method: ep.method,
    summary: ep.summary || '',
    description: ep.description || '',
    parameters: ep.parameters || [],
    requestBody: ep.requestBody || null,
    responses: ep.responses || {},
  };
}

/**
 * Tool 3: Search Documentation
 */
function handleSearchApiDocumentation(args, currentSpec) {
  if (!currentSpec) {
    return { error: 'No specification currently loaded' };
  }

  const query = sanitizeString(args?.query);
  if (!query) {
    return { error: "Missing required argument 'query'" };
  }

  const q = query.toLowerCase();
  const matches = [];

  // Search spec info
  if (currentSpec.info) {
    if ((currentSpec.info.title || '').toLowerCase().includes(q)) {
      matches.push({ type: 'spec_title', text: currentSpec.info.title });
    }
    if ((currentSpec.info.description || '').toLowerCase().includes(q)) {
      matches.push({ type: 'spec_description', text: currentSpec.info.description });
    }
  }

  // Search component schemas
  const schemas = currentSpec.rawSpec?.components?.schemas || {};
  for (const [schemaName, schemaObj] of Object.entries(schemas)) {
    if (schemaName.toLowerCase().includes(q)) {
      matches.push({
        type: 'schema_definition',
        name: schemaName,
        properties: Object.keys(schemaObj.properties || {}),
        required: schemaObj.required || [],
      });
    }
  }

  // Search endpoints
  for (const ep of currentSpec.endpoints || []) {
    if (
      ep.path.toLowerCase().includes(q) ||
      (ep.summary || '').toLowerCase().includes(q) ||
      (ep.description || '').toLowerCase().includes(q) ||
      (ep.tags || []).some((t) => t.toLowerCase().includes(q))
    ) {
      matches.push({
        type: 'endpoint',
        id: ep.id,
        path: `${ep.method} ${ep.path}`,
        summary: ep.summary,
      });
    }
  }

  return {
    query,
    matchCount: matches.length,
    matches: matches.slice(0, 10), // Limit to top 10 matches
  };
}

/**
 * Executes a tool request safely on the backend only.
 * Rejects any unknown tools or invalid arguments.
 */
function executeTool(toolName, rawArgs, currentSpec) {
  const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};

  switch (toolName) {
    case 'get_api_endpoints':
      return handleGetApiEndpoints(args, currentSpec);

    case 'get_endpoint_details':
      return handleGetEndpointDetails(args, currentSpec);

    case 'search_api_documentation':
      return handleSearchApiDocumentation(args, currentSpec);

    default:
      return {
        error: `Tool '${toolName}' is not recognized or permitted. Allowed tools: get_api_endpoints, get_endpoint_details, search_api_documentation.`,
      };
  }
}

module.exports = {
  FUNCTION_DECLARATIONS,
  executeTool,
  handleGetApiEndpoints,
  handleGetEndpointDetails,
  handleSearchApiDocumentation,
  sanitizeString,
};

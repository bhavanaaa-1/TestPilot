const yaml = require('yaml');
const SwaggerParser = require('@apidevtools/swagger-parser');

const SUPPORTED_HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

/**
 * Recursively scans an object for $ref keys that point to external resources.
 * Valid internal references must start with '#/'.
 */
function scanForExternalReferences(obj, path = '') {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const found = scanForExternalReferences(obj[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      const trimmed = value.trim();
      // Only internal references starting with '#/' are permitted
      if (!trimmed.startsWith('#/')) {
        return { ref: trimmed, location: path || 'root' };
      }
    } else if (typeof value === 'object' && value !== null) {
      const found = scanForExternalReferences(value, path ? `${path}.${key}` : key);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Checks if a buffer contains binary data.
 */
function isBinaryBuffer(buffer) {
  const checkLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLength; i++) {
    const byte = buffer[i];
    // Check for null byte or control characters typical of binary files
    if (byte === 0 || (byte < 7 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return true;
    }
  }
  return false;
}

/**
 * Parses raw text buffer into a JavaScript object.
 * Supports JSON and YAML with strict syntax error diagnostics.
 */
function parseRawContent(rawBuffer, originalName = '') {
  if (isBinaryBuffer(rawBuffer)) {
    const error = new Error('Uploaded file is a binary file. Only text-based OpenAPI specifications (JSON or YAML) are accepted.');
    error.status = 400;
    error.code = 'UNSUPPORTED_FILE_TYPE';
    throw error;
  }

  const rawText = rawBuffer.toString('utf8').trim();

  if (!rawText) {
    const error = new Error('Uploaded file is empty.');
    error.status = 400;
    error.code = 'EMPTY_FILE';
    throw error;
  }

  const lowerName = (originalName || '').toLowerCase();
  const isExplicitJson = lowerName.endsWith('.json') || rawText.startsWith('{') || rawText.startsWith('[');

  let parsedDoc = null;
  let jsonError = null;
  let yamlError = null;

  // Attempt JSON parse first if it looks like JSON or ends with .json
  if (isExplicitJson) {
    try {
      parsedDoc = JSON.parse(rawText);
    } catch (err) {
      jsonError = err;
      // If the file is explicitly designated as .json, strictly reject with JSON syntax error
      if (lowerName.endsWith('.json')) {
        const error = new Error(`Malformed JSON document: ${err.message}`);
        error.status = 400;
        error.code = 'INVALID_JSON';
        error.details = err.message;
        throw error;
      }
    }
  }

  // If not parsed, try YAML parse
  if (!parsedDoc) {
    try {
      parsedDoc = yaml.parse(rawText);
    } catch (err) {
      yamlError = err;
    }
  }

  // If YAML parse succeeded but it was supposed to be JSON and failed
  if (!parsedDoc) {
    const primaryError = isExplicitJson && jsonError ? jsonError : yamlError || jsonError;
    const error = new Error(
      isExplicitJson
        ? `Malformed JSON document: ${primaryError ? primaryError.message : 'Invalid syntax'}`
        : `Malformed YAML document: ${primaryError ? primaryError.message : 'Invalid syntax'}`
    );
    error.status = 400;
    error.code = isExplicitJson ? 'INVALID_JSON' : 'INVALID_YAML';
    error.details = primaryError ? primaryError.message : null;
    throw error;
  }

  if (typeof parsedDoc !== 'object' || parsedDoc === null || Array.isArray(parsedDoc)) {
    const error = new Error('Invalid OpenAPI document structure. The root of the specification must be an object.');
    error.status = 400;
    error.code = 'INVALID_DOCUMENT_STRUCTURE';
    throw error;
  }

  return { parsedDoc, format: isExplicitJson && !jsonError ? 'json' : 'yaml', rawText };
}

/**
 * Validates OpenAPI metadata and version compliance (OpenAPI 3.0.x / 3.1.x).
 */
function validateOpenApiMeta(doc) {
  // Reject Swagger 2.0
  if (doc.swagger) {
    const error = new Error(`Unsupported specification version: Swagger ${doc.swagger}. TestPilot currently supports OpenAPI 3.0.x and 3.1.x.`);
    error.status = 400;
    error.code = 'UNSUPPORTED_VERSION';
    throw error;
  }

  // Check openapi field presence
  if (!doc.openapi || typeof doc.openapi !== 'string') {
    const error = new Error("Missing required OpenAPI version field ('openapi'). Expected OpenAPI 3.0.x or 3.1.x.");
    error.status = 400;
    error.code = 'MISSING_VERSION';
    throw error;
  }

  const versionTrimmed = doc.openapi.trim();
  const versionMatch = versionTrimmed.match(/^(\d+)\.(\d+)(\.\d+)?/);

  if (!versionMatch) {
    const error = new Error(`Invalid OpenAPI version format: '${versionTrimmed}'.`);
    error.status = 400;
    error.code = 'INVALID_VERSION_FORMAT';
    throw error;
  }

  const major = parseInt(versionMatch[1], 10);
  const minor = parseInt(versionMatch[2], 10);

  if (major !== 3 || (minor !== 0 && minor !== 1)) {
    const error = new Error(`Unsupported OpenAPI version: '${versionTrimmed}'. TestPilot currently supports OpenAPI 3.0.x and 3.1.x.`);
    error.status = 400;
    error.code = 'UNSUPPORTED_VERSION';
    throw error;
  }

  // Check info object
  if (!doc.info || typeof doc.info !== 'object' || Array.isArray(doc.info)) {
    const error = new Error("Missing required 'info' object in OpenAPI specification.");
    error.status = 400;
    error.code = 'MISSING_REQUIRED_FIELD';
    error.field = 'info';
    throw error;
  }

  if (!doc.info.title || typeof doc.info.title !== 'string' || !doc.info.title.trim()) {
    const error = new Error("Missing required 'info.title' field in OpenAPI specification.");
    error.status = 400;
    error.code = 'MISSING_REQUIRED_FIELD';
    error.field = 'info.title';
    throw error;
  }

  if (!doc.info.version || typeof doc.info.version !== 'string' || !doc.info.version.trim()) {
    const error = new Error("Missing required 'info.version' field in OpenAPI specification.");
    error.status = 400;
    error.code = 'MISSING_REQUIRED_FIELD';
    error.field = 'info.version';
    throw error;
  }

  // Check paths object
  if (!doc.paths || typeof doc.paths !== 'object' || Array.isArray(doc.paths)) {
    const error = new Error("Missing required 'paths' object in OpenAPI specification.");
    error.status = 400;
    error.code = 'MISSING_REQUIRED_FIELD';
    error.field = 'paths';
    throw error;
  }
}

/**
 * Generates a stable, URL-friendly identifier for an endpoint operation.
 */
function generateStableEndpointId(method, path, operationId) {
  if (operationId && typeof operationId === 'string' && operationId.trim()) {
    return operationId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  const sanitizedPath = path
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${method.toLowerCase()}-${sanitizedPath || 'root'}`;
}

/**
 * Resolves local references within the same document (e.g. #/components/schemas/User).
 */
function resolveLocalRef(ref, doc) {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('#/')) {
    return null;
  }

  const parts = ref.substring(2).split('/');
  let current = doc;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Normalizes a schema, expanding immediate internal $ref if present.
 */
function normalizeSchema(schema, doc, depth = 0) {
  if (!schema || typeof schema !== 'object' || depth > 5) {
    return schema;
  }

  if (schema.$ref && typeof schema.$ref === 'string') {
    const resolved = resolveLocalRef(schema.$ref, doc);
    if (resolved) {
      return {
        $ref: schema.$ref,
        ...normalizeSchema(resolved, doc, depth + 1),
      };
    }
  }

  const normalized = { ...schema };
  if (normalized.properties && typeof normalized.properties === 'object') {
    normalized.properties = { ...normalized.properties };
    for (const [propKey, propVal] of Object.entries(normalized.properties)) {
      normalized.properties[propKey] = normalizeSchema(propVal, doc, depth + 1);
    }
  }

  if (normalized.items && typeof normalized.items === 'object') {
    normalized.items = normalizeSchema(normalized.items, doc, depth + 1);
  }

  return normalized;
}

/**
 * Extracts and normalizes endpoints from the validated OpenAPI specification.
 */
function extractEndpoints(doc) {
  const endpoints = [];
  const methodCounts = {
    GET: 0,
    POST: 0,
    PUT: 0,
    PATCH: 0,
    DELETE: 0,
    OPTIONS: 0,
    HEAD: 0,
    TRACE: 0,
  };
  const tagsSet = new Set();
  const seenIds = new Set();

  for (const [pathKey, pathItem] of Object.entries(doc.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // Path-level parameters
    const pathParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    for (const methodKey of SUPPORTED_HTTP_METHODS) {
      const operation = pathItem[methodKey];
      if (!operation || typeof operation !== 'object') continue;

      const upperMethod = methodKey.toUpperCase();
      methodCounts[upperMethod] = (methodCounts[upperMethod] || 0) + 1;

      // Collect tags
      if (Array.isArray(operation.tags)) {
        operation.tags.forEach((tag) => tagsSet.add(tag));
      }

      // Generate stable identifier
      let endpointId = generateStableEndpointId(methodKey, pathKey, operation.operationId);
      // Guarantee uniqueness if duplicate IDs exist
      if (seenIds.has(endpointId)) {
        let counter = 2;
        while (seenIds.has(`${endpointId}-${counter}`)) {
          counter++;
        }
        endpointId = `${endpointId}-${counter}`;
      }
      seenIds.add(endpointId);

      // Merge parameters (operation-level overrides path-level)
      const opParameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      const paramMap = new Map();

      // Add path-level params
      for (const p of pathParameters) {
        const paramObj = p.$ref ? resolveLocalRef(p.$ref, doc) || p : p;
        if (paramObj && paramObj.name && paramObj.in) {
          const key = `${paramObj.in}:${paramObj.name}`;
          paramMap.set(key, {
            name: paramObj.name,
            in: paramObj.in,
            required: Boolean(paramObj.required || paramObj.in === 'path'),
            description: paramObj.description || '',
            deprecated: Boolean(paramObj.deprecated),
            schema: normalizeSchema(paramObj.schema, doc),
            example: paramObj.example !== undefined ? paramObj.example : paramObj.schema?.example,
          });
        }
      }

      // Add/override operation-level params
      for (const p of opParameters) {
        const paramObj = p.$ref ? resolveLocalRef(p.$ref, doc) || p : p;
        if (paramObj && paramObj.name && paramObj.in) {
          const key = `${paramObj.in}:${paramObj.name}`;
          paramMap.set(key, {
            name: paramObj.name,
            in: paramObj.in,
            required: Boolean(paramObj.required || paramObj.in === 'path'),
            description: paramObj.description || '',
            deprecated: Boolean(paramObj.deprecated),
            schema: normalizeSchema(paramObj.schema, doc),
            example: paramObj.example !== undefined ? paramObj.example : paramObj.schema?.example,
          });
        }
      }

      const parameters = Array.from(paramMap.values());

      // Extract Request Body
      let requestBody = null;
      if (operation.requestBody && typeof operation.requestBody === 'object') {
        const rbObj = operation.requestBody.$ref
          ? resolveLocalRef(operation.requestBody.$ref, doc) || operation.requestBody
          : operation.requestBody;

        if (rbObj && rbObj.content && typeof rbObj.content === 'object') {
          const contentTypes = {};
          for (const [contentType, mediaTypeObj] of Object.entries(rbObj.content)) {
            contentTypes[contentType] = {
              schema: normalizeSchema(mediaTypeObj.schema, doc),
              example: mediaTypeObj.example !== undefined ? mediaTypeObj.example : mediaTypeObj.schema?.example,
              examples: mediaTypeObj.examples,
            };
          }

          requestBody = {
            description: rbObj.description || '',
            required: Boolean(rbObj.required),
            content: contentTypes,
          };
        }
      }

      // Extract Responses
      const responses = {};
      if (operation.responses && typeof operation.responses === 'object') {
        for (const [statusCode, responseVal] of Object.entries(operation.responses)) {
          const respObj = responseVal.$ref
            ? resolveLocalRef(responseVal.$ref, doc) || responseVal
            : responseVal;

          if (respObj && typeof respObj === 'object') {
            const respContent = {};
            if (respObj.content && typeof respObj.content === 'object') {
              for (const [contentType, mediaTypeObj] of Object.entries(respObj.content)) {
                respContent[contentType] = {
                  schema: normalizeSchema(mediaTypeObj.schema, doc),
                  example: mediaTypeObj.example !== undefined ? mediaTypeObj.example : mediaTypeObj.schema?.example,
                };
              }
            }

            responses[statusCode] = {
              status: statusCode,
              description: respObj.description || '',
              headers: respObj.headers || null,
              content: respContent,
            };
          }
        }
      }

      endpoints.push({
        id: endpointId,
        path: pathKey,
        method: upperMethod,
        summary: operation.summary || '',
        description: operation.description || '',
        operationId: operation.operationId || null,
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        deprecated: Boolean(operation.deprecated),
        parameters,
        requestBody,
        responses,
      });
    }
  }

  // Sort endpoints deterministically: by path, then method
  endpoints.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  return {
    endpoints,
    stats: {
      totalEndpoints: endpoints.length,
      totalPaths: Object.keys(doc.paths || {}).length,
      methods: methodCounts,
      tags: Array.from(tagsSet),
    },
  };
}

/**
 * Main parser and validator function.
 * Coordinates parsing, external reference scanning, schema validation, and endpoint extraction.
 */
async function parseAndValidateOpenApi(rawBuffer, originalName = '') {
  // Step 1: Parse raw buffer (JSON or YAML)
  const { parsedDoc, format, rawText } = parseRawContent(rawBuffer, originalName);

  // Step 2: Validate basic OpenAPI metadata (3.0.x / 3.1.x)
  validateOpenApiMeta(parsedDoc);

  // Step 3: Reject external references (http, https, file, relative paths)
  const externalRef = scanForExternalReferences(parsedDoc);
  if (externalRef) {
    const error = new Error(`External references are rejected for security reasons: "${externalRef.ref}" at ${externalRef.location}. TestPilot requires self-contained specifications without remote or external file references.`);
    error.status = 400;
    error.code = 'EXTERNAL_REFERENCE_REJECTED';
    error.ref = externalRef.ref;
    throw error;
  }

  // Step 4: Validate OpenAPI structure with SwaggerParser (offline only)
  try {
    // Clone document to avoid mutation by the validator
    const docClone = JSON.parse(JSON.stringify(parsedDoc));
    await SwaggerParser.validate(docClone, {
      resolve: {
        http: false,
        file: false,
      },
    });
  } catch (err) {
    const error = new Error(`OpenAPI validation failed: ${err.message}`);
    error.status = 400;
    error.code = 'SCHEMA_VALIDATION_FAILED';
    error.details = err.message;
    throw error;
  }

  // Step 5: Extract endpoints and statistics
  const { endpoints, stats } = extractEndpoints(parsedDoc);

  return {
    id: `spec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    format,
    fileName: originalName || `spec.${format}`,
    fileSize: rawBuffer.length,
    uploadedAt: new Date().toISOString(),
    openapi: parsedDoc.openapi,
    info: {
      title: parsedDoc.info.title,
      version: parsedDoc.info.version,
      description: parsedDoc.info.description || '',
      termsOfService: parsedDoc.info.termsOfService || null,
      contact: parsedDoc.info.contact || null,
      license: parsedDoc.info.license || null,
    },
    servers: Array.isArray(parsedDoc.servers) ? parsedDoc.servers : [],
    stats,
    endpoints,
    rawSpec: parsedDoc,
  };
}

module.exports = {
  parseAndValidateOpenApi,
  scanForExternalReferences,
  generateStableEndpointId,
  extractEndpoints,
};

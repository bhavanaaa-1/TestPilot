/**
 * OpenAPI Specification Chunker
 * Deconstructs parsed OpenAPI specifications into semantically rich,
 * contextual text chunks for embedding and vector similarity retrieval.
 */

function sanitizeForId(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Converts a JSON schema object into a human-readable text description
 */
function formatSchemaText(schema, depth = 0) {
  if (!schema || typeof schema !== 'object') return 'Any';
  const indent = '  '.repeat(depth);

  if (schema.type === 'object' || schema.properties) {
    const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    const props = schema.properties || {};
    const propLines = Object.entries(props).map(([propName, propDef]) => {
      const isReq = requiredSet.has(propName) ? ' (required)' : ' (optional)';
      const typeStr = propDef.type || (propDef.$ref ? 'Reference' : 'unknown');
      const formatStr = propDef.format ? `, format: ${propDef.format}` : '';
      const enumStr = Array.isArray(propDef.enum) ? `, enum: [${propDef.enum.join(', ')}]` : '';
      const desc = propDef.description ? ` - ${propDef.description}` : '';
      return `${indent}  * ${propName}: ${typeStr}${formatStr}${enumStr}${isReq}${desc}`;
    });
    return `Object with properties:\n${propLines.join('\n')}`;
  }

  if (schema.type === 'array' || schema.items) {
    const itemSchema = schema.items ? formatSchemaText(schema.items, depth + 1) : 'Any';
    return `Array of items (${itemSchema})`;
  }

  let text = schema.type || 'any';
  if (schema.format) text += ` (format: ${schema.format})`;
  if (Array.isArray(schema.enum)) text += ` [enum: ${schema.enum.join(', ')}]`;
  if (schema.description) text += ` - ${schema.description}`;
  return text;
}

/**
 * Chunks an OpenAPI specification into granular document pieces
 * @param {Object} spec Parsed specification object
 * @returns {Array<Object>} List of semantic chunk objects
 */
function chunkSpecification(spec) {
  if (!spec || !spec.info) {
    throw new Error('Invalid specification object provided to chunker: missing spec.info');
  }

  const chunks = [];
  const specTitle = spec.info.title || 'Untitled API';
  const specVersion = spec.info.version || '1.0.0';
  const oasVersion = spec.openapi || '3.0.0';
  const endpoints = Array.isArray(spec.endpoints) ? spec.endpoints : [];

  // 1. Spec Overview Chunk
  const endpointsSummary = endpoints
    .map((ep) => `• ${ep.method} ${ep.path}: ${ep.summary || ep.description || 'No description'}`)
    .join('\n');

  chunks.push({
    id: `spec-overview-${sanitizeForId(specTitle)}`,
    specTitle,
    specVersion,
    endpointId: null,
    path: null,
    method: null,
    chunkType: 'spec_overview',
    content: `API Specification: ${specTitle} (v${specVersion})
OpenAPI Version: ${oasVersion}
Description: ${spec.info.description || 'No overall description provided.'}
Total Endpoints: ${endpoints.length}

Endpoints Summary:
${endpointsSummary || 'No endpoints defined.'}`.trim(),
    metadata: {
      title: specTitle,
      version: specVersion,
      totalEndpoints: endpoints.length,
      tags: Array.isArray(spec.tags) ? spec.tags : [],
    },
  });

  // 2. Chunks for each Endpoint
  for (const ep of endpoints) {
    const epId = ep.id;
    const method = ep.method;
    const path = ep.path;

    // 2a. Endpoint Overview Chunk
    chunks.push({
      id: `ep-${epId}-overview`,
      specTitle,
      specVersion,
      endpointId: epId,
      path,
      method,
      chunkType: 'endpoint_overview',
      content: `API Endpoint Overview: ${method} ${path}
Summary: ${ep.summary || 'None'}
Description: ${ep.description || 'None'}
Operation ID: ${ep.operationId || 'None'}
Tags: ${Array.isArray(ep.tags) ? ep.tags.join(', ') : 'None'}
Deprecated: ${ep.deprecated ? 'Yes' : 'No'}`.trim(),
      metadata: {
        endpointId: epId,
        method,
        path,
        operationId: ep.operationId,
        tags: ep.tags,
      },
    });

    // 2b. Parameters Chunk (if parameters exist)
    if (Array.isArray(ep.parameters) && ep.parameters.length > 0) {
      const paramLines = ep.parameters.map((p) => {
        const requiredStr = p.required ? 'REQUIRED' : 'optional';
        const typeStr = p.schema?.type || (p.type ? p.type : 'string');
        const descStr = p.description ? ` (${p.description})` : '';
        const exampleStr = p.example !== undefined ? ` [example: ${JSON.stringify(p.example)}]` : '';
        return `• [${p.in.toUpperCase()}] ${p.name} (${typeStr}, ${requiredStr})${descStr}${exampleStr}`;
      });

      chunks.push({
        id: `ep-${epId}-params`,
        specTitle,
        specVersion,
        endpointId: epId,
        path,
        method,
        chunkType: 'parameters',
        content: `Parameters for ${method} ${path}:
${paramLines.join('\n')}`.trim(),
        metadata: {
          endpointId: epId,
          method,
          path,
          paramCount: ep.parameters.length,
          paramNames: ep.parameters.map((p) => p.name),
        },
      });
    }

    // 2c. Request Body Chunk (if request body exists)
    if (ep.requestBody) {
      const isReq = ep.requestBody.required ? 'REQUIRED' : 'optional';
      const desc = ep.requestBody.description ? `Description: ${ep.requestBody.description}\n` : '';
      let schemaDetail = 'No schema definition available.';

      if (ep.requestBody.content) {
        const mediaTypes = Object.keys(ep.requestBody.content);
        const details = mediaTypes.map((mt) => {
          const bodyDef = ep.requestBody.content[mt];
          const schemaText = formatSchemaText(bodyDef.schema);
          const exampleText = bodyDef.example
            ? `\nExample:\n${JSON.stringify(bodyDef.example, null, 2)}`
            : '';
          return `Media Type: ${mt}\n${schemaText}${exampleText}`;
        });
        schemaDetail = details.join('\n\n');
      }

      chunks.push({
        id: `ep-${epId}-request-body`,
        specTitle,
        specVersion,
        endpointId: epId,
        path,
        method,
        chunkType: 'request_body',
        content: `Request Body Contract for ${method} ${path} (${isReq}):
${desc}${schemaDetail}`.trim(),
        metadata: {
          endpointId: epId,
          method,
          path,
          required: Boolean(ep.requestBody.required),
        },
      });
    }

    // 2d. Responses Chunk
    if (ep.responses && Object.keys(ep.responses).length > 0) {
      const responseCodes = Object.keys(ep.responses);
      const respSections = responseCodes.map((code) => {
        const resp = ep.responses[code];
        const desc = resp.description || 'No description provided';
        let contentDesc = '';

        if (resp.content) {
          const mtypes = Object.keys(resp.content);
          contentDesc = mtypes
            .map((mt) => {
              const mtObj = resp.content[mt];
              return `  Content-Type: ${mt}\n  Schema: ${formatSchemaText(mtObj.schema, 1)}`;
            })
            .join('\n');
        }

        return `HTTP ${code}: ${desc}${contentDesc ? '\n' + contentDesc : ''}`;
      });

      chunks.push({
        id: `ep-${epId}-responses`,
        specTitle,
        specVersion,
        endpointId: epId,
        path,
        method,
        chunkType: 'responses',
        content: `Response Contracts for ${method} ${path}:
${respSections.join('\n\n')}`.trim(),
        metadata: {
          endpointId: epId,
          method,
          path,
          statusCodes: responseCodes,
        },
      });
    }
  }

  // 3. Common Component Schemas (if present in raw spec)
  const componentSchemas = spec.rawDoc?.components?.schemas || {};
  for (const [schemaName, schemaObj] of Object.entries(componentSchemas)) {
    chunks.push({
      id: `schema-${sanitizeForId(schemaName)}`,
      specTitle,
      specVersion,
      endpointId: null,
      path: null,
      method: null,
      chunkType: 'component_schema',
      content: `Data Model Schema: ${schemaName}
Description: ${schemaObj.description || 'Data entity model'}
${formatSchemaText(schemaObj)}`.trim(),
      metadata: {
        schemaName,
        type: schemaObj.type,
      },
    });
  }

  return chunks;
}

module.exports = {
  chunkSpecification,
  formatSchemaText,
};

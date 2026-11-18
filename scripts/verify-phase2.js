/**
 * TestPilot Phase 2 Automated Verification Script
 * Validates OpenAPI Specification Processing, Endpoints Extraction, Error Handling,
 * Security Rejections, and Sandbox API Route Alignment.
 */

const fs = require('fs');
const path = require('path');
const serverApp = require('../server/src/app');
const sandboxApp = require('../sandbox-api/src/app');

const SERVER_PORT = 5000;
const SANDBOX_PORT = 4000;

let serverInstance;
let sandboxInstance;

const testResults = [];

function recordResult(testName, passed, details) {
  testResults.push({ testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} | ${testName}`);
  if (details) {
    console.log(`       Details: ${JSON.stringify(details)}`);
  }
}

async function uploadSpecFile(buffer, filename) {
  const formData = new FormData();
  formData.append('spec', new Blob([buffer]), filename);

  const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runPhase2Tests() {
  console.log('\n======================================================');
  console.log('🧪 TESTPILOT PHASE 2 - OPENAPI PROCESSING VERIFICATION');
  console.log('======================================================\n');

  // Boot servers
  await new Promise((resolve) => {
    serverInstance = serverApp.listen(SERVER_PORT, () => {
      console.log(`[BOOT] Server listening on http://localhost:${SERVER_PORT}`);
      resolve();
    });
  });

  await new Promise((resolve) => {
    sandboxInstance = sandboxApp.listen(SANDBOX_PORT, () => {
      console.log(`[BOOT] Sandbox listening on http://localhost:${SANDBOX_PORT}`);
      resolve();
    });
  });

  console.log('\n--- 1. SPECIFICATION UPLOAD & EXTRACTION ---');

  // Test 1: Initial state (GET /api/specs/current when empty)
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/current`);
    const data = await res.json();
    const passed = res.status === 200 && data.success === true && data.data === null;
    recordResult('GET /api/specs/current (Initial state is null)', passed, { status: res.status, data: data.data });
  } catch (err) {
    recordResult('GET /api/specs/current (Initial state is null)', false, { error: err.message });
  }

  // Test 2: Valid YAML specification upload
  let extractedEndpoints = [];
  try {
    const yamlContent = fs.readFileSync(path.join(__dirname, '../examples/sandbox-openapi.yaml'));
    const { status, ok, data } = await uploadSpecFile(yamlContent, 'sandbox-openapi.yaml');
    extractedEndpoints = data.data?.endpoints || [];
    const passed =
      status === 200 &&
      ok &&
      data.data?.info?.title === 'TestPilot Sandbox Mock API' &&
      data.data?.openapi === '3.0.3' &&
      data.data?.stats?.totalEndpoints === 4;
    recordResult('Upload Valid YAML Specification (sandbox-openapi.yaml)', passed, {
      status,
      title: data.data?.info?.title,
      endpointsCount: data.data?.stats?.totalEndpoints,
      format: data.data?.format,
    });
  } catch (err) {
    recordResult('Upload Valid YAML Specification (sandbox-openapi.yaml)', false, { error: err.message });
  }

  // Test 3: Correct Endpoint Extraction Details
  try {
    const epGetUsers = extractedEndpoints.find((e) => e.method === 'GET' && e.path === '/users');
    const epGetUserById = extractedEndpoints.find((e) => e.method === 'GET' && e.path === '/users/{id}');
    const epPostUsers = extractedEndpoints.find((e) => e.method === 'POST' && e.path === '/users');
    const epDeleteUser = extractedEndpoints.find((e) => e.method === 'DELETE' && e.path === '/users/{id}');

    const allFound = epGetUsers && epGetUserById && epPostUsers && epDeleteUser;
    const hasParams = epGetUserById?.parameters?.some((p) => p.name === 'id' && p.in === 'path' && p.required === true);
    const hasBody = Boolean(epPostUsers?.requestBody?.content?.['application/json']);
    const hasResponses = Boolean(epGetUsers?.responses?.['200'] && epGetUserById?.responses?.['404']);

    const passed = allFound && hasParams && hasBody && hasResponses;
    recordResult('Endpoint Extraction Completeness (Paths, Methods, Params, Body, Responses)', passed, {
      totalFound: extractedEndpoints.length,
      sampleEndpoints: extractedEndpoints.map((e) => `${e.method} ${e.path} (id: ${e.id})`),
      hasPathParams: hasParams,
      hasRequestBody: hasBody,
    });
  } catch (err) {
    recordResult('Endpoint Extraction Completeness', false, { error: err.message });
  }

  // Test 4: GET /api/specs/current (with loaded spec)
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/current`);
    const data = await res.json();
    const passed = res.status === 200 && data.success === true && data.data?.info?.title === 'TestPilot Sandbox Mock API';
    recordResult('GET /api/specs/current (Returns loaded spec)', passed, {
      status: res.status,
      title: data.data?.info?.title,
      endpointsCount: data.data?.stats?.totalEndpoints,
    });
  } catch (err) {
    recordResult('GET /api/specs/current (Returns loaded spec)', false, { error: err.message });
  }

  // Test 5: GET /api/specs/endpoints/:id (Existing endpoint)
  try {
    const targetId = extractedEndpoints[0]?.id || 'getallusers';
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/endpoints/${targetId}`);
    const data = await res.json();
    const passed = res.status === 200 && data.success === true && data.data?.id === targetId;
    recordResult(`GET /api/specs/endpoints/:id (Fetch ID: ${targetId})`, passed, {
      status: res.status,
      endpointId: data.data?.id,
      method: data.data?.method,
      path: data.data?.path,
    });
  } catch (err) {
    recordResult('GET /api/specs/endpoints/:id', false, { error: err.message });
  }

  // Test 6: GET /api/specs/endpoints/:id (Non-existent endpoint -> 404)
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/endpoints/non-existent-endpoint-id`);
    const data = await res.json();
    const passed = res.status === 404 && data.success === false && data.error?.status === 404;
    recordResult('GET /api/specs/endpoints/:id (Non-existent ID -> 404)', passed, {
      status: res.status,
      error: data.error?.message,
    });
  } catch (err) {
    recordResult('GET /api/specs/endpoints/:id (Non-existent ID -> 404)', false, { error: err.message });
  }

  // Test 7: Valid JSON specification upload
  try {
    const jsonContent = fs.readFileSync(path.join(__dirname, '../examples/sandbox-openapi.json'));
    const { status, ok, data } = await uploadSpecFile(jsonContent, 'sandbox-openapi.json');
    const passed = status === 200 && ok && data.data?.format === 'json' && data.data?.stats?.totalEndpoints === 4;
    recordResult('Upload Valid JSON Specification (sandbox-openapi.json)', passed, {
      status,
      format: data.data?.format,
      endpointsCount: data.data?.stats?.totalEndpoints,
    });
  } catch (err) {
    recordResult('Upload Valid JSON Specification (sandbox-openapi.json)', false, { error: err.message });
  }

  console.log('\n--- 2. ERROR HANDLING & SECURITY VALIDATION ---');

  // Test 8: Unsupported OpenAPI version (Swagger 2.0)
  try {
    const swagger2Doc = Buffer.from(
      JSON.stringify({
        swagger: '2.0',
        info: { title: 'Legacy Swagger', version: '1.0' },
        paths: {},
      })
    );
    const { status, data } = await uploadSpecFile(swagger2Doc, 'swagger2.json');
    const passed = status === 400 && data.error?.code === 'UNSUPPORTED_VERSION';
    recordResult('Reject Unsupported OpenAPI Version (Swagger 2.0 -> 400)', passed, {
      status,
      code: data.error?.code,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Reject Unsupported OpenAPI Version', false, { error: err.message });
  }

  // Test 9: Invalid JSON Syntax
  try {
    const malformedJson = Buffer.from('{ "openapi": "3.0.0", "info": { "title": "Bad" }, "paths": }');
    const { status, data } = await uploadSpecFile(malformedJson, 'malformed.json');
    const passed = status === 400 && data.error?.code === 'INVALID_JSON';
    recordResult('Reject Malformed JSON Syntax (Invalid JSON -> 400)', passed, {
      status,
      code: data.error?.code,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Reject Malformed JSON Syntax', false, { error: err.message });
  }

  // Test 10: Invalid YAML Syntax
  try {
    const malformedYaml = Buffer.from("openapi: 3.0.0\ninfo:\n  title: [unclosed list\npaths: {}");
    const { status, data } = await uploadSpecFile(malformedYaml, 'malformed.yaml');
    const passed = status === 400 && data.error?.code === 'INVALID_YAML';
    recordResult('Reject Malformed YAML Syntax (Invalid YAML -> 400)', passed, {
      status,
      code: data.error?.code,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Reject Malformed YAML Syntax', false, { error: err.message });
  }

  // Test 11: Missing Required OpenAPI Fields (e.g. missing 'info')
  try {
    const missingFieldsDoc = Buffer.from(
      JSON.stringify({
        openapi: '3.0.0',
        paths: {},
      })
    );
    const { status, data } = await uploadSpecFile(missingFieldsDoc, 'missing-info.json');
    const passed = status === 400 && data.error?.code === 'MISSING_REQUIRED_FIELD' && data.error?.field === 'info';
    recordResult('Reject Missing Required OpenAPI Fields (Missing info -> 400)', passed, {
      status,
      code: data.error?.code,
      field: data.error?.field,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Reject Missing Required OpenAPI Fields', false, { error: err.message });
  }

  // Test 12: Oversized Upload (> 2 MB)
  try {
    // Generate a 2.2 MB buffer
    const largeBuffer = Buffer.alloc(2.2 * 1024 * 1024, ' ');
    const { status, data } = await uploadSpecFile(largeBuffer, 'large-spec.yaml');
    const passed = status === 400 && data.error?.code === 'FILE_TOO_LARGE';
    recordResult('Enforce 2 MB File Size Limit (Oversized upload -> 400)', passed, {
      status,
      code: data.error?.code,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Enforce 2 MB File Size Limit', false, { error: err.message });
  }

  // Test 13: Unsupported File Type / Binary Content
  try {
    // Create a binary file with null bytes
    const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00]);
    const { status, data } = await uploadSpecFile(binaryBuffer, 'spec.json');
    const passed = status === 400 && (data.error?.code === 'UNSUPPORTED_FILE_TYPE' || data.error?.code === 'INVALID_JSON');
    recordResult('Reject Unsupported Binary Content (Content verification -> 400)', passed, {
      status,
      code: data.error?.code,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Reject Unsupported Binary Content', false, { error: err.message });
  }

  // Test 14: External Reference Rejection ($ref pointing to remote URL)
  try {
    const extRefDoc = Buffer.from(
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'External Ref Spec', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              summary: 'Test with external ref',
              responses: {
                '200': {
                  description: 'Remote schema',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: 'https://attacker.example.com/malicious-schema.json',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    );
    const { status, data } = await uploadSpecFile(extRefDoc, 'ext-ref.json');
    const passed = status === 400 && data.error?.code === 'EXTERNAL_REFERENCE_REJECTED';
    recordResult('Reject External References ($ref remote URL -> 400)', passed, {
      status,
      code: data.error?.code,
      ref: data.error?.ref,
      message: data.error?.message,
    });
  } catch (err) {
    recordResult('Reject External References', false, { error: err.message });
  }

  // Test 15: Built-in Sample Loader Endpoint (POST /api/specs/load-sample)
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/specs/load-sample`, {
      method: 'POST',
    });
    const data = await res.json();
    const passed = res.status === 200 && data.success === true && data.data?.stats?.totalEndpoints === 4;
    recordResult('POST /api/specs/load-sample (Loads built-in sandbox spec)', passed, {
      status: res.status,
      title: data.data?.info?.title,
      endpointsCount: data.data?.stats?.totalEndpoints,
    });
  } catch (err) {
    recordResult('POST /api/specs/load-sample', false, { error: err.message });
  }

  console.log('\n--- 3. SPECIFICATION ALIGNMENT WITH SANDBOX API ---');

  // Test 16: Verify Sample Spec Matches Actual Sandbox API Routes
  try {
    // 1. GET /users on Sandbox API
    const resGetUsers = await fetch(`http://localhost:${SANDBOX_PORT}/users`);
    const usersList = await resGetUsers.json();

    // 2. GET /users/1 on Sandbox API
    const resGetUser1 = await fetch(`http://localhost:${SANDBOX_PORT}/users/1`);
    const user1 = await resGetUser1.json();

    // 3. POST /users on Sandbox API
    const resPostUser = await fetch(`http://localhost:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Margaret Hamilton', email: 'margaret.hamilton@mit.edu', role: 'developer' }),
    });
    const createdUser = await resPostUser.json();

    // 4. DELETE /users/:id on Sandbox API
    const resDeleteUser = await fetch(`http://localhost:${SANDBOX_PORT}/users/${createdUser.id}`, {
      method: 'DELETE',
    });
    const deleteResp = await resDeleteUser.json();

    const passed =
      resGetUsers.status === 200 &&
      Array.isArray(usersList) &&
      resGetUser1.status === 200 &&
      user1.name === 'Alice Johnson' &&
      resPostUser.status === 201 &&
      createdUser.name === 'Margaret Hamilton' &&
      resDeleteUser.status === 200 &&
      deleteResp.message === 'User deleted successfully';

    recordResult('Specification Accurately Describes Actual Sandbox API Routes', passed, {
      getUsersStatus: resGetUsers.status,
      getUserByIdStatus: resGetUser1.status,
      postUserStatus: resPostUser.status,
      deleteUserStatus: resDeleteUser.status,
    });
  } catch (err) {
    recordResult('Specification Accurately Describes Actual Sandbox API Routes', false, { error: err.message });
  }

  // Teardown
  console.log('\n[TEARDOWN] Closing test servers...');
  await new Promise((resolve) => serverInstance.close(resolve));
  await new Promise((resolve) => sandboxInstance.close(resolve));
  console.log('[TEARDOWN] Servers closed successfully.\n');

  // Summary
  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  console.log('======================================================');
  console.log(`📊 PHASE 2 VERIFICATION SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED`);
  console.log('======================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('[FATAL] Verification runner failed:', err);
  if (serverInstance) serverInstance.close();
  if (sandboxInstance) sandboxInstance.close();
  process.exit(1);
});

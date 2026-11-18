/**
 * TestPilot Phase 1 Verification Suite
 * Verifies Backend Foundation, Centralized Error Handling, CORS, Health Check,
 * and Sandbox API User CRUD Endpoints.
 */

const assert = require('assert');
const serverApp = require('../server/src/app');
const sandboxApp = require('../sandbox-api/src/app');

const SERVER_PORT = 5051;
const SANDBOX_PORT = 4051;

let serverInstance = null;
let sandboxInstance = null;

let passedTests = 0;
let totalTests = 0;

function reportPass(name, details = {}) {
  passedTests++;
  console.log(`✅ PASS | ${name}`);
  if (Object.keys(details).length > 0) {
    console.log(`       Details: ${JSON.stringify(details)}`);
  }
}

function reportFail(name, err) {
  console.error(`❌ FAIL | ${name}`);
  console.error(`       Error: ${err.message}`);
}

async function runPhase1Verification() {
  console.log('\n===============================================================');
  console.log('🧪 TESTPILOT PHASE 1 - FOUNDATION & SANDBOX API VERIFICATION');
  console.log('===============================================================\n');

  // Boot servers
  await new Promise((resolve) => {
    serverInstance = serverApp.listen(SERVER_PORT, '127.0.0.1', () => {
      console.log(`[BOOT] Backend Server listening on http://127.0.0.1:${SERVER_PORT}`);
      resolve();
    });
  });

  await new Promise((resolve) => {
    sandboxInstance = sandboxApp.listen(SANDBOX_PORT, '127.0.0.1', () => {
      console.log(`[BOOT] Sandbox API listening on http://127.0.0.1:${SANDBOX_PORT}`);
      resolve();
    });
    sandboxInstance.on('error', () => resolve());
  });

  // 1. Backend GET /health
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'testpilot-server');
    reportPass('Backend GET /health confirms server health', { status: body.status, service: body.service });
  } catch (err) {
    reportFail('Backend GET /health', err);
  }

  // 2. Centralized 404 handler
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/invalid-route-${Date.now()}`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert(body.error?.message?.includes('not found') || body.message?.includes('not found'));
    reportPass('Backend Centralized 404 Error Handling', { status: res.status });
  } catch (err) {
    reportFail('Backend Centralized 404 Error Handling', err);
  }

  // 3. Sandbox GET /users
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users`);
    assert.strictEqual(res.status, 200);
    const users = await res.json();
    assert(Array.isArray(users));
    assert(users.length >= 3);
    reportPass('Sandbox GET /users returns initial user records', { userCount: users.length });
  } catch (err) {
    reportFail('Sandbox GET /users', err);
  }

  // 4. Sandbox GET /users/:id (Existing)
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users/1`);
    assert.strictEqual(res.status, 200);
    const user = await res.json();
    assert.strictEqual(user.id, '1');
    assert(user.name);
    reportPass('Sandbox GET /users/:id retrieves user by ID', { id: user.id, name: user.name });
  } catch (err) {
    reportFail('Sandbox GET /users/:id (Existing)', err);
  }

  // 5. Sandbox GET /users/:id (Non-existent 404)
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users/999999`);
    assert.strictEqual(res.status, 404);
    reportPass('Sandbox GET /users/:id handles non-existent ID with 404');
  } catch (err) {
    reportFail('Sandbox GET /users/:id (Non-existent)', err);
  }

  // 6. Sandbox POST /users (Valid Creation)
  let createdUserId = null;
  totalTests++;
  try {
    const payload = {
      name: 'Phase1 Test User',
      email: `p1_user_${Date.now()}@testpilot.dev`,
      role: 'tester',
    };
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201);
    const created = await res.json();
    assert(created.id);
    createdUserId = created.id;
    assert.strictEqual(created.name, payload.name);
    reportPass('Sandbox POST /users creates new user record', { id: created.id, name: created.name });
  } catch (err) {
    reportFail('Sandbox POST /users (Valid)', err);
  }

  // 7. Sandbox POST /users (Invalid Payload 400)
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    assert.strictEqual(res.status, 400);
    reportPass('Sandbox POST /users rejects invalid payload with 400');
  } catch (err) {
    reportFail('Sandbox POST /users (Invalid)', err);
  }

  // 8. Sandbox POST /users (Duplicate Email 409 Conflict)
  totalTests++;
  try {
    const dupRes = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: 'alice.johnson@example.com', // Pre-seeded email
        role: 'user',
      }),
    });
    assert.strictEqual(dupRes.status, 409);
    reportPass('Sandbox POST /users detects duplicate email and returns 409');
  } catch (err) {
    reportFail('Sandbox POST /users (Duplicate Email)', err);
  }

  // 9. Sandbox DELETE /users/:id (Valid Deletion)
  totalTests++;
  try {
    assert(createdUserId, 'Requires user ID created in previous step');
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users/${createdUserId}`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 200);
    reportPass('Sandbox DELETE /users/:id removes user record successfully', { id: createdUserId });
  } catch (err) {
    reportFail('Sandbox DELETE /users/:id (Valid)', err);
  }

  // 10. Sandbox DELETE /users/:id (Non-existent 404)
  totalTests++;
  try {
    const res = await fetch(`http://127.0.0.1:${SANDBOX_PORT}/users/999999`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 404);
    reportPass('Sandbox DELETE /users/:id handles non-existent user with 404');
  } catch (err) {
    reportFail('Sandbox DELETE /users/:id (Non-existent)', err);
  }

  // Teardown
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  if (sandboxInstance) {
    await new Promise((resolve) => sandboxInstance.close(resolve));
  }

  console.log('\n===============================================================');
  console.log(`🏁 PHASE 1 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runPhase1Verification().catch((err) => {
    console.error('Fatal Phase 1 verification error:', err);
    process.exitCode = 1;
  });
}

module.exports = { runPhase1Verification };

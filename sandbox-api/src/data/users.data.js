/**
 * In-Memory Users Data Store
 * Provides initial sample records and CRUD operations for the Sandbox API.
 */

const INITIAL_USERS = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    role: 'admin',
    createdAt: '2026-01-10T08:30:00.000Z',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob.smith@example.com',
    role: 'developer',
    createdAt: '2026-02-14T10:15:00.000Z',
  },
  {
    id: '3',
    name: 'Charlie Davis',
    email: 'charlie.davis@example.com',
    role: 'tester',
    createdAt: '2026-03-01T14:45:00.000Z',
  },
];

// In-memory working copy
let users = [...INITIAL_USERS];
let nextId = 4;

function getAllUsers() {
  return [...users];
}

function getUserById(id) {
  return users.find((user) => String(user.id) === String(id)) || null;
}

function getUserByEmail(email) {
  if (!email) return null;
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

function createUser({ name, email, role = 'user' }) {
  const newUser = {
    id: String(nextId++),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    role: role.trim(),
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  return newUser;
}

function deleteUser(id) {
  const index = users.findIndex((user) => String(user.id) === String(id));
  if (index === -1) {
    return null;
  }
  const [deletedUser] = users.splice(index, 1);
  return deletedUser;
}

function resetUsers() {
  users = [...INITIAL_USERS];
  nextId = 4;
  return users;
}

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  deleteUser,
  resetUsers,
};

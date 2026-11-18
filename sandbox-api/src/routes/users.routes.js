const express = require('express');
const router = express.Router();
const usersStore = require('../data/users.data');

// Email regex pattern for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @route   GET /users
 * @desc    Get all users with optional role filtering
 * @access  Public
 */
router.get('/', (req, res) => {
  let allUsers = usersStore.getAllUsers();
  const { role } = req.query;

  if (role) {
    allUsers = allUsers.filter(
      (u) => u.role.toLowerCase() === String(role).toLowerCase()
    );
  }

  res.setHeader('X-Total-Count', allUsers.length);
  res.status(200).json(allUsers);
});

/**
 * @route   GET /users/:id
 * @desc    Get single user by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const user = usersStore.getUserById(id);

  if (!user) {
    return res.status(404).json({
      error: 'Not Found',
      message: `User with id '${id}' not found`,
    });
  }

  res.status(200).json(user);
});

/**
 * @route   POST /users
 * @desc    Create a new user
 * @access  Public
 */
router.post('/', (req, res) => {
  const { name, email, role } = req.body;
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
  } else if (name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
  }

  // Email validation
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: 'email', message: 'Email must be a valid email address' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Validation failed',
      details: errors,
    });
  }

  // Check email uniqueness
  const existingUser = usersStore.getUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      error: 'Conflict',
      message: `A user with email '${email.trim()}' already exists`,
    });
  }

  const newUser = usersStore.createUser({
    name,
    email,
    role: role || 'user',
  });

  res.status(201).json(newUser);
});

/**
 * @route   DELETE /users/:id
 * @desc    Delete user by ID
 * @access  Public
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const deletedUser = usersStore.deleteUser(id);

  if (!deletedUser) {
    return res.status(404).json({
      error: 'Not Found',
      message: `User with id '${id}' not found`,
    });
  }

  res.status(200).json({
    message: 'User deleted successfully',
    user: deletedUser,
  });
});

module.exports = router;

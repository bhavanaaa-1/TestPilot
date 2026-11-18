const express = require('express');
const cors = require('cors');
const usersRoutes = require('./routes/users.routes');
const healthRoutes = require('./routes/health.routes');
const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Allow cross-origin requests from frontend and test runners
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[SANDBOX] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Root metadata endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TestPilot Sandbox Mock API',
    description: 'Target sample API for OpenAPI testing and test case execution',
    status: 'online',
    version: '1.0.0-phase1',
    endpoints: {
      getAllUsers: 'GET /users',
      getUserById: 'GET /users/:id',
      createUser: 'POST /users',
      deleteUser: 'DELETE /users/:id',
      health: 'GET /health',
    },
  });
});

// Mount /users and /health directly
app.use('/users', usersRoutes);
app.use('/health', healthRoutes);

// Catch 404s
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;

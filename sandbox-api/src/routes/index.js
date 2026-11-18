const express = require('express');
const router = express.Router();
const usersRoutes = require('./users.routes');
const healthRoutes = require('./health.routes');

router.use('/users', usersRoutes);
router.use('/health', healthRoutes);

module.exports = router;

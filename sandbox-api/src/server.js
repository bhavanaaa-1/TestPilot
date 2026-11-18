const app = require('./app');
const config = require('./config/env');

const server = app.listen(config.PORT, () => {
  console.log('====================================================');
  console.log(`🧪 TestPilot Sandbox API running on port ${config.PORT}`);
  console.log(`📡 URL: http://localhost:${config.PORT}`);
  console.log(`👥 Users endpoint: http://localhost:${config.PORT}/users`);
  console.log(`🩺 Health check: http://localhost:${config.PORT}/health`);
  console.log('====================================================');
});

function handleGracefulShutdown(signal) {
  console.log(`\n[SANDBOX] ${signal} signal received: closing server...`);
  server.close(() => {
    console.log('[SANDBOX] Sandbox server closed cleanly.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[SANDBOX] Forced shutdown.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

module.exports = server;

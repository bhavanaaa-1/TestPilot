const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { initSocketIO } = require('./socket');

const httpServer = http.createServer(app);
initSocketIO(httpServer);

const server = httpServer.listen(config.PORT, () => {
  console.log('====================================================');
  console.log(`🚀 TestPilot Server running in ${config.NODE_ENV} mode`);
  console.log(`📡 URL: http://localhost:${config.PORT}`);
  console.log(`🩺 Health check: http://localhost:${config.PORT}/health`);
  console.log(`⚡ WebSockets: Socket.IO enabled on port ${config.PORT}`);
  console.log('====================================================');
});

// Handle graceful shutdown
function handleGracefulShutdown(signal) {
  console.log(`\n[SERVER] ${signal} signal received: closing HTTP server...`);
  server.close(() => {
    console.log('[SERVER] HTTP server closed cleanly.');
    process.exit(0);
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown due to timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

module.exports = server;

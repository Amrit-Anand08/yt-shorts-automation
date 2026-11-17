const app = require("./app");
const config = require("./config");
const { initializeDatabase } = require("./db");
const { startCleanupScheduler } = require("./services/cleanupService");
const {
  parseId,
  parseModelJson,
  normalizeScene,
  ensureWav,
  speechWeight,
} = require("./utils");

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(config.PORT, "0.0.0.0", () => {
      console.log(`Video worker running on port ${config.PORT}`);
    });

    startCleanupScheduler();
  } catch (error) {
    console.error("Worker startup failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

// Exported for testing and backwards compatibility with existing consumers.
module.exports = {
  app,
  startServer,
  parseId,
  parseModelJson,
  normalizeScene,
  ensureWav,
  speechWeight,
};

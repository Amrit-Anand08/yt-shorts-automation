const { pool } = require("../db");

function getHealth(req, res) {
  res.json({
    status: "healthy",
    service: "youtube-shorts-worker",
    timestamp: new Date().toISOString(),
  });
}

async function getDbHealth(req, res) {
  try {
    await pool.query("SELECT NOW()");
    res.json({ status: "healthy", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
    });
  }
}

module.exports = {
  getHealth,
  getDbHealth,
};

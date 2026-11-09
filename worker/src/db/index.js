const pool = require("./pool");
const { initializeDatabase } = require("./schema");

module.exports = {
  pool,
  initializeDatabase,
};

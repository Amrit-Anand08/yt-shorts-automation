// Test helper: replaces a module in the require cache with a stub.
const path = require("path");

function stub(relativePath, exportsObject) {
  const full = require.resolve(path.join(__dirname, "..", relativePath));
  require.cache[full] = {
    id: full,
    filename: full,
    loaded: true,
    exports: exportsObject,
  };
}

function unload(relativePath) {
  try {
    delete require.cache[require.resolve(path.join(__dirname, "..", relativePath))];
  } catch {
    // not loaded
  }
}

module.exports = { stub, unload };

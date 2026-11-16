// Malformed JSON bodies get a clean 400 instead of an HTML stack trace.
function errorHandler(error, req, res, next) {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  return next(error);
}

module.exports = {
  errorHandler,
};

const express = require("express");
const routes = require("./routes");
const { errorHandler } = require("./middlewares");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(routes);
app.use(errorHandler);

module.exports = app;

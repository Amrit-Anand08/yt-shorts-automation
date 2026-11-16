const express = require("express");
const { generateScript } = require("../controllers/scriptController");

const router = express.Router();

router.post("/scripts/generate", generateScript);

module.exports = router;

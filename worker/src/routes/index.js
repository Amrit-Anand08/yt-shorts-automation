const express = require("express");
const healthRoutes = require("./healthRoutes");
const scriptRoutes = require("./scriptRoutes");
const jobRoutes = require("./jobRoutes");

const router = express.Router();

router.use(healthRoutes);
router.use(scriptRoutes);
router.use(jobRoutes);

module.exports = router;

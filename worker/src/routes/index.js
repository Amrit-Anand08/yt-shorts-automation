const express = require("express");
const healthRoutes = require("./healthRoutes");
const scriptRoutes = require("./scriptRoutes");
const jobRoutes = require("./jobRoutes");
const youtubeRoutes = require("./youtubeRoutes");

const router = express.Router();

router.use(healthRoutes);
router.use(scriptRoutes);
router.use(jobRoutes);
router.use(youtubeRoutes);

module.exports = router;

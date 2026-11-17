const express = require("express");
const { getYoutubeStatus } = require("../controllers/youtubeController");

const router = express.Router();

router.get("/youtube/status", getYoutubeStatus);

module.exports = router;

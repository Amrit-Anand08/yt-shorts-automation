const express = require("express");
const {
  createJob,
  getJobById,
  downloadJobVideo,
  processJobById,
} = require("../controllers/jobController");

const router = express.Router();

router.post("/jobs", createJob);
router.get("/jobs/:id", getJobById);
router.get("/jobs/:id/video", downloadJobVideo);
router.post("/jobs/:id/process", processJobById);

module.exports = router;

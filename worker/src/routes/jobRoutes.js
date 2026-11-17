const express = require("express");
const {
  createJob,
  getJobById,
  downloadJobVideo,
  processJobById,
  uploadJobById,
} = require("../controllers/jobController");

const router = express.Router();

router.post("/jobs", createJob);
router.get("/jobs/:id", getJobById);
router.get("/jobs/:id/video", downloadJobVideo);
router.post("/jobs/:id/process", processJobById);
router.post("/jobs/:id/upload", uploadJobById);

module.exports = router;

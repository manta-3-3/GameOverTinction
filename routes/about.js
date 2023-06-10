const express = require("express");
const router = express.Router();

// require controller modules
const aboutController = require("../controllers/aboutController");

// GET about index
router.get("/", aboutController.get_about_index);

module.exports = router;

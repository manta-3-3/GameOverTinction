const express = require("express");
const router = express.Router();

// require controller modules
const quitController = require("../controllers/quitController");

// GET request to quit game
router.get("/", quitController.get_quit);

// POST request to to quit game
router.post("/", quitController.post_quit);

module.exports = router;

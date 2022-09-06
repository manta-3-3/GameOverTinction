const express = require("express");
const router = express.Router();

// require controller modules
const playController = require("../controllers/playController");

// GET request for index
router.get("/", playController.get_play_index);

// GET request for playing specified game
router.get("/:game_id", playController.get_play_game);

// POST request for playing specified game
router.post("/:game_id", playController.post_play_game);

module.exports = router;

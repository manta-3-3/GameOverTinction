const express = require("express");
const router = express.Router();

// require controller modules
const joinController = require("../controllers/joinController");

// GET request for list of all Game items
router.get("/", joinController.game_list);

// GET request to log-on for specified game
router.get("/:game_id", joinController.get_join_game);

// POST request to log-on for specified game
router.post("/:game_id", joinController.post_join_game);

module.exports = router;

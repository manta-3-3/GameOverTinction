const express = require("express");
const router = express.Router();

// require controller modules
const playController = require("../controllers/playController");

// require game state mappings
const gameStates = require("../utilities/gameStates");

// auth for game_id middleware
router.use("/:game_id", playController.authForGame_id);

// populate gameInfoHeader middleware
router.use("/:game_id", playController.fetchForGameInfoHeader);

// control current game round middleware
router.use("/:game_id/:gameState", playController.controlGameRound);

// control current gameState middleware
router.use("/:game_id/:gameState", playController.controlGameState);

// GET request for index
router.get("/", playController.get_play_index);

// GET request for playing specified game, welcome/info page for this game
router.get("/:game_id", playController.get_play_game_info);

// GET request for playing specified game during COLLECT_ANSWERS phase
router.get(
  `/:game_id/${gameStates.COLLECT_ANSWERS}`,
  playController.get_play_game_answer
);

// POST request for playing specified game during COLLECT_ANSWERS phase
router.post(
  `/:game_id/${gameStates.COLLECT_ANSWERS}`,
  playController.post_play_game_answer
);

// GET request for playing specified game during COLLECT_VOTES phase
router.get(
  `/:game_id/${gameStates.COLLECT_VOTES}`,
  playController.get_play_game_vote
);

// POST request for playing specified game during COLLECT_VOTES phase
router.post(
  `/:game_id/${gameStates.COLLECT_VOTES}`,
  playController.post_play_game_vote
);

// GET request for playing specified game during SHOW_RESULTS phase
router.get(
  `/:game_id/${gameStates.SHOW_RESULTS}`,
  playController.get_play_game_results
);

// POST request for playing specified game during SHOW_RESULTS phase
router.post(
  `/:game_id/${gameStates.SHOW_RESULTS}`,
  playController.post_play_game_results
);

module.exports = router;

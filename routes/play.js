const express = require("express");
const router = express.Router();

// require controller modules
const playController = require("../controllers/playController");

// auth for game_id middleware
router.use("/:game_id", playController.authForGame_id);

// populate gameInfoHeader middleware
router.use("/:game_id", playController.fetchForGameInfoHeader);

// control current game round middleware
router.use("/:game_id/:gameStatus", playController.controlGameRound);

// control current gameStatus middleware
router.use("/:game_id/:gameStatus", playController.controlGameStatus);

// GET request for index
router.get("/", playController.get_play_index);

// GET request for playing specified game, welcome/info page for this game
router.get("/:game_id", playController.get_play_game_info);

// GET request for playing specified game during collectingAnswers phase
router.get("/:game_id/answer", playController.get_play_game_answer);

// POST request for playing specified game during collectingAnswers phase
router.post("/:game_id/answer", playController.post_play_game_answer);

// GET request for playing specified game during voting phase
router.get("/:game_id/vote", playController.get_play_game_vote);

// POST request for playing specified game during voting phase
router.post("/:game_id/vote", playController.post_play_game_vote);

// GET request for playing specified game during showVotingResults phase
router.get("/:game_id/results", playController.get_play_game_results);

// POST request for playing specified game during showVotingResults phase
router.post("/:game_id/results", playController.post_play_game_results);

module.exports = router;

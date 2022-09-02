const express = require("express");
const router = express.Router();

// require controller modules
const joinController = require("../controllers/joinController");

// GET join home page
router.get("/", joinController.game_list);

module.exports = router;

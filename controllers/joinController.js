// require database models
const Game = require("../models/game");

// display list of available games
exports.game_list = function (req, res, next) {
  Game.find({})
    .select("-password")
    .exec(function (err, data) {
      if (err) return next(err);
      res.render("game_list", { title: "Select Game", list_games: data });
    });
};

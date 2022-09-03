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

// display login for specified game
exports.get_join_game = function (req, res, next) {
  res.render("join_game", { title: "Login Game", game_id: req.params.game_id });
};

// handle login for specified game
exports.post_join_game = function (req, res, next) {
  // check first if such game exists

  // reset session all session data is lost -> logged out from all games
  req.session.regenerate(function (err) {
    if (err) return next(err);
  });
};

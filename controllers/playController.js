// require database models
const Game = require("../models/game");

exports.get_index = function (req, res, next) {
  res.send("NOT IMPLEMENTED: GET /play");
};

exports.get_game = function (req, res, next) {
  // check if this user got access to this game via session-cookie
  if (!(req.session.game_id === req.params.game_id)) {
    return res.redirect(`/join/${req.params.game_id}`);
  }
  // access permitted go on
  res.send("NOT IMPLEMENTED: You got access to this game, go ahed");
};

exports.post_game = function (req, res, next) {
  res.send("NOT IMPLEMENTED: POST /play/:game_id route");
};

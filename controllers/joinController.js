const { body, validationResult } = require("express-validator");
const ObjectId = require("mongoose").Types.ObjectId;

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
exports.get_join_game = function (req, res) {
  res.render("join_game", {
    title: "Login Game",
    game_id: req.params.game_id,
  });
};

// handle login for specified game
exports.post_join_game = [
  // validate and sanitize fields
  body("playerName")
    .trim()
    .escape()
    .isLength({ max: 40 })
    .withMessage("Player Name cannot be longer than 40 characters.")
    .isAlphanumeric()
    .withMessage("Player Name has non-alphanumeric characters."),
  // TODO: body("playerColor") NOT IMPLEMENTED YET
  body("gamePassword")
    .trim()
    .escape()
    .custom(function (value, { req }) {
      return new Promise((resolve, reject) => {
        // fetch game for this game_id from database
        Game.findById(req.params.game_id)
          .then((db_game) => {
            if (db_game == null) {
              return reject("Sorry, No such game exists at the moment!");
            }
            if (db_game.password !== value) {
              return reject("Sorry, Wrong password for this game!");
            }
            return resolve();
          })
          .catch((err) => {
            return reject(err);
          });
      });
    }),
  // TODO: NOT IMPLEMENTED YET: ckeck if maxPlayers in game is not exceeded

  function (req, res) {
    // extract the validation errors from a request
    const valErrors = validationResult(req);
    if (!valErrors.isEmpty()) {
      // there are errors. Render form again with sanitized values/errors messages
      return res.render("join_game", {
        title: "Login Game",
        game_id: req.params.game_id,
        valErrors: valErrors.array(),
      });
    }
    // data from form is valid -> continue

    // reset session all session data is lost -> logged out from all games
    req.session.regenerate(function (err) {
      if (err) return next(err);
      // assigne data to session
      req.session.game_id = req.params.game_id;
      req.session.playerName = req.body.playerName;
      req.session.playerColor = "none"; // TODO: later req.body.playerColor
      req.session.playerAnswer = null;
      // redirect to the play route of this game
      res.redirect(`/play/${req.params.game_id}`);
    });
  },
];

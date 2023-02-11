const { body, validationResult } = require("express-validator");
const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// display list of available games
exports.join_game_list = function (req, res, next) {
  Game.find({})
    .select("-password")
    .exec(function (err, data) {
      if (err) return next(err);
      // TODO: display current player count at each game
      res.render("join_game_list", { title: "Select Game", list_games: data });
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
  body("playerColor")
    .exists()
    .withMessage("No Player Color field sent!")
    .bail()
    .trim()
    .escape()
    .isLength({ min: 1 })
    .withMessage("Player Color field empty")
    .bail()
    .isHexColor()
    .withMessage("Player Color isn't a Hex-Color Value!"),
  body("gamePassword")
    .trim()
    .escape()
    .custom(function (value, { req }) {
      return new Promise((resolve, reject) => {
        async.parallel(
          {
            //fetch game for this game_id from database
            db_game(callback) {
              Game.findById(req.params.game_id).exec(callback);
            },
            //fetch current player count at game_id from session
            sess_countCurrentPlayers(callback) {
              Session.countTotalPlayersByGame_id(req.params.game_id).exec(
                callback
              );
            },
          },
          (err, data) => {
            if (err) return reject(err);
            if (data.db_game == null) {
              return reject("Sorry, No such game exists at the moment!");
            }
            if (data.sess_countCurrentPlayers >= data.db_game.maxPlayers) {
              return reject("Sorry, maximum number of players reached!");
            }
            if (data.db_game.password !== value) {
              return reject("Sorry, Wrong password for this game!");
            }
            return resolve();
          }
        );
      });
    }),

  // extract the validation errors from a request
  function (req, res, next) {
    const valErrors = validationResult(req);
    if (!valErrors.isEmpty()) {
      // there are errors -> render form again with sanitized values/errors messages
      return res.render("join_game", {
        title: "Login Game",
        game_id: req.params.game_id,
        valErrors: valErrors.array(),
      });
    }
    // data from form is valid -> continue
    next();
  },

  // fetch gameStatus and assigne to locals
  function (req, res, next) {
    Game.findById(req.params.game_id)
      .select("gameStatus")
      .exec((err, data) => {
        if (err) return next(err);
        res.locals.gameStatus = data.gameStatus;
        next();
      });
  },

  // create new session and assigne data to it
  function (req, res, next) {
    // reset session all session data is lost -> logged out from all games
    req.session.regenerate(function (err) {
      if (err) return next(err);
      // assigne data to session
      req.session.game_id = req.params.game_id;
      req.session.playerName = req.body.playerName;
      req.session.playerColor = req.body.playerColor;
      req.session.playerPoints = 0;
      req.session.playerAnswer = null;
      req.session.answerLetter = null;
      req.session.playerVote = null;
      // only place player in round if game is at collectingAnswers phase
      if (res.locals.gameStatus === "collectingAnswers") {
        req.session.isInRound = true;
      } else {
        req.session.isInRound = false;
      }
      // save data immediately back to db
      req.session.save(function (err) {
        if (err) return next(err);
        // redirect to the play route of this game
        res.redirect(`/play/${req.params.game_id}`);
      });
    });
  },
];

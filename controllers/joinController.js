const { body, validationResult } = require("express-validator");
const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// require game utilities
const gameUtil = require("../utilities/util_game");

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
    .exists()
    .withMessage("No playerName field sent!")
    .bail()
    .isString()
    .withMessage("playerName isn't a String!")
    .bail()
    .trim()
    .escape()
    .notEmpty()
    .withMessage("playerName is empty!")
    .isLength({ max: 40 })
    .withMessage("playerName cannot be longer than 40 characters!")
    .isAlphanumeric()
    .withMessage("playerName has non-alphanumeric characters!"),
  body("playerColor")
    .exists()
    .withMessage("No playerColor field sent!")
    .bail()
    .isString()
    .withMessage("playerColor isn't a String!")
    .bail()
    .trim()
    .escape()
    .isHexColor()
    .withMessage("playerColor isn't a hex-color value!"),
  body("gamePassword")
    .exists()
    .withMessage("No gamePassword field sent!")
    .bail()
    .isString()
    .withMessage("gamePassword isn't a String!")
    .bail()
    .trim()
    .escape()
    .notEmpty()
    .withMessage("gamePassword is empty!")
    .bail()
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

  // create new session and assigne data to it
  function (req, res, next) {
    // reset session all session data is lost -> logged out from all games
    req.session.regenerate(async function (err) {
      if (err) return next(err);

      // assigne data to session
      req.session.game_id = req.params.game_id;
      req.session.playerName = req.body.playerName;
      req.session.playerColor = req.body.playerColor;
      req.session.joinTime = new Date();
      req.session.playerPoints = 0;
      req.session.roundPoints = {
        correctAnswer: 0,
        othersWrongVote: 0,
      };
      req.session.playerAnswer = null;
      req.session.answerLetter = null;
      req.session.playerVote = null;

      try {
        // fetch game and assign to locals
        res.locals.db_game = await Game.findById(req.params.game_id)
          .select("-password")
          .exec();
      } catch (err) {
        return next(err);
      }

      // only place player in round if game is at collectingAnswers phase
      req.session.isInRound =
        res.locals.db_game.gameStatus === "collectingAnswers";

      // save data immediately back to db
      req.session.save(async function (err) {
        if (err) return next(err);

        try {
          // update game
          await gameUtil.updateGame(res.locals.db_game, false);
        } catch (err) {
          return next(err);
        }

        // redirect to the play route of this game
        res.redirect(`/play/${req.params.game_id}`);
      });
    });
  },
];

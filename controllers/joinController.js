const { body, validationResult } = require("express-validator");
const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// require game utilities
const gameUtil = require("../utilities/util_game");
// require promisify session functions
const sessionFuncts = require("../utilities/promisifySessionFuncts");
// require game state mappings
const gameStates = require("../utilities/gameStates");

// display list of available games
exports.join_game_list = function (req, res, next) {
  Game.find({})
    .select("-password")
    .exec()
    .then((data) => {
      // TODO: display current player count at each game
      return res.render("join_game_list", {
        title: "Select Game",
        list_games: data,
      });
    })
    .catch((err) => next(err));
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
    .bail()
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
    .withMessage("gamePassword is empty!"),

  // check game password
  async function (req, res, next) {
    if (!validationResult(req).isEmpty()) next();
    try {
      const data = await async.parallel({
        //fetch game for this game_id from database
        db_game: function (callback) {
          Game.findById(req.params.game_id).exec(callback);
        },
        //fetch current player count at game_id from session
        sess_countCurrPlayers: function (callback) {
          Session.countTotalPlayersByGame_id(req.params.game_id).exec(callback);
        },
      });
      await body("gamePassword")
        .custom((value) => {
          if (!data.db_game)
            throw new Error("Sorry, No such game exists at the moment!");
          // add db_game to locals for later use
          res.locals.db_game = data.db_game;
          return true;
        })
        .bail()
        .custom((value) => {
          if (data.sess_countCurrPlayers >= data.db_game.maxPlayers)
            throw new Error("Sorry, maximum number of players reached!");
          return true;
        })
        .bail()
        .custom((value) => {
          if (data.db_game.password !== value)
            throw new Error("Sorry, Wrong password for this game!");
          return true;
        })
        .run(req, { dryRun: false });
    } catch (err) {
      return next(err);
    }
    next();
  },

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
  async function (req, res, next) {
    try {
      // reset session all session data is lost -> logged out from all games
      await sessionFuncts.regenerate(req);

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
      // only place player in round if game is at COLLECT_ANSWERS state
      req.session.isInRound =
        res.locals.db_game.gameState === gameStates.COLLECT_ANSWERS;

      // save session data immediately back to db
      await sessionFuncts.save(req);

      // update game
      await gameUtil.updateGame(res.locals.db_game, false);
    } catch (err) {
      return next(err);
    }

    // redirect to the play route of this game
    return res.redirect(`/play/${req.params.game_id}`);
  },
];

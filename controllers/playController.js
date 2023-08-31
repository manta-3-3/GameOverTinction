const { body, validationResult } = require("express-validator");
const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// require game utilities
const gameUtil = require("../utilities/util_game");
// require promisify session functions
const sessionFuncts = require("../utilities/promisifySessionFuncts");

// TODO:
// GET /
exports.get_play_index = function (req, res) {
  return res.render("play_index", {
    title: "Happy Playing",
  });
};

// middleware to check if this user got access to this game via session-cookie
// USE /:game_id
exports.authForGame_id = function (req, res, next) {
  if (req.session.game_id === req.params.game_id) return next();
  // else access denied redirect to join page
  return res.redirect(`/join/${req.params.game_id}`);
};

// midleware fetch game-info form database for GameInfoHeader
// USE /:game_id
exports.fetchForGameInfoHeader = function (req, res, next) {
  // fetch game for this game_id from database
  Game.findById(req.params.game_id)
    .select("-password")
    .exec()
    .then((db_game) => {
      if (!db_game) {
        // No such game found
        const err = new Error("Game not found");
        err.status = 404;
        throw err;
      }
      // assign db_game to locals
      res.locals.db_game = db_game;
    })
    .then(() =>
      async.parallel({
        // fetch current countTotalPlayers for this game_id from sessions
        countTotalPlayers: (cb) => {
          Session.countTotalPlayersByGame_id(res.locals.db_game._id).exec(cb);
        },
        // fetch playerName of current mod from sessions
        modInfo: (cb) => {
          Session.findValidModInfo(
            res.locals.db_game.currModerator.sessionPlayerId,
            res.locals.db_game._id
          ).exec(cb);
        },
      })
    )
    .then((results) => {
      // assign countTotalPlayers and mod Name to locals
      res.locals.sess_game = {
        totalPlayers: results.countTotalPlayers,
        modName: results.modInfo?.name,
      };
      // assign user session data to locals
      res.locals.sess_user = req.session;
      // determin and assign isMod directly to locals
      res.locals.isMod =
        req.sessionID === res.locals.db_game.currModerator.sessionPlayerId &&
        req.session.isInRound;
      // go on
      return next();
    })
    .catch((err) => next(err));
};

// GET /:game_id
exports.get_play_game_info = function (req, res) {
  return res.render("play_game_info", {
    title: "Welcome to the game!",
  });
};

// middleware to check if player is in current round
// USE /:game_id/:gameState
exports.controlGameRound = function (req, res, next) {
  // player can pass if he is in current round
  if (res.locals.sess_user.isInRound) return next();
  // else redirect to waiting page e.g welcome/info page for this game
  return res.redirect(`/play/${res.locals.db_game._id}`);
};

// middleware to controle the current gameState route flow
// USE /:game_id/:gameState
exports.controlGameState = function (req, res, next) {
  // controle gameState route
  if (res.locals.db_game.continueURL === req.originalUrl) {
    return next();
  } else {
    return res.redirect(res.locals.db_game.continueURL);
  }
};

// GET /:game_id/${gameStates.COLLECT_ANSWERS}
exports.get_play_game_answer = function (req, res) {
  return res.render("play_game_answer", {
    title: "Submit your answer",
  });
};

// POST /:game_id/${gameStates.COLLECT_ANSWERS}
exports.post_play_game_answer = [
  // validate and sanitize fields
  body("playerAnswer")
    .exists()
    .withMessage("No playerAnswer field sent!")
    .bail()
    .isString()
    .withMessage("playerAnswer isn't a String!")
    .bail()
    .trim()
    .escape()
    .notEmpty()
    .withMessage("playerAnswer is empty!")
    .bail()
    .isLength({ max: 250 })
    .withMessage("playerAnswer cannot be longer than 250 characters!"),
  async function (req, res, next) {
    try {
      await body("isModAnswerType")
        .exists()
        .withMessage("No userhidden isModAnswerType field sent!")
        .bail()
        .isBoolean({ loose: false })
        .withMessage("isModAnswerType isn't a Boolean!")
        .bail()
        .toBoolean(true)
        // check if isModAnswerType match role of player
        .custom((value) => {
          if (value !== res.locals.isMod) {
            const customMsg = res.locals.isMod
              ? "the moderator"
              : "a normal player";
            throw new Error(
              "Wrong answer type submitted, be aware you are now " +
                customMsg +
                "!"
            );
          }
          return true;
        })
        .run(req);
    } catch (err) {
      return next(err);
    }
    return next();
  },

  function (req, res, next) {
    // extract the validation errors from a request
    const valErrors = validationResult(req);
    if (!valErrors.isEmpty()) {
      // there are errors. Render form again with sanitized values/errors messages
      return res.render("play_game_answer", {
        title: "Submit your answer",
        valErrors: valErrors.array(),
        localPlayerAnswer: req.body.playerAnswer,
      });
    }
    // data from form is valid -> continue

    // save the playerAnswer in the session
    req.session.playerAnswer = req.body.playerAnswer;
    sessionFuncts
      .save(req)
      .then(() => next("route"))
      .catch((err) => next(err));
  },
];

// GET /:game_id/${gameStates.COLLECT_VOTES}
exports.get_play_game_vote = function (req, res, next) {
  Session.findAnswersAndLettersByGame_id(res.locals.db_game.id)
    .exec()
    .then((data) =>
      res.render("play_game_vote", {
        title: "Vote for an answer",
        answersAndLetters: data,
      })
    )
    .catch((err) => next(err));
};

// POST /:game_id/${gameStates.COLLECT_VOTES}
exports.post_play_game_vote = [
  // check if player is mod, if so skip other actions
  function (req, res, next) {
    if (res.locals.isMod) return next("route");
    return next();
  },

  // validate and sanitize fields
  body("playerVote")
    .exists()
    .withMessage("No playerVote field sent!")
    .bail()
    .isString()
    .withMessage("playerVote isn't a String!")
    .bail()
    .trim()
    .escape()
    .notEmpty()
    .withMessage("playerVote is empty!")
    .bail()
    .isLength({ max: 1 })
    .withMessage("playerVote can only be one letter!")
    .bail()
    .isAlpha()
    .withMessage("playerVote isn't an alphabetical letter!"),

  function (req, res, next) {
    // extract the validation errors from a request
    const valErrors = validationResult(req);
    if (!valErrors.isEmpty()) {
      // there are errors. Render form again with sanitized values/errors messages
      return Session.findAnswersAndLettersByGame_id(res.locals.db_game.id)
        .exec()
        .then((data) =>
          res.render("play_game_vote", {
            title: "Vote for an answer",
            answersAndLetters: data,
            valErrors: valErrors.array(),
          })
        )
        .catch((err) => next(err));
    }
    // data from form is valid -> continue

    // save the playerVote in the session
    req.session.playerVote = req.body.playerVote;
    sessionFuncts
      .save(req)
      .then(() => next("route"))
      .catch((err) => next(err));
  },
];

// GET /:game_id/${gameStates.SHOW_RESULTS}
exports.get_play_game_results = function (req, res, next) {
  gameUtil
    .fetchAndProcessGameResults(res.locals.db_game)
    .then((data) =>
      res.render("play_game_results", {
        title: "Show Results",
        resultData: data,
      })
    )
    .catch((err) => next(err));
};

// POST /:game_id/${gameStates.SHOW_RESULTS}
exports.post_play_game_results = [
  // set isInRound to false
  function (req, res, next) {
    req.session.isInRound = false;
    sessionFuncts
      .save(req)
      .then(() => next("route"))
      .catch((err) => next(err));
  },
];

// update game at end of each request to
// POST /:game_id/:gameState
exports.post_play_updateGame = function (req, res, next) {
  gameUtil
    .updateGame(res.locals.db_game, false)
    .then((continueURL) =>
      res.redirect(continueURL ? continueURL : req.originalUrl)
    )
    .catch((err) => next(err));
};

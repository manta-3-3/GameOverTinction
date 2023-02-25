const { body, validationResult } = require("express-validator");
const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// require game utilities
const gameUtil = require("../utilities/util_game");

// middleware to check if this user got access to this game via session-cookie
exports.authForGame_id = function (req, res, next) {
  // check access by session-cookie
  if (req.session.game_id !== req.params.game_id) {
    return res.redirect(`/join/${req.params.game_id}`);
  } else {
    // access permitted go on
    next();
  }
};

// midleware fetch game-info form database for GameInfoHeader
exports.fetchForGameInfoHeader = function (req, res, next) {
  async.parallel(
    {
      // fetch game for this game_id from database
      db_game(callback) {
        Game.findById(req.params.game_id).select("-password").exec(callback);
      },
      // fetch current countTotalPlayers for this game_id from sessions
      countTotalPlayers(callback) {
        Session.countTotalPlayersByGame_id(req.params.game_id).exec(callback);
      },
    },
    function (err, results) {
      if (err) return next(err);
      if (results.db_game == null) {
        // No such game found
        const err = new Error("Game not found");
        err.status = 404;
        return next(err);
      }
      // assign db_game to locals
      res.locals.db_game = results.db_game;
      // assign countTotalPlayers and countPlayersInRound to locals
      res.locals.sess_game = {
        totalPlayers: results.countTotalPlayers,
      };
      // assign user session data to locals
      res.locals.sess_user = req.session;
      // go on
      next();
    }
  );
};

// middleware to check if player is in current round
exports.controlGameRound = function (req, res, next) {
  // player can pass if he is in current round
  if (res.locals.sess_user.isInRound) return next();
  // else redirect to waiting page e.g welcome/info page for this game
  return res.redirect(`/play/${res.locals.db_game._id}`);
};

// middleware to controle the current gameStatus route flow
exports.controlGameStatus = function (req, res, next) {
  // controle gameStatus route
  if (res.locals.db_game.continueURL === req.originalUrl) {
    next();
  } else {
    res.redirect(res.locals.db_game.continueURL);
  }
};

// TODO:
exports.get_play_index = function (req, res) {
  res.render("play_index", {
    title: "Happy Playing",
  });
};

exports.get_play_game_info = function (req, res) {
  res.render("play_game_info", {
    title: "Welcome to the game!",
  });
};

exports.get_play_game_answer = function (req, res) {
  res.render("play_game_answer", {
    title: "Submit your answer",
  });
};

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
    .isLength({ max: 250 })
    .withMessage("playerAnswer cannot be longer than 250 characters!"),
  function (req, res, next) {
    // extract the validation errors from a request
    const valErrors = validationResult(req);
    if (!valErrors.isEmpty()) {
      // there are errors. Render form again with sanitized values/errors messages
      return res.render("play_game_answer", {
        title: "Submit your answer",
        valErrors: valErrors.array(),
      });
    }
    // data from form is valid -> continue

    // save the playerAnswer in the session
    req.session.playerAnswer = req.body.playerAnswer;
    req.session.save((err) => {
      if (err) next(err);
      return next();
    });
  },

  // set gameId at locals for further gameUpdate
  function (req, res, next) {
    res.locals.gameId = res.locals.db_game._id;
    return next();
  },

  // updateGame
  gameUtil.updateGame,

  // redirect
  function (req, res) {
    return res.redirect(res.locals.continueURL);
  },
];

exports.get_play_game_vote = function (req, res, next) {
  Session.findAnswersAndLettersByGame_id(res.locals.db_game.id).exec(
    (err, data) => {
      if (err) next(err);
      res.render("play_game_vote", {
        title: "Vote for an answer",
        answersAndLetters: data,
      });
    }
  );
};

exports.post_play_game_vote = [
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
      return Session.findAnswersAndLettersByGame_id(res.locals.db_game.id).exec(
        (err, data) => {
          if (err) return next(err);
          return res.render("play_game_vote", {
            title: "Vote for an answer",
            answersAndLetters: data,
            valErrors: valErrors.array(),
          });
        }
      );
    }
    // data from form is valid -> continue

    // save the playerVote in the session
    req.session.playerVote = req.body.playerVote;
    req.session.save((err) => {
      if (err) return next(err);
      return next();
    });
  },

  // set gameId at locals for further gameUpdate
  function (req, res, next) {
    res.locals.gameId = res.locals.db_game._id;
    return next();
  },

  // updateGame
  gameUtil.updateGame,

  // redirect
  function (req, res) {
    return res.redirect(res.locals.continueURL);
  },
];

exports.get_play_game_results = function (req, res, next) {
  gameUtil
    .fetchAndProcessGameResults(res.locals.db_game._id)
    .then((data) => {
      return res.render("play_game_results", {
        title: "Show Results",
        resultData: data,
      });
    })
    .catch((err) => {
      next(err);
    });
};

exports.post_play_game_results = [
  // set isInRound to false
  function (req, res, next) {
    req.session.isInRound = false;
    req.session.save((err) => {
      if (err) return next(err);
      return next();
    });
  },

  // set gameId at locals for further gameUpdate
  function (req, res, next) {
    res.locals.gameId = res.locals.db_game._id;
    return next();
  },

  // updateGame
  gameUtil.updateGame,

  // redirect
  function (req, res) {
    return res.redirect(res.locals.continueURL);
  },
];

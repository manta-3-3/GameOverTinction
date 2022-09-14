const { body, validationResult } = require("express-validator");
const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// mapping gameStatus from database to corresponding route and vice versa
const routeToDb = {
  answer: "collectingAnswers",
  vote: "voting",
  results: "showVotingResults",
};
const dbToRoute = {
  collectingAnswers: "answer",
  voting: "vote",
  showVotingResults: "results",
};

// middleware to check if this user got access to this game via session-cookie and fetch game-info form database
exports.authForGame_id = function (req, res, next) {
  // check access by session-cookie
  if (req.session.game_id !== req.params.game_id) {
    return res.redirect(`/join/${req.params.game_id}`);
  }
  //TODO: callback hell, fix it with async parallel
  // fetch game for this game_id from database
  Game.findById(req.params.game_id)
    .select("-password")
    .exec(function (err, db_game) {
      if (err) return next(err);
      if (db_game == null) {
        // no results
        const err = new Error("Game not found");
        err.status = 404;
        return next(err);
      }
      // assign db_game to locals
      res.locals.db_game = db_game;
      // fetch other game infos from sessions and assign to locals
      Session.countTotalPlayersByGame_id(db_game.id).exec(function (
        err,
        count
      ) {
        if (err) return next(err);
        res.locals.sess_game = { totalPlayers: count };
        // assign session data to locals
        res.locals.sess_user = req.session;
        // access permitted go on
        next();
      });
    });
};

// middleware to controle the current gameStatus route flow
exports.controlGameStatus = function (req, res, next) {
  if (res.locals.db_game.gameStatus === routeToDb[req.params.gameStatus]) {
    next();
  } else {
    res.redirect(
      `/play/${req.params.game_id}/${dbToRoute[res.locals.db_game.gameStatus]}`
    );
  }
};

// TODO:
exports.get_play_index = function (req, res) {
  res.send(`NOT IMPLEMENTED: ${req.method} ${req.path} route`);
};

exports.get_play_game_info = function (req, res) {
  const continueURL = `/play/${req.params.game_id}/${
    dbToRoute[res.locals.db_game.gameStatus]
  }`;
  res.render("play_game_info", {
    title: "Welcome to the game!",
    continueURL: continueURL,
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
    .trim()
    .escape()
    .isLength({ min: 1 })
    .withMessage("Your answer should contain at least 1 character!")
    .isLength({ max: 250 })
    .withMessage("Your answer cannot be longer than 40 characters!"),

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
      next();
    });
  },

  // check gameStatus for updates during collectingAnswers phase
  function (req, res, next) {
    async.waterfall(
      [
        function (callback) {
          Session.countProvPlayerAnswerByGame_id(res.locals.db_game.id).exec(
            callback
          );
        },
        function (countPlayerAnswered, callback) {
          if (countPlayerAnswered === res.locals.sess_game.totalPlayers) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
      ],
      function (err, readyToChangeGameStatus) {
        if (err) return next(err);
        if (readyToChangeGameStatus) {
          next();
        } else {
          // redirect to same URL
          res.redirect(req.originalUrl);
        }
      }
    );
  },

  // gameStatus should be changed and further corresponding actions executed
  function (req, res, next) {
    async.parallel(
      [
        function (callback) {
          //---------fetch game and update----------
          Game.findByIdAndUpdate(
            res.locals.db_game.id,
            { gameStatus: "voting" },
            {},
            callback
          );
        },
        async function (callback) {
          //---------add letters------------
          // generate random ordered alphabet array, max 26 letters, so max 26 Players per game
          const unshuffledLetArr = [
            ...Array(res.locals.sess_game.totalPlayers),
          ].map((_, i) => String.fromCharCode(i + 65));
          // shuffle the unshuffledLetArr
          const shuffledLetArr = unshuffledLetArr
            .map((value) => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
          let letInd = 0;
          // fetch answers form session an assigne letters
          const cursor = Session.findAnswersByGame_id(
            res.locals.db_game.id
          ).cursor();
          for (
            let doc = await cursor.next();
            doc != null;
            doc = await cursor.next()
          ) {
            doc.session.answerLetter = shuffledLetArr[letInd];
            await doc.save();
            letInd++;
          }
          //---------add letters finished------------
        },
      ],
      function (err) {
        if (err) return next(err);
        res.redirect(`/play/${res.locals.db_game.id}/vote`);
      }
    );
  },
];

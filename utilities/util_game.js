const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

// updates game with id stored at res.locals.gameId
// and sets res.locals.continueURL
exports.updateGame = async function (req, res, next) {
  if (!res.locals.gameId) return next();
  try {
    // fetch gameStatus and id
    const game = await Game.findById(res.locals.gameId)
      .select("gameStatus")
      .exec();
    if (!game) {
      // No such game found
      const error = new Error("Game not found");
      error.status = 404;
      throw error;
    }
    // switch over different states
    res.locals.continueURL = req.originalUrl;
    let sess;
    switch (game.gameStatus) {
      case "collectingAnswers":
        // check if update needed
        sess = await async.parallel({
          inRound: (cb) => {
            Session.countPlayersInRoundByGame_id(game.id).exec(cb);
          },
          answered: (cb) => {
            Session.countProvPlayerAnswerByGame_id(game.id).exec(cb);
          },
        });
        if (sess.inRound === 0 || sess.inRound !== sess.answered) break;
        // do update
        await async.parallel([
          (cb) => {
            // update gameStatus
            Game.findByIdAndUpdate(game.id, { gameStatus: "voting" }, {}, cb);
          },
          async (cb) => {
            // generate random ordered alphabet array, max 26 letters, so max 26 Players per game
            const unshuffledLetArr = [...Array(sess.inRound)].map((_, i) =>
              String.fromCharCode(i + 65)
            );
            // shuffle the unshuffledLetArr
            const shuffledLetArr = unshuffledLetArr
              .map((value) => ({ value, sort: Math.random() }))
              .sort((a, b) => a.sort - b.sort)
              .map(({ value }) => value);
            let letInd = 0;
            // fetch answers form session an assigne letters
            const cursor = Session.findAnswersByGame_id(game.id).cursor();
            for (
              let doc = await cursor.next();
              doc != null;
              doc = await cursor.next()
            ) {
              doc.session.answerLetter = shuffledLetArr[letInd];
              await doc.save();
              letInd++;
            }
          },
        ]);
        // set continueURL
        res.locals.continueURL = `/play/${game.id}/vote`;
        break;

      case "voting":
        // check if update needed
        sess = await async.parallel({
          inRound: (cb) => {
            Session.countPlayersInRoundByGame_id(game.id).exec(cb);
          },
          voted: (cb) => {
            Session.countProvPlayerVoteByGame_id(game.id).exec(cb);
          },
        });
        if (sess.inRound === 0 || sess.inRound !== sess.voted) break;
        // do update
        // update gameStatus
        await Game.findByIdAndUpdate(
          game.id,
          { gameStatus: "showVotingResults" },
          {}
        ).exec();
        // set continueURL
        res.locals.continueURL = `/play/${game.id}/results`;
        break;

      case "showVotingResults":
        // check if update needed
        sess = await async.parallel({
          total: (cb) => {
            Session.countTotalPlayersByGame_id(game.id).exec(cb);
          },
          readyForNext: (cb) => {
            Session.countReadyForNextRoundByGame_id(game.id).exec(cb);
          },
        });
        if (sess.total === 0 || sess.total !== sess.readyForNext) {
          res.locals.continueURL = `/play/${game.id}`;
          break;
        }
        // do update
        await async.parallel([
          (cb) => {
            // update gameStatus
            Game.findByIdAndUpdate(
              game.id,
              { gameStatus: "collectingAnswers" },
              {},
              cb
            );
          },
          (cb) => {
            // reset all sessions for this game for a new round
            Session.resetForNewRoundByGame_id(game.id).exec(cb);
          },
        ]);
        // set continueURL
        res.locals.continueURL = `/play/${game.id}/answer`;
        break;

      default:
        throw new Error(
          `update game ${res.locals.gameId} failed: no valid gameStatus found!`
        );
        break;
    }
  } catch (err) {
    return next(err);
  }
  return next();
};

exports.fetchAndProcessGameResults = function (gameId) {
  return new Promise((resolve, reject) => {
    Session.findAnswersLettersCreatorsVotesByGame_id(gameId).exec(
      (err, data) => {
        if (err) reject(err);
        const map = new Map();
        // assigne keyValue pairs to map
        for (ele of data) {
          if (!ele.letter) continue;
          map.set(ele.letter, {
            creator: ele.creator,
            letter: ele.letter,
            answer: ele.answer,
            voters: [],
          });
        }
        // count votes
        for (ele of data) {
          if (!ele.vote) continue;
          map.get(ele.vote)?.voters.push(ele.creator);
        }
        // return array sorted by letter
        resolve(
          [...map.values()].sort((a, b) => {
            return a.letter == b.letter ? 0 : a.letter > b.letter ? 1 : -1;
          })
        );
      }
    );
  });
};

/**
 * updates moderator of a specific game
 * @param {string} game_id specific game
 * @param {object} currModerator must include the following properties
 * @property {string} currModerator.sessionPlayerId
 * @property {date} currModerator.joinTime
 * @param {boolean} selNext true: take next mod, false: same mod as before if present
 * @return {Promise<boolean>} boolean indicating if mod was updated
 */
exports.updateModerator = function (game_id, currModerator, selNext) {
  return (
    Session.getUpdatedModerator(game_id, currModerator.joinTime, selNext)
      .exec()
      .then((data) => {
        if (!data.length) {
          // no players found
          return;
        } else if (data[0].sessionPlayerId === currModerator.sessionPlayerId) {
          // new found moderator is the same as before
          return;
        } else {
          // update game with new moderator data
          return Game.findByIdAndUpdate(
            game_id,
            {
              currModerator: data[0],
            },
            { new: true, select: "name currModerator" }
          ).exec();
        }
      })
      // return true if moderator was updated
      .then((data) => !!data)
  );
};

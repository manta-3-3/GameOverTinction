const async = require("async");

// require database models
const Game = require("../models/game");
const Session = require("../models/session");

/**
 * updates a specific game
 * @param {string | ObjectId | object} game
 * string/ObjectId: fetch game document with this id from database
 * object: alternatively use this game document fetched earlier from database
 * @param {boolean} needRefetch flag indicating if refetch needed
 * true: provide at {@link game} game id
 * false: provide at {@link game} game document
 * @return {Promise<void | string>} continueURL for later redirection (optional)
 */
exports.updateGame = async function (game, needRefetch) {
  // check for potential refetch of game object
  if (needRefetch) {
    // game id provided, so refetch new game data and override it
    game = await Game.findById(game).select("-password").exec();
    if (!game) {
      // No such game found
      const error = new Error("Game not found!");
      error.status = 404;
      throw error;
    }
  }

  // do different actions based on current gameStatus
  switch (game.gameStatus) {
    case "collectingAnswers":
      return updateGame_collectingAnswers(game);
    case "voting":
      return updateGame_voting(game);
    case "showVotingResults":
      return updateGame_showVotingResults(game);
    default:
      throw new Error(
        `update game ${game._id} failed: no valid gameStatus found!`
      );
  }
};

/**
 * updateGame handler at collectingAnswers phase
 * @param {object} game game document fetched from database
 * @return {Promise<void | string>} continueURL for later redirection (optional)
 */
async function updateGame_collectingAnswers(game) {
  // check if current mod still present, if not (-> mod lost), reset game to restart a new round
  const modFound = await Session.findValidModInfo(
    game.currModerator.sessionPlayerId,
    game._id
  ).exec();
  if (!modFound) {
    await initNewRound(game, false);
    return;
  }

  // check if update needed
  const sess = await async.parallel({
    inRound: (cb) => {
      Session.countPlayersInRoundByGame_id(game._id).exec(cb);
    },
    answered: (cb) => {
      Session.countProvPlayerAnswerByGame_id(game._id).exec(cb);
    },
  });

  // early return if no update needed
  if (sess.inRound === 0 || sess.inRound !== sess.answered) return;

  // do update
  await async.parallel([
    (cb) => {
      // update gameStatus
      Game.findByIdAndUpdate(game._id, { gameStatus: "voting" }, {}, cb);
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
      const cursor = Session.findAnswersByGame_id(game._id).cursor();
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

  // return continueURL
  return `/play/${game._id}/vote`;
}

/**
 * updateGame handler at voting phase
 * @param {object} game game document fetched from database
 * @return {Promise<void | string>} continueURL for later redirection (optional)
 */
async function updateGame_voting(game) {
  // check if update needed
  const sess = await async.parallel({
    inRound: (cb) => {
      Session.countPlayersInRoundByGame_id(game._id).exec(cb);
    },
    voted: (cb) => {
      Session.countProvPlayerVoteByGame_id(game._id).exec(cb);
    },
  });

  // early return if no update needed
  // moderator hasn't to vote, therefore sess.inRound-1
  if (sess.inRound === 0 || sess.inRound - 1 > sess.voted) return;

  // do update
  await Promise.all([
    // update gameStatus
    Game.findByIdAndUpdate(
      game._id,
      { gameStatus: "showVotingResults" },
      {}
    ).exec(),
    // do score evaluation
    assignPoints(game),
  ]);

  // return continueURL
  return `/play/${game._id}/results`;
}

/**
 * updateGame handler at showVotingResults phase
 * @param {object} game game document fetched from database
 * @return {Promise<void | string>} continueURL for later redirection (optional)
 */
async function updateGame_showVotingResults(game) {
  // check if update needed
  const sess = await async.parallel({
    total: (cb) => {
      Session.countTotalPlayersByGame_id(game._id).exec(cb);
    },
    readyForNext: (cb) => {
      Session.countReadyForNextRoundByGame_id(game._id).exec(cb);
    },
  });

  // early return if no update needed
  if (sess.total === 0 || sess.total !== sess.readyForNext)
    return `/play/${game._id}`;

  // do update
  await initNewRound(game, true);

  // return continueURL
  return `/play/${game._id}/answer`;
}

/**
 * updates moderator of a specific game
 * @param {string | ObjectId} gameId specific game
 * @param {object} currModerator must include the following properties
 * @property {string | null} currModerator.sessionPlayerId if null then game has currently no mod
 * @property {date} currModerator.joinTime
 * @param {boolean} selNext true: take next mod, false: same mod as before if present
 * @return {Promise<boolean>} boolean indicating if mod was changed
 */
function updateModerator(gameId, currModerator, selNext) {
  return (
    Session.getUpdatedModerator(String(gameId), currModerator.joinTime, selNext)
      .exec()
      .then((data) => {
        if (data.length === 0) {
          // no players found
          // return a moderator object where all properties are set to null except keep joinTime
          return {
            sessionPlayerId: null,
            joinTime: currModerator.joinTime,
          };
        }
        // return (new) found moderator object
        return data[0];
      })
      // update game with new moderator data
      .then((toUpdateModerator) =>
        Game.findByIdAndUpdate(
          gameId,
          {
            currModerator: toUpdateModerator,
          },
          { new: true, select: "currModerator" }
        ).exec()
      )
      // return true if moderator was changed
      .then(
        (data) =>
          data.currModerator.sessionPlayerId !== currModerator.sessionPlayerId
      )
  );
}

/**
 * inits a new round of a specific game
 * @param {object} game game document fetched from database
 * @param {boolean} selNextMod true: take next mod, false: same mod as before if present
 * @return {Promise}
 */
function initNewRound(game, selNextMod) {
  return Promise.all([
    // update gameStatus
    Game.findByIdAndUpdate(
      game._id,
      { gameStatus: "collectingAnswers" },
      {}
    ).exec(),
    // reset all sessions for this game for a new round
    Session.resetForNewRoundByGame_id(game._id).exec(),
  ]).then(() =>
    // assign next new moderator
    updateModerator(game._id, game.currModerator, selNextMod)
  );
}

/**
 * fetch and process game results used in showVotingResults phase
 * @param {object} game game document fetched from database
 * @return {Promise<object>} containing resArray and correctAnswerLetter
 */
exports.fetchAndProcessGameResults = async function (game) {
  // fetch data
  const data = await Session.findAnswersLettersCreatorsVotesByGame_id_selected(
    game._id
  )
    .lean()
    .exec();
  // init resMap
  const resMap = new Map();
  // assigne keyValue pairs to resMap
  for (ele of data) {
    if (!ele.letter) continue;
    resMap.set(ele.letter, {
      creator: ele.creator,
      letter: ele.letter,
      answer: ele.answer,
      voters: [],
    });
  }
  // init correctAnswerLetter
  let correctAnswerLetter;
  // count votes and find correctAnswerLetter
  for (ele of data) {
    if (
      !correctAnswerLetter &&
      ele._id === game.currModerator.sessionPlayerId
    ) {
      correctAnswerLetter = ele.letter;
    }
    if (!ele.vote) continue;
    resMap.get(ele.vote)?.voters.push(ele.creator);
  }
  // sort resArray by letter
  const resArray = [...resMap.values()].sort((a, b) => {
    return a.letter == b.letter ? 0 : a.letter > b.letter ? 1 : -1;
  });
  return {
    correctAnswerLetter: correctAnswerLetter,
    resArray: resArray,
  };
};

/**
 * for a specifig game assign points to players at round end
 * @param {object} game game document fetched from database
 * @return {Promise}
 */
async function assignPoints(game) {
  // fetch data
  const data = await Session.findAnswersLettersCreatorsVotesByGame_id_full(
    game._id
  ).exec();
  // init letterMap and docIdMap
  const letterMap = new Map();
  const docIdMap = new Map();
  // assigne keyValue pairs to letterMap and docIdMap
  for (doc of data) {
    docIdMap.set(doc._id, doc);
    if (!doc.session.answerLetter) continue;
    letterMap.set(doc.session.answerLetter, {
      creatorId: doc._id,
      countVotes: 0,
    });
  }
  // count votes
  for (voter of data) {
    const letterEntry = letterMap.get(voter.session.playerVote);
    // check if vote exists and creator isn't also voter
    if (!letterEntry || letterEntry.creatorId === voter._id) continue;
    // increase countVotes
    letterEntry.countVotes++;
    // check if voter gets points for correct answer
    if (letterEntry.creatorId === game.currModerator.sessionPlayerId) {
      // give voter 2 points for correct answer
      voter.session.roundPoints.correctAnswer = 2;
      voter.session.playerPoints += 2;
    }
    // else creator gets points for others vote
    else {
      const creator = docIdMap.get(letterEntry.creatorId);
      // give creator +3 points for others vote
      creator.session.roundPoints.othersWrongVote += 3;
      creator.session.playerPoints += 3;
    }
  }
  // update docs back to db
  for (doc of data) {
    await doc.save();
  }
}

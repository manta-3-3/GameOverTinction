// require game utilities
const gameUtil = require("../utilities/util_game");

// require promisify session functions
const sessionFuncts = require("../utilities/promisifySessionFuncts");

// display game quit form on GET
exports.get_quit = function (req, res, next) {
  res.render("quit_game", { title: "Quit Game" });
};

// handle game quit form on POST
exports.post_quit = async function (req, res, next) {
  // save gameId for later game update
  const toUpdateGameId = req.session?.game_id;
  try {
    // delete whole session
    await sessionFuncts.destroy(req);
    // update joined game if present
    if (toUpdateGameId) await gameUtil.updateGame(toUpdateGameId, true);
  } catch (err) {
    return next(err);
  }
  // redirect to join
  return res.redirect("/join");
};

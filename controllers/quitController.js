// require game utilities
const gameUtil = require("../utilities/util_game");

// display game quit form on GET
exports.get_quit = function (req, res, next) {
  res.render("quit_game", { title: "Quit Game" });
};

// handle game quit form on POST
exports.post_quit = function (req, res, next) {
  // save gameId for later game update
  const toUpdateGameId = req.session.game_id;
  // delete whole session
  req.session.destroy(async function (err) {
    if (err) return next(err);
    // update joined game if present
    if (toUpdateGameId) {
      try {
        await gameUtil.updateGame(toUpdateGameId, true);
      } catch (err) {
        return next(err);
      }
    }
    // redirect to join
    return res.redirect("/join");
  });
};

// display game quit form on GET
exports.get_quit = function (req, res, next) {
  res.render("quit_game", { title: "Quit Game" });
};

// handle game quit form on POST
exports.post_quit = function (req, res, next) {
  req.session.destroy(function (err) {
    if (err) next(err);
    res.redirect("/join");
  });
};

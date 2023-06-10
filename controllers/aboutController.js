exports.get_about_index = function (req, res) {
  res.render("about_index", {
    title: "About",
  });
};

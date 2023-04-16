function getReadme(user, repo, target_data, target_error) {
  fetch(`https://api.github.com/repos/${user}/${repo}/readme`, {
    headers: { Accept: "application/vnd.github.html" },
  }) // Fetch the file from GitHub's api
    .then((response) => response.text())
    .then((data) => {
      document.querySelector(target_data).innerHTML = data;
    })
    .catch((error) => {
      document.querySelector(target_error).innerHTML =
        "Loading failed: " + error.message;
      console.log(error);
    });
}

getReadme("manta-3-3", "GameOverTinction", "#readme-area", "#loding-text");

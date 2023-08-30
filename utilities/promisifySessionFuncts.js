/**
 * promisifys the session.regenerate function
 * @param {*} req express request object
 * @return {Promise<Void>}
 */
exports.regenerate = function (req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
};

/**
 * promisifys the session.destroy function
 * @param {*} req express request object
 * @return {Promise<Void>}
 */
exports.destroy = function (req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
};

/**
 * promisifys the session.reload function
 * @param {*} req express request object
 * @return {Promise<Void>}
 */
exports.reload = function (req) {
  return new Promise((resolve, reject) => {
    req.session.reload((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
};

/**
 * promisifys the session.save function
 * @param {*} req express request object
 * @return {Promise<Void>}
 */
exports.save = function (req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
};

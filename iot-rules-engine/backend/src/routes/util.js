const mongoose = require('mongoose');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  return next();
}

module.exports = { wrap, validId };

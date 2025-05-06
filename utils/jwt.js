const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "gizliAnahtar";
const JWT_EXPIRE = "7d";

function tokenUret(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

function tokenDogrula(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  tokenUret,
  tokenDogrula,
};

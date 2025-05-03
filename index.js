const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send({ status: "Second-hand api is working 🚀" });
});

app.listen(PORT, (error) => {
  console.log(`Server is running at http://localhost:3000`);
});

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const urunRouter = require("./api/urun");
const favoriRouter = require("./api/favori");
const sohbetRouter = require("./api/sohbet");
const mesajRouter = require("./api/mesaj");
const satilanRouter = require("./api/satilan");
const bildirimRouter = require("./api/bildirim");



const kullaniciRouter = require("./api/kullanici"); // Değişken ismi düzeltildi

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rotalar
app.use("/uploads", express.static("uploads"));
app.use(cors());

app.use("/api/kullanici", kullaniciRouter);
app.use("/api/urun", urunRouter);
app.use("/api/favori", favoriRouter);
app.use("/api/sohbet", sohbetRouter);
app.use("/api/mesaj", mesajRouter);
app.use("/api/satilan", satilanRouter);
app.use("/api/bildirim", bildirimRouter);


app.get("/", (req, res) => {
  res.send({ status: "API çalışıyor 🚀" });
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});


// ❗ 404 hatası için JSON dönsün
app.use((req, res) => {
  res.status(404).json({
    basarili: false,
    mesaj: "İstek yapılan endpoint bulunamadı",
    hataKodu: 404
  });
});

// ❗ Hataları JSON formatında dönen genel handler
app.use((err, req, res, next) => {
  console.error("Sunucu Hatası:", err);
  res.status(err.statusCode || 500).json({
    basarili: false,
    mesaj: err.message || "Sunucu hatası",
    hataKodu: err.statusCode || 500,
  });
});


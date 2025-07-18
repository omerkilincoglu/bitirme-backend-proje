// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const multer = require("multer");
const MulterError = multer.MulterError; // ✅ MulterError sınıfını ayrı aldık

// Rotalar
const urunRouter = require("./api/urun");
const favoriRouter = require("./api/favori");
const sohbetRouter = require("./api/sohbet");
const mesajRouter = require("./api/mesaj");
const satilanRouter = require("./api/satilan");
const bildirimRouter = require("./api/bildirim");
const kullaniciRouter = require("./api/kullanici");
const talepRouter = require("./api/talep");

const app = express();
const PORT = process.env.PORT || 3000;

<<<<<<< HEAD
// app.use((req, res, next) => {
//   console.log("REQ");
//   next();
// });

=======
>>>>>>> d54e186260649610a2e96b8a785556be15f2a18d
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// Statik dosyalar
app.use("/uploads", express.static("uploads"));

// Rotalar
app.use("/api/kullanici", kullaniciRouter);
app.use("/api/urun", urunRouter);
app.use("/api/favori", favoriRouter);
app.use("/api/sohbet", sohbetRouter);
app.use("/api/mesaj", mesajRouter);
app.use("/api/satilan", satilanRouter);
app.use("/api/bildirim", bildirimRouter);
app.use("/api/talep", talepRouter);

// Ana endpoint
app.get("/", (req, res) => {
  res.send({ status: "API çalışıyor 🚀" });
});

// ❗ 404 Hatası
app.use((req, res) => {
  res.status(404).json({
    basarili: false,
    mesaj: "İstek yapılan endpoint bulunamadı",
    hataKodu: 404,
  });
});

// ✅ Gelişmiş Hata Yakalama
app.use((err, req, res, next) => {
  console.error("Sunucu Hatası:", err);

  // 🛑 Multer dosya boyutu sınırı hatası
  if (err instanceof MulterError) {
    return res.status(400).json({
      basarili: false,
      mesaj:
        err.code === "LIMIT_FILE_SIZE"
          ? "Fotoğraf 5MB'dan büyük olamaz."
          : `Yükleme hatası: ${err.message}`,
      hataKodu: 400,
    });
  }

  // 🛠️ Özel ApiError
  if (err.name === "ApiError") {
    return res.status(err.returnCode || 400).json({
      basarili: false,
      mesaj: err.message,
      hataKodu: err.returnCode || 400,
    });
  }

  // 📛 Diğer hatalar
  res.status(err.statusCode || 500).json({
    basarili: false,
    mesaj: err.message || "Sunucu hatası",
    hataKodu: err.statusCode || 500,
  });
});

// 🔥 Server başlat
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});

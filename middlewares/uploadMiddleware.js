// middleware/upload.js
const multer = require("multer");
const path = require("path");
const ApiError = require("../utils/ApiError");

// 🔒 Geçerli uzantılar
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = fileTypes.test(file.mimetype);

  if (extname && mimeType) {
    cb(null, true);
  } else {
    cb(new ApiError("Sadece .jpg ve .png dosyaları yüklenebilir", 400), false);
  }
};

// 📁 Kayıt yeri ve dosya adı
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// 📦 Multer yapılandırması (5MB sınır)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB
  },
});

module.exports = upload;

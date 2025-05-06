const multer = require("multer");
const path = require("path");
const ApiError = require("../utils/ApiError");

// Dosya türü kontrolü (sadece jpg ve png)
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = fileTypes.test(file.mimetype);

  if (extname && mimeType) {
    return cb(null, true);
  } else {
    cb(new ApiError("Sadece .jpg, .png dosyaları yüklenebilir", 400), false);
  }
};

// Multer ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// Yalnızca tek dosya kabul edilecek
module.exports = upload;

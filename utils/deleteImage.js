const fs = require("fs");
const path = require("path");

const deleteImage = (imageName) => {
  const imageFullPath = path.join(__dirname, "..", "uploads", imageName);

  try {
    if (fs.existsSync(imageFullPath)) {
      fs.unlinkSync(imageFullPath);
      // console.log(`🗑️ Resim silindi: ${imageName}`);
    } else {
      // console.warn(`⚠️ Silinecek resim bulunamadı: ${imageName}`);
    }
  } catch (err) {
    // console.error(`❌ Resim silinirken hata oluştu (${imageName}):`, err.message);
  }
};

module.exports = deleteImage;

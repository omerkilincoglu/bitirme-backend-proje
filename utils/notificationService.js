// utils/notificationService.js
const prisma = require("./prisma");

async function talepBildirimSil(talepId) {
  try {
    await prisma.bildirim.deleteMany({
      where: {
        tip: "TALEP_BILGI",
        referansId: talepId,
      },
    });
  } catch (err) {
    console.error("Bildirim silinemedi:", err.message);
  }
}

module.exports = { talepBildirimSil };

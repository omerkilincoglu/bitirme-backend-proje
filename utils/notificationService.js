// utils/notificationService.js
const prisma = require("./prisma");

const bildirimGonder = async (hedefId, mesaj) => {
  try {
    await prisma.bildirim.create({
      data: {
        hedefId,
        mesaj,
      },
    });
  } catch (err) {
    console.error("❗ Bildirim gönderilemedi:", err);
  }
};

module.exports = bildirimGonder;

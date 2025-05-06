const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// 🔔 Kullanıcının bildirimlerini getir
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const bildirimler = await prisma.bildirim.findMany({
      where: { hedefId: req.kullanici.id },
      orderBy: { zaman: "desc" },
    });

    res.json(bildirimler);
  } catch (err) {
    next(err);
  }
});

// ✅ Bildirimi okundu olarak işaretle
router.put("/:id/okundu", authMiddleware, async (req, res, next) => {
    try {
      const bildirimId = parseInt(req.params.id);
      const kullaniciId = req.kullanici.id;
  
      const bildirim = await prisma.bildirim.findUnique({
        where: { id: bildirimId }
      });
  
      if (!bildirim || bildirim.hedefId !== kullaniciId) {
        throw new ApiError("Bildirime erişim yok.", 403);
      }
  
      await prisma.bildirim.update({
        where: { id: bildirimId },
        data: { okundu: true }
      });
  
      res.status(200).json({ mesaj: "Bildirim okundu olarak işaretlendi ✅" });
    } catch (hata) {
      next(hata);
    }
  });
  
module.exports = router;

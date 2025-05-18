// bildirim.js - Bildirim sistemine ait API
const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const bildirimler = await prisma.bildirim.findMany({
      where: {
        hedefId: req.kullanici.id,
        mesaj: {
          contains: "talep", // Mesaj içinde "talep" geçenleri filtrele
          mode: "insensitive", // büyük/küçük harf duyarlılığı olmasın
        },
      },
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
      where: { id: bildirimId },
    });

    if (!bildirim || bildirim.hedefId !== kullaniciId) {
      throw new ApiError("Bildirime erişim yok.", 403);
    }

    await prisma.bildirim.update({
      where: { id: bildirimId },
      data: { okundu: true },
    });

    res.status(200).json({ mesaj: "Bildirim okundu olarak işaretlendi ✅" });
  } catch (err) {
    next(err);
  }
});

// ✅ Tüm bildirimleri okundu olarak işaretle
router.put("/tumunu-okundu", authMiddleware, async (req, res, next) => {
  try {
    const kullaniciId = req.kullanici.id;

    await prisma.bildirim.updateMany({
      where: {
        hedefId: kullaniciId,
        okundu: false,
      },
      data: { okundu: true },
    });

    res
      .status(200)
      .json({ mesaj: "Tüm bildirimler okundu olarak işaretlendi ✅" });
  } catch (err) {
    next(err);
  }
});

// ✅ Okunmamış bildirim sayısını getir
router.get("/sayac", authMiddleware, async (req, res, next) => {
  try {
    const kullaniciId = req.kullanici.id;

    const sayi = await prisma.bildirim.count({
      where: {
        hedefId: kullaniciId,
        okundu: false,
      },
    });

    res.status(200).json({ okunmamisSayisi: sayi });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

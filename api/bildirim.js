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
        tip: {
          in: ["TALEP_ONAY", "TALEP_RED", "TALEP_BILGI", "URUN_SATILDI"],
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

// ❌ Bildirim silme (tekil)
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const bildirimId = parseInt(req.params.id);
    const kullaniciId = req.kullanici.id;

    const bildirim = await prisma.bildirim.findUnique({
      where: { id: bildirimId },
    });

    if (!bildirim || bildirim.hedefId !== kullaniciId) {
      throw new ApiError("Bildirimi silme yetkiniz yok", 403);
    }

    await prisma.bildirim.delete({
      where: { id: bildirimId },
    });

    res.status(200).json({ mesaj: "Bildirim silindi ✅" });
  } catch (err) {
    next(err);
  }
});

// 🧹 Çoklu bildirim silme (body ile id dizisi alır)
router.post("/toplu-sil", authMiddleware, async (req, res, next) => {
  try {
    const { ids } = req.body;
    const kullaniciId = req.kullanici.id;

    console.log("Silme isteği:", ids); // 🔧 Doğrusu bu!

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError("Silinecek bildirim yok", 400);
    }

    await prisma.bildirim.deleteMany({
      where: {
        id: { in: ids },
        hedefId: kullaniciId, // güvenlik kontrolü!
      },
    });

    res.status(200).json({ mesaj: "Seçili bildirimler silindi ✅" });
  } catch (err) {
    console.log("Silme hatası:", err.message);
    next(err);
  }
});

module.exports = router;

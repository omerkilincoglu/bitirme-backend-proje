// satilan.js

const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// ✅ Talep ONAYLA (Satıcı tarafından onaylanır)
router.put("/onayla/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    if (isNaN(urunId)) throw new ApiError("Geçersiz ürün ID", 400);

    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Ürün bulunamadı", 404);

    if (urun.saticiId !== req.kullanici.id)
      throw new ApiError("Bu işlemi yapmaya yetkiniz yok", 403);

    if (urun.satildi) throw new ApiError("Ürün zaten satıldı", 400);

    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, durum: "BEKLIYOR" },
    });
    if (!talep) throw new ApiError("Bekleyen talep bulunamadı", 404);

    // Talep güncelle
    await prisma.satisTalebi.update({
      where: { id: talep.id },
      data: { durum: "ONAYLANDI" },
    });

    // 🔔 Alıcıya bildirim gönder
    await prisma.bildirim.create({
      data: {
        mesaj: `Satıcı talebini onayladı. Ürün artık senin!`,
        hedefId: talep.aliciId,
      },
    });

    // Satış kaydı oluştur
    await prisma.satilan.create({
      data: {
        urunId,
        aliciId: talep.aliciId,
      },
    });

    // Ürünü satıldı olarak işaretle
    await prisma.urun.update({
      where: { id: urunId },
      data: { satildi: true },
    });

    res.status(200).json({
      success: true,
      message: "Talep onaylandı, ürün satıldı",
    });
  } catch (error) {
    next(error);
  }
});

// ❌ Talep REDDET (Satıcı reddeder)
router.put("/reddet/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    if (isNaN(urunId)) throw new ApiError("Geçersiz ürün ID", 400);

    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Ürün bulunamadı", 404);

    if (urun.saticiId !== req.kullanici.id)
      throw new ApiError("Bu işlemi yapmaya yetkiniz yok", 403);

    if (urun.satildi)
      throw new ApiError("Ürün zaten satıldı, reddedilemez", 400);

    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, durum: "BEKLIYOR" },
    });
    if (!talep) throw new ApiError("Talep bulunamadı", 404);

    await prisma.satisTalebi.update({
      where: { id: talep.id },
      data: { durum: "REDDEDILDI" },
    });

    // 🔔 Alıcıya bildirim gönder
    await prisma.bildirim.create({
      data: {
        mesaj: `Satıcı talebini reddetti.`,
        hedefId: talep.aliciId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Talep reddedildi",
    });
  } catch (error) {
    next(error);
  }
});

// 🗑️ SATIŞ İPTALİ (Satıcı yanlışlıkla onay verdiyse geri alabilir)
router.put("/iptal/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const kullaniciId = req.kullanici.id;

    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Ürün bulunamadı.", 404);

    if (urun.saticiId !== kullaniciId)
      throw new ApiError("Bu işlem için yetkiniz yok.", 403);

    if (!urun.satildi) throw new ApiError("Bu ürün zaten satılmadı.", 400);

    await prisma.urun.update({
      where: { id: urunId },
      data: { satildi: false },
    });

    await prisma.satilan.delete({ where: { urunId } });

    res.status(200).json({
      success: true,
      message: "Satış iptal edildi, ürün tekrar satılabilir.",
    });
  } catch (hata) {
    next(hata);
  }
});

// 📦 ALDIKLARIM
router.get("/aldiklarim", authMiddleware, async (req, res, next) => {
  try {
    const aldiklarim = await prisma.satilan.findMany({
      where: { aliciId: req.kullanici.id },
      include: {
        urun: {
          include: {
            satici: { select: { kullaniciAdi: true } },
          },
        },
      },
      orderBy: { tarih: "desc" },
    });

    res.status(200).json({
      success: true,
      count: aldiklarim.length,
      data: aldiklarim,
    });
  } catch (error) {
    next(error);
  }
});

// 📦 SATTIKLARIM
router.get("/sattiklarim", authMiddleware, async (req, res, next) => {
  try {
    const sattiklarim = await prisma.satilan.findMany({
      where: { urun: { saticiId: req.kullanici.id } },
      include: {
        urun: true,
        alici: { select: { kullaniciAdi: true } },
      },
      orderBy: { tarih: "desc" },
    });

    res.status(200).json({
      success: true,
      count: sattiklarim.length,
      data: sattiklarim,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

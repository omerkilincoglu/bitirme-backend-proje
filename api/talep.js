// 📄 ./api/talep.js
const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// ✅ Satın alma talebi oluştur (Alıcı -> Satıcıya)
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { urunId, mesaj } = req.body;
    const aliciId = req.kullanici.id;

    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
    });

    if (!urun) throw new ApiError("Ürün bulunamadı", 404);
    if (urun.saticiId === aliciId)
      throw new ApiError("Kendi ürününü alamazsın", 400);
    if (urun.satildi) throw new ApiError("Ürün zaten satıldı", 400);

    const oncekiTalep = await prisma.satisTalebi.findFirst({
      where: {
        urunId,
        aliciId,
      },
    });

    if (oncekiTalep) {
      throw new ApiError("Zaten bu ürüne talep gönderdiniz", 400);
    }

    // Talep oluştur
    const yeniTalep = await prisma.satisTalebi.create({
      data: {
        urunId,
        aliciId,
        mesaj,
        durum: "BEKLIYOR",
      },
    });

    // 🔔 Satıcıya bildirim gönder
    await prisma.bildirim.create({
      data: {
        mesaj: `Yeni satın alma talebi aldınız. Ürün: ${urun.baslik}`,
        hedefId: urun.saticiId,
      },
    });

    res.status(201).json({
      success: true,
      mesaj: "Talep gönderildi",
      talep: yeniTalep,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 🟢 2. Ürüne Gelen Talepleri Listele (Satıcı görür)
 * Endpoint: GET /api/talep/:urunId
 */
router.get("/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    if (isNaN(urunId)) throw new ApiError("Geçersiz ürün ID", 400);

    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
    });

    if (!urun) throw new ApiError("Ürün bulunamadı", 404);
    if (urun.saticiId !== req.kullanici.id)
      throw new ApiError("Yetkisiz erişim", 403);

    const talepler = await prisma.satisTalebi.findMany({
      where: { urunId },
      include: {
        alici: {
          select: { id: true, kullaniciAdi: true },
        },
      },
      orderBy: { tarih: "desc" },
    });

    res.status(200).json({
      success: true,
      count: talepler.length,
      data: talepler,
    });
  } catch (err) {
    next(err);
  }
});

// ✅ Kullanıcıya ait ürün talebinin durumu
router.get("/durum/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const aliciId = req.kullanici.id;

    const talep = await prisma.satisTalebi.findFirst({
      where: {
        urunId,
        aliciId,
      },
      select: {
        durum: true,
      },
    });

    if (!talep) {
      return res.status(200).json({ durum: "YOK" });
    }

    res.status(200).json({ durum: talep.durum });
  } catch (err) {
    next(err);
  }
});

// ❌ Satın alma talebini iptal et (Alıcı tarafından)
router.delete("/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const aliciId = req.kullanici.id;

    const talep = await prisma.satisTalebi.findFirst({
      where: {
        urunId,
        aliciId,
        durum: "BEKLIYOR", // sadece bekleyen talep iptal edilebilir
      },
    });

    if (!talep) {
      throw new ApiError("İptal edilecek talep bulunamadı", 404);
    }

    await prisma.satisTalebi.delete({
      where: { id: talep.id },
    });

    res.status(200).json({
      success: true,
      message: "Satın alma talebiniz iptal edildi.",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

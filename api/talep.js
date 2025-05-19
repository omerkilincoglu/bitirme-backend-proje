//talep.js

const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// ✅ 1. Talep oluştur (alıcıdan)
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { urunId, mesaj } = req.body;
    const aliciId = req.kullanici.id;

    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Ürün bulunamadı", 404);
    if (urun.saticiId === aliciId)
      throw new ApiError("Kendi ürününü alamazsın", 400);
    if (urun.satildi) throw new ApiError("Ürün zaten satıldı", 400);

    const oncekiTalep = await prisma.satisTalebi.findFirst({
      where: {
        urunId,
        aliciId,
        durum: { in: ["BEKLIYOR", "ONAYLANDI"] },
      },
    });

    if (oncekiTalep) throw new ApiError("Zaten talep gönderdiniz", 400);

    const yeniTalep = await prisma.satisTalebi.create({
      data: {
        urunId,
        aliciId,
        mesaj,
        durum: "BEKLIYOR",
      },
    });

    await prisma.bildirim.create({
      data: {
        mesaj: `Yeni satın alma talebi aldınız. Ürün: ${urun.baslik}`,
        hedefId: urun.saticiId,
        tip: "TALEP_BILGI",
      },
    });

    res
      .status(201)
      .json({ success: true, mesaj: "Talep gönderildi", talep: yeniTalep });
  } catch (err) {
    next(err);
  }
});

// ✅ 2. Ürüne gelen talepleri listele (satıcıya)
router.get("/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    if (isNaN(urunId)) throw new ApiError("Geçersiz ürün ID", 400);

    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Ürün bulunamadı", 404);
    if (urun.saticiId !== req.kullanici.id)
      throw new ApiError("Yetkisiz erişim", 403);

    const talepler = await prisma.satisTalebi.findMany({
      where: { urunId },
      include: {
        alici: { select: { id: true, kullaniciAdi: true } },
      },
      orderBy: { tarih: "desc" },
    });

    res
      .status(200)
      .json({ success: true, count: talepler.length, data: talepler });
  } catch (err) {
    next(err);
  }
});

// ✅ 3. Talep durumunu getir (alıcıya)
router.get("/durum/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const aliciId = req.kullanici.id;

    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, aliciId },
      select: { durum: true },
    });

    res.status(200).json({ durum: talep ? talep.durum : "YOK" });
  } catch (err) {
    next(err);
  }
});

// ❌ 4. Talep iptal (alıcıdan)
router.delete("/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const aliciId = req.kullanici.id;

    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, aliciId, durum: "BEKLIYOR" },
    });
    if (!talep) throw new ApiError("İptal edilecek talep bulunamadı", 404);

    await prisma.satisTalebi.delete({ where: { id: talep.id } });

    res.status(200).json({ success: true, message: "Talep iptal edildi" });
  } catch (err) {
    next(err);
  }
});

// ✅ 5. Talep onayla (satıcıdan)
router.put("/onayla/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const kullaniciId = req.kullanici.id;

    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, durum: "BEKLIYOR" },
      include: { urun: true }, // Ürün bilgisi dahil!
    });

    if (!talep) throw new ApiError("Talep bulunamadı", 404);
    if (talep.urun.saticiId !== kullaniciId)
      throw new ApiError("Yetkiniz yok", 403);
    if (talep.urun.satildi) throw new ApiError("Ürün zaten satıldı", 400);

    // 1. Talebi onayla
    await prisma.satisTalebi.update({
      where: { id: talep.id },
      data: { durum: "ONAYLANDI" },
    });

    // 2. Diğer talepleri reddet
    await prisma.satisTalebi.updateMany({
      where: {
        urunId,
        durum: "BEKLIYOR",
        id: { not: talep.id },
      },
      data: { durum: "REDDEDILDI" },
    });

    // 3. Ürünü satıldı olarak işaretle
    await prisma.urun.update({
      where: { id: urunId },
      data: { satildi: true },
    });

    // 4. Satış kaydını oluştur
    await prisma.satilan.create({
      data: {
        urunId,
        aliciId: talep.aliciId,
      },
    });

    // 5. Bildirim gönder
    await prisma.bildirim.create({
      data: {
        mesaj: `Satıcı talebini onayladı. Ürün artık senin! Ürün: ${talep.urun.baslik}`,
        hedefId: talep.aliciId,
        tip: "TALEP_ONAY",
      },
    });

    res.status(200).json({ success: true, message: "Talep onaylandı" });
  } catch (err) {
    next(err);
  }
});

// ❌ 6. Talep reddet (satıcıdan)
router.put("/reddet/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const kullaniciId = req.kullanici.id;

    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, durum: "BEKLIYOR" },
      include: { urun: true }, // Ürün bilgisi dahil!
    });

    if (!talep) throw new ApiError("Talep bulunamadı", 404);
    if (talep.urun.saticiId !== kullaniciId)
      throw new ApiError("Yetkiniz yok", 403);
    if (talep.urun.satildi)
      throw new ApiError("Satılmış ürün reddedilemez", 400);

    // 1. Talebi reddet
    await prisma.satisTalebi.update({
      where: { id: talep.id },
      data: { durum: "REDDEDILDI" },
    });

    // 2. Bildirim gönder
    await prisma.bildirim.create({
      data: {
        mesaj: `Satıcı talebini reddetti. Ürün: ${talep.urun.baslik}`,
        hedefId: talep.aliciId,
        tip: "TALEP_RED",
      },
    });

    res.status(200).json({ success: true, message: "Talep reddedildi" });
  } catch (err) {
    next(err);
  }
});

// 🗑️ 7. Satışı iptal et (satıcıdan)
router.put("/iptal/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId);
    const kullaniciId = req.kullanici.id;

    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Ürün bulunamadı", 404);
    if (urun.saticiId !== kullaniciId) throw new ApiError("Yetkiniz yok", 403);
    if (!urun.satildi) throw new ApiError("Zaten satılmamış", 400);

    // 1. Ürünü tekrar satışa aç
    await prisma.urun.update({
      where: { id: urunId },
      data: { satildi: false },
    });

    // 2. Satış kaydını sil
    await prisma.satilan.delete({ where: { urunId } });

    // 3. Eski talepleri temizle (önemli!)
    await prisma.satisTalebi.deleteMany({
      where: { urunId },
    });

    // 4. Bildirim gönder (ürün adı dahil!)
    await prisma.bildirim.create({
      data: {
        mesaj: `Satış işlemi iptal edildi. Ürün tekrar satışta.\n\nÜrün: ${urun.baslik}`,
        hedefId: kullaniciId,
        tip: "URUN_SATILDI",
      },
    });

    res.status(200).json({ success: true, message: "Satış iptal edildi" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

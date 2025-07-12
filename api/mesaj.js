// ✅ mesaj.js
const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// ✉️ Yeni sohbet başlat ve ilk mesajı gönder (urunId ile)
router.post("/gonder", authMiddleware, async (req, res, next) => {
  try {
    const { urunId, mesaj } = req.body;
    const gondericiId = req.kullanici.id;

    if (!urunId || !mesaj?.trim()) {
      throw new ApiError("Ürün ID ve mesaj zorunludur.", 422);
    }

    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
      include: { satici: true },
    });

    if (!urun) throw new ApiError("Ürün bulunamadı.", 404);

    let sohbet = await prisma.sohbet.findFirst({
      where: {
        OR: [
          { aliciId: gondericiId, saticiId: urun.saticiId },
          { aliciId: urun.saticiId, saticiId: gondericiId },
        ],
      },
    });

    if (!sohbet && urun.saticiId === gondericiId) {
      throw new ApiError("Kendi ürününüze mesaj atamazsınız.", 403);
    }

    if (!sohbet) {
      sohbet = await prisma.sohbet.create({
        data: {
          urunId,
          aliciId: gondericiId,
          saticiId: urun.saticiId,
        },
      });
      console.log("Sohbet oluşturuldu:", sohbet);
    }

    const yeniMesaj = await prisma.mesaj.create({
      data: {
        sohbetId: sohbet.id,
        mesaj,
        gondericiId,
        okundu: false,
        urunId: urun.id,
      },
      include: {
        urun: true,
      },
    });

    const gonderen = await prisma.kullanici.findUnique({
      where: { id: gondericiId },
    });

    await prisma.bildirim.create({
      data: {
        mesaj: `${gonderen.kullaniciAdi} size bir mesaj gönderdi.`,
        hedefId:
          sohbet.saticiId === gondericiId ? sohbet.aliciId : sohbet.saticiId,
      },
    });

    res.status(201).json({
      mesaj: "Mesaj gönderildi ✅",
      veri: yeniMesaj,
      sohbetId: sohbet.id,
    });
  } catch (hata) {
    next(hata);
  }
});


// 📨 Sohbete ait tüm mesajları getir
router.get("/:sohbetId", authMiddleware, async (req, res, next) => {
  try {
    const sohbetId = Number(req.params.sohbetId);
    const kullaniciId = req.kullanici.id;

    if (!sohbetId || isNaN(sohbetId)) {
      return res.status(400).json({ mesaj: "Geçersiz sohbet ID." });
    }

    const sohbet = await prisma.sohbet.findFirst({
      where: {
        id: sohbetId,
        OR: [{ aliciId: kullaniciId }, { saticiId: kullaniciId }],
      },
    });

    if (!sohbet) {
      return res.status(403).json({ mesaj: "Bu sohbete erişiminiz yok." });
    }

    const mesajlar = await prisma.mesaj.findMany({
      where: { sohbetId },
      orderBy: { zaman: "asc" },
      include: {
        urun: {
          select: {
            id: true,
            baslik: true,
            fiyat: true,
            resim: true,
          },
        },
      },
    });

    res.status(200).json({ mesajlar });
  } catch (err) {
    next(err);
  }
});

// ✅ Mesajları okundu olarak işaretle
router.put("/okundu/:sohbetId", authMiddleware, async (req, res, next) => {
  try {
    const sohbetId = Number(req.params.sohbetId);
    const kullaniciId = req.kullanici.id;

    if (!sohbetId || isNaN(sohbetId)) {
      return res.status(400).json({ mesaj: "Geçersiz sohbet ID." });
    }

    await prisma.mesaj.updateMany({
      where: {
        sohbetId,
        gondericiId: { not: kullaniciId },
        okundu: false,
      },
      data: { okundu: true },
    });

    res.status(200).json({ mesaj: "Mesajlar okundu olarak işaretlendi" });
  } catch (err) {
    next(err);
  }
});

// ✅ Var olan bir sohbete mesaj gönder (sohbetId ile)
router.post("/sohbet/:sohbetId", authMiddleware, async (req, res, next) => {
  try {
    const sohbetId = Number(req.params.sohbetId);
    const gondericiId = req.kullanici.id;
    const { mesaj, urunId } = req.body; // ✅ URUN ID BURADA ALINIYOR

    if (!sohbetId || isNaN(sohbetId)) {
      return res.status(400).json({ mesaj: "Geçersiz sohbet ID." });
    }

    if (!urunId) {
      return res.status(400).json({ mesaj: "Ürün ID eksik." }); // opsiyonel ama hata kontrolü için
    }

    const sohbet = await prisma.sohbet.findFirst({
      where: {
        id: sohbetId,
        OR: [{ aliciId: gondericiId }, { saticiId: gondericiId }],
      },
    });

    if (!sohbet) {
      return res.status(403).json({ mesaj: "Bu sohbete erişiminiz yok." });
    }

    const yeniMesaj = await prisma.mesaj.create({
      data: {
        sohbetId,
        mesaj,
        gondericiId,
        okundu: false,
        urunId, // ✅ gelen ürünId doğrudan burada kullanılıyor
      },
      include: {
        urun: {
          select: {
            id: true,
            baslik: true,
            fiyat: true,
            resim: true,
          },
        },
      },
    });

    res.status(201).json({ mesaj: "Mesaj gönderildi ✅", veri: yeniMesaj });
  } catch (err) {
    console.error("💥 Mesaj gönderme hatası:", err); // ❗ Hata log'u önemli
    next(err);
  }
});

module.exports = router;

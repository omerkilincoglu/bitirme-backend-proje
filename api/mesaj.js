const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// ✉️ Mesaj gönder
router.post("/gonder", authMiddleware, async (req, res, next) => {
  try {
    const { urunId, mesaj } = req.body;
    const gondericiId = req.kullanici.id;

    if (!urunId || !mesaj?.trim()) {
      throw new ApiError("Ürün ID ve mesaj zorunludur.", 422);
    }

    // Ürünü getir
    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
      include: { satici: true },
    });

    if (!urun) throw new ApiError("Ürün bulunamadı.", 404);
    if (urun.saticiId === gondericiId) {
      throw new ApiError("Kendi ürününüze mesaj atamazsınız.", 403);
    }

    // Var olan sohbeti kontrol et
    let sohbet = await prisma.sohbet.findFirst({
      where: {
        urunId,
        OR: [
          { aliciId: gondericiId, saticiId: urun.saticiId },
          { aliciId: urun.saticiId, saticiId: gondericiId },
        ],
      },
    });

    // Yoksa yeni sohbet oluştur
    if (!sohbet) {
      sohbet = await prisma.sohbet.create({
        data: {
          urunId,
          aliciId: gondericiId,
          saticiId: urun.saticiId,
        },
      });
    }

    // Mesajı oluştur
    const yeniMesaj = await prisma.mesaj.create({
      data: {
        sohbetId: sohbet.id,
        mesaj,
        gondericiId,
      },
    });

    // ✅ Bildirim gönder
    const gonderen = await prisma.kullanici.findUnique({
      where: { id: gondericiId },
    });

    await prisma.bildirim.create({
      data: {
        mesaj: `${gonderen.kullaniciAdi} size bir mesaj gönderdi.`,
        hedefId: sohbet.saticiId === gondericiId ? sohbet.aliciId : sohbet.saticiId,
      },
    });

    res.status(201).json({ mesaj: "Mesaj gönderildi ✅", veri: yeniMesaj });
  } catch (hata) {
    next(hata);
  }
});

// 📨 Mesajları listele (belirli bir sohbet için)
router.get("/:sohbetId", authMiddleware, async (req, res, next) => {
  try {
    const sohbetId = parseInt(req.params.sohbetId);
    const kullaniciId = req.kullanici.id;

    const sohbet = await prisma.sohbet.findFirst({
      where: {
        id: sohbetId,
        OR: [{ aliciId: kullaniciId }, { saticiId: kullaniciId }],
      },
    });

    if (!sohbet) throw new ApiError("Bu sohbete erişiminiz yok.", 403);

    const mesajlar = await prisma.mesaj.findMany({
      where: { sohbetId },
      orderBy: { zaman: "asc" },
    });

    res.status(200).json({ mesajlar });
  } catch (hata) {
    next(hata);
  }
});

module.exports = router;

const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// 💬 Kullanıcının tüm sohbetlerini getir (okunmamış sayılı + son mesaja göre sıralı)
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const kullaniciId = req.kullanici.id;

    // Sohbetleri çek: son mesajı da içinde getirecek şekilde
    const sohbetler = await prisma.sohbet.findMany({
      where: {
        OR: [{ aliciId: kullaniciId }, { saticiId: kullaniciId }],
      },
      include: {
        urun: true,
        alici: { select: { id: true, kullaniciAdi: true } },
        satici: { select: { id: true, kullaniciAdi: true } },
        mesajlar: {
          orderBy: { zaman: "desc" },
          take: 1, // sadece en son mesajı al
        },
      },
    });

    // Her sohbet için okunmamış mesaj sayısını hesapla + veriyi düzenle
    const enriched = await Promise.all(
      sohbetler.map(async (s) => {
        const karsiTaraf = s.aliciId === kullaniciId ? s.satici : s.alici;

        const okunmamis = await prisma.mesaj.count({
          where: {
            sohbetId: s.id,
            okundu: false,
            gondericiId: { not: kullaniciId }, // kendi attığın değilse
          },
        });

        return {
          id: s.id,
          urun: s.urun,
          karsiTaraf,
          sonMesaj: s.mesajlar[0] || null,
          okunmamis,
        };
      })
    );

    // Son mesaja göre en güncel sohbetleri en üste al
    enriched.sort((a, b) => {
      const t1 = a.sonMesaj?.zaman || 0;
      const t2 = b.sonMesaj?.zaman || 0;
      return new Date(t2) - new Date(t1);
    });

    res.status(200).json({ sohbetler: enriched });
  } catch (hata) {
    next(hata);
  }
});

// 🗑️ Sohbet silme işlemi (mesajlarıyla birlikte)
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const sohbetId = parseInt(req.params.id);
    const kullaniciId = req.kullanici.id;

    const sohbet = await prisma.sohbet.findUnique({
      where: { id: sohbetId },
    });

    if (!sohbet) throw new ApiError("Sohbet bulunamadı.", 404);

    if (sohbet.aliciId !== kullaniciId && sohbet.saticiId !== kullaniciId) {
      throw new ApiError("Bu sohbeti silme yetkiniz yok.", 403);
    }

    // Önce mesajları sil
    await prisma.mesaj.deleteMany({
      where: { sohbetId },
    });

    // Ardından sohbeti sil
    await prisma.sohbet.delete({
      where: { id: sohbetId },
    });

    res.status(200).json({ mesaj: "Sohbet silindi ✅" });
  } catch (hata) {
    next(hata);
  }
});

module.exports = router;

const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// 💬 Sohbet başlat (alıcı giriş yapmış olacak)
router.post("/baslat", authMiddleware, async (req, res, next) => {
  try {
    const { urunId } = req.body;
    const aliciId = req.kullanici.id;

    if (!urunId) throw new ApiError("Ürün ID gerekli.", 422);

    // Ürün var mı?
    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
      include: { satici: true }
    });
    if (!urun) throw new ApiError("Ürün bulunamadı.", 404);
    if (urun.saticiId === aliciId) {
      throw new ApiError("Kendi ürününüzle sohbet başlatamazsınız.", 400);
    }

    // Daha önce aynı kişi aynı ürün için sohbet başlatmış mı?
    const mevcutSohbet = await prisma.sohbet.findFirst({
      where: {
        urunId,
        aliciId,
        saticiId: urun.saticiId
      }
    });

    if (mevcutSohbet) {
      return res.status(200).json({
        mesaj: "Zaten sohbet mevcut.",
        sohbet: mevcutSohbet
      });
    }

    // Yeni sohbet oluştur
    const yeniSohbet = await prisma.sohbet.create({
      data: {
        urunId,
        aliciId,
        saticiId: urun.saticiId
      }
    });

    res.status(201).json({
      mesaj: "Sohbet oluşturuldu ✅",
      sohbet: yeniSohbet
    });

  } catch (hata) {
    next(hata);
  }
});


// 💬 Kullanıcının tüm sohbetlerini getir
router.get("/", authMiddleware, async (req, res, next) => {
    try {
      const kullaniciId = req.kullanici.id;
  
      const sohbetler = await prisma.sohbet.findMany({
        where: {
          OR: [
            { aliciId: kullaniciId },
            { saticiId: kullaniciId }
          ]
        },
        include: {
          urun: true,
          alici: {
            select: { id: true, kullaniciAdi: true }
          },
          satici: {
            select: { id: true, kullaniciAdi: true }
          },
          mesajlar: {
            orderBy: { zaman: "desc" },
            take: 1
          }
        },
        orderBy: {
          id: "desc"
        }
      });
  
      // Cevapları sadeleştir (ön uç için uygun formatta)
      const cevap = sohbetler.map((s) => {
        const karsiTaraf =
          s.aliciId === kullaniciId ? s.satici : s.alici;
  
        return {
          id: s.id,
          urun: s.urun,
          karsiTaraf: karsiTaraf,
          sonMesaj: s.mesajlar[0] || null
        };
      });
  
      res.status(200).json({ sohbetler: cevap });
    } catch (hata) {
      next(hata);
    }
  });

  // 🗑️ Sohbet silme
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

    // Mesajları sil
    await prisma.mesaj.deleteMany({
      where: { sohbetId },
    });

    // Sohbeti sil
    await prisma.sohbet.delete({
      where: { id: sohbetId },
    });

    res.status(200).json({ mesaj: "Sohbet silindi ✅" });
  } catch (hata) {
    next(hata);
  }
});

  
module.exports = router;

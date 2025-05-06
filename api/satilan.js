const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// 📩 Talep Gönderme
router.post("/talep", authMiddleware, async (req, res, next) => {
  try {
    const { urunId, mesaj } = req.body;
    const aliciId = req.kullanici.id;

    // Gerekli verilerin olup olmadığını kontrol et
    if (!urunId || !mesaj) {
      throw new ApiError("Ürün ID ve mesaj gereklidir", 400);
    }

    // Ürün var mı kontrol et
    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
    });
    if (!urun) {
      throw new ApiError("Ürün bulunamadı", 404);
    }

    // Satıcı, kendi ürününe talep gönderemez
    if (urun.saticiId === aliciId) {
      throw new ApiError("Kendi ürününüze talep gönderemezsiniz", 400);
    }

    // Ürün zaten satılmışsa talep gönderilemez
    if (urun.satildi) {
      throw new ApiError("Bu ürün zaten satılmış", 400);
    }

    // Aynı alıcı, aynı ürüne daha önce talep göndermiş mi kontrol et
    const oncekiTalep = await prisma.satisTalebi.findFirst({
      where: { urunId, aliciId },
    });

    if (oncekiTalep) {
      throw new ApiError("Zaten bu ürüne talep gönderdiniz", 409);
    }

    // Satın alma talebini kaydet
    const talep = await prisma.satisTalebi.create({
      data: {
        urunId,
        aliciId,
        mesaj,
      },
    });

    // Başarılı bir yanıt döndür
    res.status(201).json({
      success: true,
      message: "Talep gönderildi. Satıcı onay bekliyor.",
      data: talep,
    });
  } catch (error) {
    next(error); // Hata varsa middleware'e gönder
  }
});

// ✅ Talep Onaylama
router.put("/onayla/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId); // Ürün ID'sini parametre olarak alıyoruz

    // Geçerli bir ürün ID'si olup olmadığını kontrol et
    if (isNaN(urunId)) {
      throw new ApiError("Geçersiz ürün ID", 400); // Hatalı ID kontrolü
    }

    // Ürün var mı kontrolü
    const urun = await prisma.urun.findUnique({
      where: { id: urunId }, // Ürünü ID ile arıyoruz
    });

    if (!urun) {
      throw new ApiError("Ürün bulunamadı", 404); // Ürün bulunmazsa hata mesajı
    }

    // Satıcı kontrolü (satıcı sadece kendi ürününü onaylayabilir)
    if (urun.saticiId !== req.kullanici.id) {
      throw new ApiError("Bu işlem için yetkiniz yok", 403); // Yetki kontrolü
    }

    // Ürün zaten satılmışsa, talep onaylanamaz
    if (urun.satildi) {
      throw new ApiError("Ürün zaten satıldı", 400); // Ürün satılmışsa hata
    }

    // Ürünün talep durumu "BEKLIYOR" olan taleplerini kontrol et
    const talep = await prisma.satisTalebi.findFirst({
      where: { urunId, durum: "BEKLIYOR" }, // Talep durumu "BEKLIYOR" olan talebi buluyoruz
    });

    if (!talep) {
      throw new ApiError("Bu ürün için bekleyen talep bulunamadı", 404); // Bekleyen talep yoksa hata
    }

    // Talep onaylandığında, talep durumunu "ONAYLANDI" olarak güncelle
    await prisma.satisTalebi.update({
      where: { id: talep.id },
      data: { durum: "ONAYLANDI" }, // Talep durumu güncelleniyor
    });

    // Satışı onayla ve ürünü satıldı olarak işaretle
    await prisma.satilan.create({
      data: {
        urunId, // Satılan ürünün ID'si
        aliciId: talep.aliciId, // Alıcı ID'sini talep üzerinden alıyoruz
      },
    });

    // Ürünü satılmaya onayla
    await prisma.urun.update({
      where: { id: urunId },
      data: { satildi: true }, // Satış onaylandığı için `satildi` true yapılacak
    });

    res.status(200).json({
      success: true,
      message: "Talep onaylandı, ürün satıldı",
    });
  } catch (error) {
    next(error); // Hata varsa middleware'e gönder
  }
});

// ❌ Talep Reddetme
router.put("/reddet/:urunId", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.urunId); // Ürün ID'sini URL'den alıyoruz

    // Geçerli bir ürün ID'si olup olmadığını kontrol et
    if (isNaN(urunId)) {
      throw new ApiError("Geçersiz ürün ID", 400); // Hatalı ID kontrolü
    }

    // Ürün var mı kontrolü
    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
    });

    if (!urun) {
      throw new ApiError("Ürün bulunamadı", 404); // Ürün bulunamazsa hata mesajı
    }

    // Satıcı kontrolü (satıcı sadece kendi ürününü reddedebilir)
    if (urun.saticiId !== req.kullanici.id) {
      throw new ApiError("Bu işlem için yetkiniz yok", 403); // Yetki kontrolü
    }

    // Ürün zaten satılmışsa, talep reddedilemez
    if (urun.satildi) {
      throw new ApiError("Bu ürün zaten satılmış, reddedilemez", 400); // Satılmış ürün reddedilemez
    }

    // Talebi reddetmeden önce, talep durumu "BEKLIYOR" olan talebi bulalım
    const talep = await prisma.satisTalebi.findFirst({
      where: {
        urunId,
        durum: "BEKLIYOR", // "BEKLIYOR" olan talepleri alıyoruz
      },
    });

    if (!talep) {
      throw new ApiError("Bu ürün için bekleyen talep bulunamadı", 404); // Bekleyen talep yoksa hata
    }

    // Talep reddedildiğinde, talep durumunu "REDDEDILDI" olarak güncelle
    await prisma.satisTalebi.update({
      where: { id: talep.id },
      data: { durum: "REDDEDILDI" }, // Talep durumu güncelleniyor
    });

    res.status(200).json({
      success: true,
      message: "Talep reddedildi",
    });
  } catch (error) {
    next(error); // Hata varsa middleware'e gönder
  }
});

/// 📦 Aldığım Ürünler
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
    next(error); // Hata varsa middleware'e gönder
  }
});

// 📦 Sattığım Ürünler
router.get("/sattiklarim", authMiddleware, async (req, res, next) => {
  try {
    const sattiklarim = await prisma.satilan.findMany({
      where: {
        urun: {
          saticiId: req.kullanici.id,
        },
      },
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
    next(error); // Hata varsa middleware'e gönder
  }
});

// 📬 Bekleyen Talepler
router.get("/taleplerim", authMiddleware, async (req, res, next) => {
  try {
    const talepler = await prisma.satisTalebi.findMany({
      where: {
        durum: "BEKLIYOR", // Bekleyen talepler
        urun: { saticiId: req.kullanici.id }, // Satıcının ürünleri
      },
      include: {
        urun: {
          select: { id: true, baslik: true, fiyat: true, satildi: true },
        }, // Ürün bilgileri
        alici: { select: { id: true, kullaniciAdi: true } }, // Alıcı bilgileri
      },
      orderBy: { tarih: "desc" }, // Talepleri tarih sırasına göre sıralıyoruz
    });

    res.status(200).json({
      success: true,
      count: talepler.length,
      data: talepler,
    });
  } catch (error) {
    next(error); // Hata varsa middleware'e gönder
  }
});

module.exports = router;

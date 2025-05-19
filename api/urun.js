// Güncellenmiş ürün işlemleri – profesyonel, JSON hata odaklı
const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const fs = require("fs");
const path = require("path");
const ApiError = require("../utils/ApiError");
const deleteImage = require("../utils/deleteImage");

const router = express.Router();

// Tüm yanıtlar JSON olsun
router.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// 📦 Ürün ekleme
router.post(
  "/ekle",
  upload.single("resim"),
  authMiddleware,
  async (req, res, next) => {
    console.log("resim yüklendi:", req.file);
    try {
      const { baslik, aciklama, fiyat, kategori, durum, konum, detayliKonum } =
        req.body;

      // ✅ Zorunlu alan kontrolü
      if (
        !baslik ||
        !aciklama ||
        !fiyat ||
        !kategori ||
        !durum ||
        !konum ||
        !detayliKonum
      ) {
        if (req.file) deleteImage(req.file.filename);
        throw new ApiError("Tüm alanlar zorunludur.", 400);
      }

      // ✅ Durum geçerliliği
      const gecerliDurumlar = ["azkullanılmış", "yeni"];
      if (!gecerliDurumlar.includes(durum.toLowerCase())) {
        if (req.file) deleteImage(req.file.filename);
        throw new ApiError(
          "Durum sadece 'azkullanılmış' veya 'yeni' olabilir.",
          422
        );
      }

      // ✅ Fiyat doğrulama
      const fiyatStr = fiyat.replace(",", ".");
      const fiyatFloat = parseFloat(fiyatStr);
      if (isNaN(fiyatFloat) || !/^\d+(\.\d{1,2})?$/.test(fiyatStr)) {
        if (req.file) deleteImage(req.file.filename);
        throw new ApiError("Fiyat geçerli değil. Örnek: 199.99", 422);
      }

      // ✅ Konum doğrulama ve parse
      let konumParsed;
      try {
        konumParsed = JSON.parse(konum);
        if (!konumParsed.il || !konumParsed.ilce || !konumParsed.ulke)
          throw new Error();
      } catch {
        if (req.file) deleteImage(req.file.filename);
        throw new ApiError(
          'Geçersiz konum. Örnek: {"il": "İstanbul", "ilce": "Kadıköy", "ulke": "Türkiye"}',
          422
        );
      }

      // ✅ Tam adres oluştur
      const tamAdres = `${konumParsed.ulke} / ${konumParsed.il} / ${konumParsed.ilce} - ${detayliKonum}`;

      // ✅ Ürünü kaydet
      const yeniUrun = await prisma.urun.create({
        data: {
          baslik,
          aciklama,
          fiyat: fiyatFloat,
          kategori,
          durum,
          konum: konumParsed,
          resim: req.file.filename,
          saticiId: req.kullanici.id,
          satildi: false,
          zaman: new Date(),
          tamAdres,
        },
      });

      // ✅ Başarılı yanıt
      res.status(201).json({
        basarili: true,
        mesaj: "Ürün başarıyla eklendi ✅",
        urun: yeniUrun,
      });
    } catch (err) {
      if (req.file) {
        deleteImage(req.file.filename); // hata varsa resmi sil
      }
      next(err);
    }
  }
);

// 📄 Ürün listeleme (arama + filtre desteği)
router.get("/", async (req, res, next) => {
  try {
    const { arama, kategori, durum, minFiyat, maxFiyat } = req.query;

    const filtre = {
      satildi: false,
      silindi: false,
    };

    // Dinamik filtreleme
    if (arama) {
      const query = arama.toLowerCase();
      filtre.OR = [
        { baslik: { contains: query, mode: "insensitive" } },
        { aciklama: { contains: query, mode: "insensitive" } },
        { kategori: { contains: query, mode: "insensitive" } },
        { durum: { contains: query, mode: "insensitive" } },
        { fiyat: { equals: isNaN(query) ? undefined : parseFloat(query) } },
        {
          satici: {
            kullaniciAdi: { contains: query, mode: "insensitive" },
          },
        },
      ];
    }

    if (kategori) filtre.kategori = kategori;
    if (durum) filtre.durum = durum;

    if (minFiyat || maxFiyat) {
      filtre.fiyat = {};
      if (minFiyat) filtre.fiyat.gte = parseFloat(minFiyat);
      if (maxFiyat) filtre.fiyat.lte = parseFloat(maxFiyat);
    }

    const urunler = await prisma.urun.findMany({
      where: filtre,
      include: {
        satici: {
          select: {
            id: true,
            kullaniciAdi: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    res.status(200).json({
      basarili: true,
      toplam: urunler.length,
      urunler,
    });
  } catch (err) {
    next(err);
  }
});

// Global hata yakalayıcı
router.use((err, req, res, next) => {
  console.error("Hata:", err);
  res.setHeader("Content-Type", "application/json");
  res.status(err.statusCode || 500).json({
    basarili: false,
    mesaj: err.message || "Sunucu hatası",
    hataKodu: err.statusCode || 500,
  });
});

// 📄 Satışta Olan Ürünler (Sadece giriş yapan satıcının satılmamış ürünleri)
router.get("/satistaki", authMiddleware, async (req, res, next) => {
  try {
    const urunler = await prisma.urun.findMany({
      where: {
        saticiId: req.kullanici.id,
        satildi: false,
        silindi: false,
      },
      include: {
        satici: {
          select: { id: true, kullaniciAdi: true },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    res.status(200).json({
      basarili: true,
      toplam: urunler.length,
      urunler,
    });
  } catch (err) {
    next(err); // Global hata yakalayıcıya yönlendirme
  }
});

// 🧾 Ürün detaylarını getirme
router.get("/:id", async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.id);

    if (isNaN(urunId)) {
      throw new ApiError("Geçersiz ürün ID", 400);
    }

    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
      include: {
        satici: {
          select: {
            id: true,
            kullaniciAdi: true,
          },
        },
      },
    });

    if (!urun) {
      throw new ApiError("Ürün bulunamadı", 404);
    }

    res.status(200).json({
      basarili: true,
      mesaj: "Ürün başarıyla getirildi ✅",
      urun,
    });
  } catch (err) {
    next(err);
  }
});

// 🗑️ Ürün silme işlemi (Resim dosyası silinir, ardından ürün silinir)
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const urunId = parseInt(req.params.id);

    // Ürün var mı kontrolü
    const urun = await prisma.urun.findUnique({
      where: { id: urunId },
    });

    // Ürün bulunamadıysa hata mesajı döndür
    if (!urun) {
      throw new ApiError("Ürün bulunamadı.", 404);
    }

    // Kullanıcı, ürünü satıyorsa silmeye yetkili
    if (urun.saticiId !== req.kullanici.id) {
      throw new ApiError("Bu ürünü silmeye yetkiniz yok.", 403);
    }

    // Satılmış ürün silinemez
    if (urun.satildi) {
      throw new ApiError("Satılmış ürünler silinemez.", 400);
    }

    // ✅ Resmi sil
    if (urun.resim) {
      deleteImage(urun.resim);
    }

    // Ürünü veritabanından silme
    await prisma.urun.update({
      where: { id: urunId },
      data: { silindi: true },
    });

    // Başarılı yanıt
    res.status(200).json({
      basarili: true,
      mesaj: "Ürün başarıyla silindi (soft delete) ✅",
    });
  } catch (err) {
    // Hata yakalama ve JSON formatında yanıt dönme
    next(err);
  }
});

// ✏️ Ürün güncelleme işlemi (Ürün satılmamış olmalı, resim güncellenebilir)
router.put(
  "/:id",
  upload.single("resim"),
  authMiddleware,
  async (req, res, next) => {
    try {
      const urunId = parseInt(req.params.id);

      // Ürün var mı kontrolü
      const urun = await prisma.urun.findUnique({
        where: { id: urunId },
      });

      // Ürün bulunamadıysa hata mesajı döndür
      if (!urun) {
        throw new ApiError("Ürün bulunamadı.", 404);
      }

      // Kullanıcı, ürünü satıyorsa güncellemeye yetkili
      if (urun.saticiId !== req.kullanici.id) {
        throw new ApiError("Bu ürünü güncellemeye yetkiniz yok.", 403);
      }

      // Satılmış ürün güncellenemez
      if (urun.satildi) {
        throw new ApiError("Satılmış ürünler güncellenemez.", 400);
      }

      // Fiyat kontrolü (virgül/nokta ve 2 basamaklı ondalık kontrolü)
      if (!req.body.fiyat) {
        throw new ApiError("Fiyat alanı eksik.", 422);
      }

      let fiyatFormatted = req.body.fiyat.replace(",", ".");
      if (!/^\d+(\.\d{1,2})?$/.test(fiyatFormatted)) {
        throw new ApiError("Geçersiz fiyat formatı. Örnek: 199.99", 422);
      }

      // İki ondalık basamağa kadar yuvarlama
      fiyatFormatted = parseFloat(fiyatFormatted).toFixed(2);

      // Konum formatı kontrolü (JSON)
      let konumParsed;
      try {
        konumParsed = JSON.parse(req.body.konum);
        if (!konumParsed.il || !konumParsed.ilce || !konumParsed.ulke) {
          throw new Error();
        }
      } catch {
        throw new ApiError(
          'Geçersiz konum formatı. Örnek: {"il": "İstanbul", "ilce": "Kadıköy", "ulke": "Türkiye"}',
          422
        );
      }

      // Resim dosyasını güncelleme (Yeni resim eklenmişse)
      let resimAdi = urun.resim;
      if (req.file) {
        if (urun.resim) deleteImage(urun.resim);
        resimAdi = req.file.filename;
      }

      // Ürünü güncelleme işlemi
      const updatedUrun = await prisma.urun.update({
        where: { id: urunId },
        data: {
          baslik: req.body.baslik,
          aciklama: req.body.aciklama || null,
          fiyat: parseFloat(fiyatFormatted),
          kategori: req.body.kategori,
          durum: req.body.durum,
          konum: konumParsed,
          resim: resimAdi,
        },
      });

      res.status(200).json({
        basarili: true,
        mesaj: "Ürün başarıyla güncellendi ✅",
        urun: updatedUrun,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Ürün arama ve filtreleme işlemi
router.get("/", async (req, res, next) => {
  try {
    const { arama, kategori, minFiyat, maxFiyat, durum } = req.query;
    const filtre = { satildi: false, silindi: false };

    // Arama varsa başlık, açıklama, kategori ve satıcı adına göre filtrele
    if (arama) {
      filtre.OR = [
        { baslik: { contains: arama, mode: "insensitive" } },
        { aciklama: { contains: arama, mode: "insensitive" } },
        { kategori: { contains: arama, mode: "insensitive" } },
        {
          satici: {
            kullaniciAdi: { contains: arama, mode: "insensitive" },
          },
        },
      ];
    }

    // Kategori filtresi
    if (kategori) {
      filtre.kategori = kategori;
    }

    // Fiyat aralığı filtresi
    if (minFiyat) {
      filtre.fiyat = { ...filtre.fiyat, gte: parseFloat(minFiyat) };
    }
    if (maxFiyat) {
      filtre.fiyat = { ...filtre.fiyat, lte: parseFloat(maxFiyat) };
    }

    // Durum filtresi
    if (durum) {
      filtre.durum = durum;
    }

    // Filtreli ürünleri getir
    const urunler = await prisma.urun.findMany({
      where: filtre,
      include: {
        satici: {
          select: { id: true, kullaniciAdi: true },
        },
      },
      orderBy: { id: "desc" }, // En son eklenen ürünler üstte görünsün
    });

    res.status(200).json({
      basarili: true,
      toplam: urunler.length,
      urunler,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const { tokenUret } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const {
  validateEmail,
  validatePassword,
  validateUsername,
} = require("../utils/validators");

const router = express.Router();

// Hata yönetimi için merkezi middleware
router.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

//KAYIT
router.post("/kayit", async (req, res, next) => {
  try {
    const { kullaniciAdi, eposta, sifre } = req.body;

    // Giriş verilerini kontrol et
    if (!kullaniciAdi || !eposta || !sifre) {
      throw new ApiError("Tüm zorunlu alanları doldurun", 400);
    }

    // Validasyonlar
    if (!validateUsername(kullaniciAdi)) {
      throw new ApiError("Geçersiz kullanıcı adı formatı", 422);
    }

    if (!validateEmail(eposta)) {
      throw new ApiError("Geçersiz e-posta formatı", 422);
    }

    if (!validatePassword(sifre)) {
      throw new ApiError(
        "Şifre en az 6 karakter, büyük/küçük harf ve sayı içermeli",
        422
      );
    }

    // Kullanıcı var mı kontrolü
    const mevcutKullanici = await prisma.kullanici.findFirst({
      where: { OR: [{ kullaniciAdi }, { eposta }] },
    });

    if (mevcutKullanici) {
      throw new ApiError("Kullanıcı adı veya e-posta zaten kullanımda", 409);
    }

    // Kullanıcı oluştur
    const yeniKullanici = await prisma.kullanici.create({
      data: {
        kullaniciAdi,
        eposta,
        sifre: await bcrypt.hash(sifre, 12),
      },
    });

    // Token oluştur
    const token = tokenUret({
      id: yeniKullanici.id,
      kullaniciAdi: yeniKullanici.kullaniciAdi,
    });

    // Yanıt hazırla (şifreyi çıkar)
    const { sifre: _, ...kullaniciBilgileri } = yeniKullanici;

    res.status(201).json({
      basarili: true,
      mesaj: "Kullanıcı başarıyla oluşturuldu",
      kullanici: kullaniciBilgileri,
      token,
    });
  } catch (hata) {
    next(hata);
  }
});

//GIRIS
router.post("/giris", async (req, res, next) => {
  try {
    const { kullaniciAdi, eposta, sifre } = req.body;
    const girisBilgisi = kullaniciAdi || eposta;

    if (!girisBilgisi || !sifre) {
      throw new ApiError("Kullanıcı adı/e-posta ve şifre gereklidir", 400);
    }

    const kullanici = await prisma.kullanici.findFirst({
      where: {
        OR: [{ kullaniciAdi: girisBilgisi }, { eposta: girisBilgisi }],
      },
    });

    if (!kullanici) {
      throw new ApiError("Kullanıcı bulunamadı", 404);
    }

    const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogruMu) {
      throw new ApiError("Geçersiz kimlik bilgileri", 401);
    }

    const token = tokenUret({
      id: kullanici.id,
      kullaniciAdi: kullanici.kullaniciAdi,
    });

    const { sifre: _, ...kullaniciBilgileri } = kullanici;

    res.status(200).json({
      basarili: true,
      mesaj: "Giriş başarılı",
      kullanici: kullaniciBilgileri,
      token,
    });
  } catch (hata) {
    next(hata);
  }
});

//PROFILE
router.get("/profil", authMiddleware, async (req, res, next) => {
  try {
    const { sifre: _, ...kullaniciBilgileri } = req.kullanici;

    res.status(200).json({
      basarili: true,
      kullanici: kullaniciBilgileri,
    });
  } catch (hata) {
    next(hata);
  }
});

// KUKLLANICI SIFRE DEGISTIRME

router.put("/sifre", authMiddleware, async (req, res, next) => {
  try {
    const { sifreMevcut, sifreYeni, sifreYeniTekrar } = req.body;
    const kullanici = req.kullanici;

    // Validasyonlar
    if (!sifreMevcut || !sifreYeni || !sifreYeniTekrar) {
      throw new ApiError("Tüm alanlar zorunludur", 400);
    }

    if (sifreYeni !== sifreYeniTekrar) {
      throw new ApiError("Yeni şifreler eşleşmiyor", 422);
    }

    if (!validatePassword(sifreYeni)) {
      throw new ApiError(
        "Şifre en az 6 karakter, büyük/küçük harf ve sayı içermeli",
        422
      );
    }

    // Mevcut şifre kontrolü
    const sifreDogruMu = await bcrypt.compare(sifreMevcut, kullanici.sifre);
    if (!sifreDogruMu) {
      throw new ApiError("Mevcut şifre hatalı", 401);
    }

    // Yeni şifreyi hashle ve güncelle
    const sifreHash = await bcrypt.hash(sifreYeni, 12);
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: { sifre: sifreHash },
    });

    res.status(200).json({
      basarili: true,
      mesaj: "Şifre başarıyla güncellendi",
    });
  } catch (hata) {
    next(hata);
  }
});

// KULLANICI E-POST GUNCELLEME
router.put("/eposta", authMiddleware, async (req, res, next) => {
  try {
    const { epostaYeni, sifre } = req.body;
    const kullanici = req.kullanici;

    // Validasyonlar
    if (!epostaYeni || !sifre) {
      throw new ApiError("E-posta ve şifre zorunludur", 400);
    }

    if (!validateEmail(epostaYeni)) {
      throw new ApiError("Geçersiz e-posta formatı", 422);
    }

    // Şifre kontrolü
    const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogruMu) {
      throw new ApiError("Şifre hatalı", 401);
    }

    // E-posta kullanımda mı kontrolü
    const epostaKullaniliyorMu = await prisma.kullanici.findFirst({
      where: { eposta: epostaYeni },
    });

    if (epostaKullaniliyorMu && epostaKullaniliyorMu.id !== kullanici.id) {
      throw new ApiError("Bu e-posta zaten kullanılıyor", 409);
    }

    // E-postayı güncelle
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: { eposta: epostaYeni },
    });

    res.status(200).json({
      basarili: true,
      mesaj: "E-posta başarıyla güncellendi",
    });
  } catch (hata) {
    next(hata);
  }
});

// KULLANICI ADI GÜNCELLEME
router.put("/kullanici-adi", authMiddleware, async (req, res, next) => {
  try {
    const { kullaniciAdiYeni, sifre } = req.body;
    const kullanici = req.kullanici;

    // Zorunlu alan kontrolü
    if (!kullaniciAdiYeni || !sifre) {
      throw new ApiError("Kullanıcı adı ve şifre zorunludur", 400);
    }

    // Şifre doğru mu?
    const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogruMu) {
      throw new ApiError("Şifre hatalı", 401);
    }

    // Aynı kullanıcı adı varsa reddet
    const kullaniciAdiKullanimdaMi = await prisma.kullanici.findFirst({
      where: { kullaniciAdi: kullaniciAdiYeni },
    });

    if (
      kullaniciAdiKullanimdaMi &&
      kullaniciAdiKullanimdaMi.id !== kullanici.id
    ) {
      throw new ApiError("Bu kullanıcı adı zaten kullanılıyor", 409);
    }

    // Güncelle
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: { kullaniciAdi: kullaniciAdiYeni },
    });

    res.status(200).json({
      basarili: true,
      mesaj: "Kullanıcı adı başarıyla güncellendi",
    });
  } catch (hata) {
    next(hata);
  }
});

// HESAP SİLME - KULLANICIYA AİT TÜM VERİLERİ SİLER
router.delete("/hesap-sil", authMiddleware, async (req, res, next) => {
  try {
    const kullaniciId = req.kullanici.id;
    const { sifre } = req.body;

    if (!sifre) {
      throw new ApiError("Şifre zorunludur", 400);
    }

    // Kullanıcı bilgilerini al
    const kullanici = await prisma.kullanici.findUnique({
      where: { id: kullaniciId },
    });

    // Şifre doğrulaması yap
    const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogruMu) {
      throw new ApiError("Şifre hatalı", 401);
    }

    // Alıcı olarak yapılan satış taleplerini sil
    await prisma.satisTalebi.deleteMany({ where: { aliciId: kullaniciId } });

    // Alıcı olarak yapılan satış kayıtlarını sil
    await prisma.satilan.deleteMany({ where: { aliciId: kullaniciId } });

    // Kullanıcının hedef olduğu bildirimleri sil
    await prisma.bildirim.deleteMany({
      where: {
        kullanici: {
          id: kullaniciId,
        },
      },
    });
    // Kullanıcının favori kayıtlarını sil
    await prisma.favori.deleteMany({ where: { kullaniciId } });

    // Kullanıcının alıcı veya satıcı olduğu sohbetleri sil
    await prisma.sohbet.deleteMany({
      where: {
        OR: [{ aliciId: kullaniciId }, { saticiId: kullaniciId }],
      },
    });

    // Kullanıcının gönderdiği tüm mesajları sil
    await prisma.mesaj.deleteMany({
      where: { gondericiId: kullaniciId },
    });

    // Kullanıcının satıcı olduğu tüm ürünleri sil
    await prisma.urun.deleteMany({ where: { saticiId: kullaniciId } });

    // Son olarak kullanıcı kaydını sil
    await prisma.kullanici.delete({ where: { id: kullaniciId } });

    res
      .status(200)
      .json({ basarili: true, mesaj: "Hesabınız kalıcı olarak silindi." });
  } catch (err) {
    next(err);
  }
});

// Hata işleme middleware'i
router.use((err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    basarili: false,
    mesaj: err.message || "Sunucu hatası",
    hataKodu: err.statusCode || 500,
  });
});

module.exports = router;

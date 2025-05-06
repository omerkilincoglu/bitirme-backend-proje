const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// ❤️ Favori ekle (giriş yapmış kullanıcı + ürün kontrolü yapılır)
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { urunId } = req.body;
    const kullaniciId = req.kullanici.id;

    if (!urunId) throw new ApiError("Ürün ID gerekli.", 422);

    // 1. Ürün gerçekten var mı?
    const urun = await prisma.urun.findUnique({ where: { id: urunId } });
    if (!urun) throw new ApiError("Bu ID'ye ait bir ürün bulunamadı.", 404);

    // 2. Zaten favorilere eklenmiş mi?
    const varsa = await prisma.favori.findFirst({
      where: { urunId, kullaniciId },
    });
    if (varsa) throw new ApiError("Bu ürün zaten favorilerde.", 409);

    // 3. Favoriye ekle
    const favori = await prisma.favori.create({
      data: {
        urunId,
        kullaniciId,
      },
    });

    res.status(201).json({ mesaj: "Favoriye eklendi ✅", favori });
  } catch (hata) {
    next(hata);
  }
});

// 📃 Kullanıcının favori ürünlerini listele
router.get("/", authMiddleware, async (req, res, next) => {
    try {
      const favoriler = await prisma.favori.findMany({
        where: {
          kullaniciId: req.kullanici.id,
        },
        include: {
          urun: {
            include: {
              satici: {
                select: {
                  kullaniciAdi: true,
                }
              }
            }
          }
        },
        orderBy: {
          id: "desc"
        }
      });
  
      res.status(200).json({ favoriler });
    } catch (hata) {
      next(hata);
    }
  });
  
  // ❌ Favori silme
router.delete("/:id", authMiddleware, async (req, res, next) => {
    try {
      const favoriId = parseInt(req.params.id);
      const kullaniciId = req.kullanici.id;
  
      const favori = await prisma.favori.findUnique({
        where: { id: favoriId }
      });
  
      if (!favori) throw new ApiError("Favori bulunamadı.", 404);
      if (favori.kullaniciId !== kullaniciId) {
        throw new ApiError("Bu favoriyi silmeye yetkiniz yok.", 403);
      }
  
      await prisma.favori.delete({
        where: { id: favoriId }
      });
  
      res.status(200).json({ mesaj: "Favoriden kaldırıldı ✅" });
    } catch (hata) {
      next(hata);
    }
  });
  
module.exports = router;

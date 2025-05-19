// satilan.js

const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const ApiError = require("../utils/ApiError");

const router = express.Router();

// 📦 ALDIKLARIM
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
    next(error);
  }
});

// 📦 SATTIKLARIM
router.get("/sattiklarim", authMiddleware, async (req, res, next) => {
  try {
    const sattiklarim = await prisma.satilan.findMany({
      where: { urun: { saticiId: req.kullanici.id } },
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
    next(error);
  }
});

module.exports = router;

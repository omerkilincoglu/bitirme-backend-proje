// const ApiError = require("../utils/ApiError");
// const { tokenDogrula } = require("../utils/jwt");
// const prisma = require("../utils/prisma"); // Tekilleştirilmiş Prisma

// async function authMiddleware(req, res, next) {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) throw new ApiError("Yetkisiz erişim", 401);

//     const cozulmusToken = tokenDogrula(token);
//     const kullanici = await prisma.kullanici.findUnique({
//       where: { id: cozulmusToken.id }
//     });

//     if (!kullanici) throw new ApiError("Kullanıcı bulunamadı", 401);
    
//     req.kullanici = kullanici;
//     next();
//   } catch (hata) {
//     next(hata);
//   }
// }

// module.exports = authMiddleware;

const ApiError = require("../utils/ApiError");
const { tokenDogrula } = require("../utils/jwt");
const prisma = require("../utils/prisma");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError("Yetkilendirme başlığı eksik veya geçersiz", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new ApiError("Yetkilendirme tokenı eksik", 401);
    }

    const cozulmusToken = tokenDogrula(token);
    if (!cozulmusToken || !cozulmusToken.id) {
      throw new ApiError("Geçersiz token", 401);
    }

    const kullanici = await prisma.kullanici.findUnique({
      where: { id: cozulmusToken.id }
    });

    if (!kullanici) {
      throw new ApiError("Kullanıcı bulunamadı", 404);
    }

    req.kullanici = kullanici;
    next();
  } catch (hata) {
    next(hata);
  }
}

module.exports = authMiddleware;



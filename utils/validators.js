// utils/validators.js

// ✅ İzin verilen e-posta domainleri
const allowedDomains = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'yandex.com',
  'protonmail.com'
];

// ✅ E-posta doğrulama (format + domain kontrolü)
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(String(email).toLowerCase())) return false;

  const domain = email.split('@')[1].toLowerCase();
  return allowedDomains.includes(domain);
};

// ✅ Şifre doğrulama (min 6 karakter, büyük, küçük harf ve sayı)
const validatePassword = (password) => {
  const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
  return re.test(password);
};

// ✅ Kullanıcı adı doğrulama (3-20 karakter, harf, sayı, alt çizgi)
const validateUsername = (username) => {
  const re = /^[a-zA-Z0-9_]{3,20}$/;
  return re.test(username);
};

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername
};

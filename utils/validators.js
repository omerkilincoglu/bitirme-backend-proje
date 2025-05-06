// utils/validators.js
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };
  
  const validatePassword = (password) => {
    // En az 6 karakter, büyük harf, küçük harf ve sayı içermeli
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
    return re.test(password);
  };
  
  const validateUsername = (username) => {
    // Sadece harf, sayı ve alt çizgi, 3-20 karakter
    const re = /^[a-zA-Z0-9_]{3,20}$/;
    return re.test(username);
  };
  
  module.exports = {
    validateEmail,
    validatePassword,
    validateUsername
  };
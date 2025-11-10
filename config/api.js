// config/api.js
const API_CONFIG = {
  // 🔧 CAMBIA ESTA IP POR TU IP LOCAL
  BASE_URL: 'http://192.168.68.121:3000',
  API_BASE_URL: 'http://192.168.68.121:3000/api',
  
  // Timeouts
  TIMEOUT: 10000, // 10 segundos
  
  // Headers comunes
  HEADERS: {
    'Content-Type': 'application/json',
  }
};

export default API_CONFIG;


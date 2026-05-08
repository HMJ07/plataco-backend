// PLATACO — Configuración del frontend
// Edita este archivo con tus datos reales

// URL de tu backend en Railway (ya configurada)
window.PLATACO_API_URL = 'https://plataco-backend-production.up.railway.app/api';

// Tu clave PÚBLICA de Stripe (empieza con pk_test_ o pk_live_)
// Obtén la tuya en: https://dashboard.stripe.com/apikeys
// ⚠️ Esta es la clave PÚBLICA, es seguro ponerla aquí
window.PLATACO_STRIPE_PK = 'pk_test_51TSdgPLW0qc9Csd80Xawbh5FnCduLNY5YhUsmjbuIwLNfRhrRxxeESavfZAxe76EqPfZhPg9q3HzziATENqISag800Bj6COSoW';

// Google OAuth — Client ID (obtenlo en console.cloud.google.com)
// 1. Crea un proyecto → APIs & Services → Credentials → OAuth 2.0 Client ID
// 2. Tipo: "Web application"
// 3. Authorized JS origins: tu dominio (ej: https://plataco.netlify.app)
// 4. Pega aquí el Client ID (termina en .apps.googleusercontent.com)
window.PLATACO_GOOGLE_CLIENT_ID = ''; // ← pega aquí tu Google Client ID

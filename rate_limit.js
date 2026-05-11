// rate_limit.js
// ============================================================
// Rate limiting sin dependencias externas.
// Usa un Map en memoria (suficiente para un servidor single-process).
// Si escalaras a múltiples instancias, migrar a Redis con ioredis.
// ============================================================

// windowMs   — ventana de tiempo en ms
// max        — máximo de intentos en esa ventana
// message    — mensaje de error al superar el límite
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10, message = 'Demasiados intentos. Espera unos minutos.' } = {}) {
  // key → { count, resetAt }
  const store = new Map();

  // Limpiar entradas caducadas cada 5 min para no acumular memoria
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 5 * 60 * 1000);

  return function rateLimitMiddleware(req, res, next) {
    // Clave por IP. Si hay proxy de confianza (Railway, Render) usa X-Forwarded-For.
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    let entry = store.get(key);

    // Primera petición o ventana caducada → reiniciar
    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: message, retry_after_seconds: retryAfter });
    }

    next();
  };
}

// ── Limitadores específicos ────────────────────────────────

// Login: 10 intentos / 15 min por IP (protección fuerza bruta)
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.',
});

// Registro: 5 cuentas / hora por IP (evitar creación masiva de cuentas)
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Demasiados registros desde esta IP. Espera una hora.',
});

// Cupones: 20 validaciones / 5 min por IP (evitar enumeración de códigos)
export const couponLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Demasiadas validaciones de cupón. Espera 5 minutos.',
});

// API general: 200 req / min por IP (protección DDoS básica)
export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Demasiadas peticiones. Reduce la frecuencia.',
});

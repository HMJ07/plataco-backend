// backend/routes/google_auth.js
// Google Sign-In usando el token ID de Google Identity Services (GIS)
// No requiere passport ni sesiones: verifica el JWT de Google directamente.
//
// Flujo:
//   1. El frontend carga la librería de Google (accounts.google.com/gsi/client)
//   2. El usuario hace clic en "Iniciar sesión con Google"
//   3. Google devuelve un credential (JWT) al frontend
//   4. El frontend envía ese credential a POST /api/auth/google
//   5. Este endpoint lo verifica con la API de Google y crea/loguea al usuario

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Verifica el token de Google contra su endpoint público
async function verifyGoogleToken(credential) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Token de Google inválido');
  const payload = await res.json();

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token no pertenece a esta aplicación');
  }
  if (payload.exp < Date.now() / 1000) {
    throw new Error('Token de Google expirado');
  }
  return payload; // { sub, email, name, given_name, family_name, picture, ... }
}

// ── POST /api/auth/google ──────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google OAuth no configurado en el servidor (falta GOOGLE_CLIENT_ID)' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Falta el credential de Google' });
    }

    // Verificar el token con Google
    const googleUser = await verifyGoogleToken(credential);
    const { sub: google_id, email, given_name, family_name } = googleUser;

    // Buscar si ya existe el usuario por google_id o email
    let userResult = await query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1',
      [google_id, email.toLowerCase()]
    );

    let user = userResult.rows[0];

    if (user) {
      // Usuario existente: actualizar google_id si aún no lo tiene
      if (!user.google_id) {
        await query('UPDATE users SET google_id = $1 WHERE id = $2', [google_id, user.id]);
        user.google_id = google_id;
      }
    } else {
      // Crear nuevo usuario (sin password_hash ya que se autentica con Google)
      const insertResult = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, google_id, email_verified)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id, email, first_name, last_name, role`,
        [email.toLowerCase(), '', given_name || '', family_name || '', google_id]
      );
      user = insertResult.rows[0];
    }

    // Generar JWT propio de Plataco
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.status(401).json({ error: err.message || 'Error en autenticación con Google' });
  }
});

export default router;

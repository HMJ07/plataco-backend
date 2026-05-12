// password_reset.js
// ============================================================
// Flujo de recuperación de contraseña en dos pasos:
//
//   1. POST /api/auth/forgot-password
//      El usuario envía su email. Si existe, le mandamos un email
//      con un link que contiene un token de un solo uso (1 hora).
//      Siempre devuelve 200 (no revelamos si el email existe o no).
//
//   2. POST /api/auth/reset-password
//      El usuario envía el token (desde el link del email) + nueva contraseña.
//      Verificamos el token, actualizamos la contraseña, e invalidamos el token.
// ============================================================

import { Router }  from 'express';
import bcrypt      from 'bcryptjs';
import crypto      from 'crypto';
import { query, getClient } from './db.js';
import { forgotPasswordLimiter, resetPasswordLimiter } from './rate_limit.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────

function generateToken() {
  // 32 bytes aleatorios → 64 chars hex. Suficiente entropía para un token de un solo uso.
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  // Guardamos el hash SHA-256 en la BD, no el token en claro.
  // Si la BD se compromete, los tokens no sirven de nada.
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function sendPasswordResetEmail(email, firstName, resetUrl) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM     = process.env.EMAIL_FROM || 'PLATACO <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY no configurada — email de reset no enviado');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recupera tu contraseña – PLATACO</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Georgia',serif;color:#2c1810;">

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#2c1810;padding:28px 0;text-align:center;">
        <h1 style="margin:0;color:#d4a843;font-size:28px;letter-spacing:4px;font-weight:normal;">PLATACO</h1>
        <p style="margin:4px 0 0;color:#c9a96e;font-size:12px;letter-spacing:2px;">JOYERÍA EN PLATA</p>
      </td>
    </tr>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:0 16px;">
        <table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">

          <tr>
            <td style="padding:40px 0 24px;text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">🔑</div>
              <h2 style="margin:0 0 8px;font-size:24px;color:#2c1810;">Recupera tu contraseña</h2>
              <p style="margin:0;color:#8b6914;font-size:15px;">
                Hola${firstName ? `, ${firstName}` : ''}. Hemos recibido una solicitud para restablecer tu contraseña.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(44,24,16,0.08);text-align:center;">
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                Haz clic en el botón para crear una nueva contraseña. El enlace es válido durante <strong>1 hora</strong>.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;background:#d4a843;color:#2c1810;text-decoration:none;
                        padding:14px 36px;border-radius:6px;font-size:15px;font-weight:bold;
                        letter-spacing:0.5px;">
                Restablecer contraseña
              </a>
              <p style="margin:24px 0 0;font-size:12px;color:#aaa;word-break:break-all;">
                Si el botón no funciona, copia este enlace en tu navegador:<br>
                <span style="color:#d4a843;">${resetUrl}</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 0;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fff8e7;border:1px solid #d4a843;border-radius:12px;padding:16px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;color:#8b6914;line-height:1.6;">
                      ⚠️ Si no solicitaste este cambio, ignora este email. Tu contraseña no cambiará.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} PLATACO — Joyería en Plata</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: email, subject: '🔑 Recupera tu contraseña — PLATACO', html }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error enviando email de reset');
  console.log(`📧 Email de reset enviado a ${email}`);
}

// ── POST /api/auth/forgot-password ─────────────────────────
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El email es obligatorio' });

    // Buscamos el usuario. Si no existe, devolvemos 200 igualmente
    // (no revelar si un email está registrado o no — previene enumeración)
    const userRes = await query(
      'SELECT id, first_name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = userRes.rows[0];

    if (user) {
      // Invalidar tokens anteriores de este usuario por seguridad
      await query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [user.id]
      );

      const token    = generateToken();
      const tokenHash = hashToken(token);

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash)
         VALUES ($1, $2)`,
        [user.id, tokenHash]
      );

      // La URL apunta al frontend. Ajusta FRONTEND_URL en tus variables de entorno.
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
      const resetUrl    = `${frontendUrl}/reset-password.html?token=${token}`;

      // No esperamos — si el email falla, que no bloquee la respuesta
      sendPasswordResetEmail(user.email, user.first_name, resetUrl).catch(err =>
        console.error('Error enviando email de reset:', err.message)
      );
    }

    // Respuesta idéntica tanto si el usuario existe como si no
    res.json({ message: 'Si ese email está registrado, recibirás un enlace en breve.' });

  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
  }
});

// ── POST /api/auth/reset-password ──────────────────────────
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const tokenHash = hashToken(token);

    const tokenRes = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1`,
      [tokenHash]
    );
    const tokenRow = tokenRes.rows[0];

    if (!tokenRow) {
      return res.status(400).json({ error: 'Enlace inválido o caducado' });
    }
    if (tokenRow.used_at) {
      return res.status(400).json({ error: 'Este enlace ya ha sido utilizado' });
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El enlace ha caducado. Solicita uno nuevo.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Actualizar contraseña e invalidar el token en una sola transacción
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [passwordHash, tokenRow.user_id]
      );
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [tokenRow.id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log(`🔒 Contraseña restablecida para user ${tokenRow.user_id}`);
    res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });

  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
  }
});

export default router;

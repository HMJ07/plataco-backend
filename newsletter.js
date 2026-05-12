// ============================================================
// PLATACO — Newsletter: suscripción y confirmación por email
// ============================================================
// Ruta: POST /api/newsletter/subscribe
// Variables de entorno necesarias:
//   RESEND_API_KEY       — clave de Resend
//   EMAIL_FROM           — dirección remitente (ej: PLATACO <hola@plataco.es>)
//   NEWSLETTER_RECIPIENT — tu correo donde quieres recibir notificaciones (opcional)
// ============================================================

import express from 'express';

const router = express.Router();

// Helper: envía email via Resend (igual que email.js del proyecto)
async function sendEmail({ to, subject, html }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM     = process.env.EMAIL_FROM || 'PLATACO <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY no configurada — email newsletter no enviado');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error enviando email');
  console.log(`📧 Newsletter email enviado a ${to} — ID: ${data.id}`);
}

// ── POST /api/newsletter/subscribe ──────────────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    // Validación básica
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico no válido.' });
    }

    const emailLower = email.toLowerCase().trim();

    // 1. Email de bienvenida al suscriptor
    await sendEmail({
      to: emailLower,
      subject: '✦ Bienvenida/o a PLATACO — Ya eres parte de nuestra comunidad',
      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Bienvenida/o a PLATACO</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border:1px solid #1e1e1e;">

          <!-- Header -->
          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #1a1a1a;text-align:center;">
              <div style="font-size:26px;font-weight:300;letter-spacing:0.4em;color:#c9a84c;">
                PLATA<em style="font-style:italic;color:#ffffff;">&amp;</em>CO
              </div>
              <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#333;margin:6px 0 0;">
                Joyería en Plata · Artesanal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 40px;">
              <p style="font-size:22px;font-weight:300;color:#ffffff;margin:0 0 8px;line-height:1.3;">
                Gracias por suscribirte
              </p>
              <div style="width:32px;height:1px;background:#c9a84c;margin:0 0 28px;"></div>

              <p style="font-size:14px;color:#666;line-height:1.9;margin:0 0 20px;">
                Ya formas parte de la comunidad PLATACO. Serás el primero en conocer nuestras
                nuevas colecciones, piezas de edición limitada y ofertas exclusivas para suscriptores.
              </p>

              <p style="font-size:14px;color:#666;line-height:1.9;margin:0 0 36px;">
                Cada pieza que diseñamos nace de plata 925 y oro 18k trabajados a mano — joyería
                española con carácter permanente.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#c9a84c;padding:0;">
                    <a href="https://plataco.es" style="display:inline-block;padding:14px 32px;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#0a0a0a;text-decoration:none;font-weight:500;">
                      Ver colección
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Garantías -->
          <tr>
            <td style="padding:0 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1a1a1a;padding-top:28px;">
                <tr>
                  <td style="width:33%;padding:0 8px 0 0;vertical-align:top;">
                    <p style="font-size:10px;color:#c9a84c;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px;">✦ Plata 925</p>
                    <p style="font-size:11px;color:#444;margin:0;line-height:1.6;">Certificada con sello de ley</p>
                  </td>
                  <td style="width:33%;padding:0 8px;vertical-align:top;">
                    <p style="font-size:10px;color:#c9a84c;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px;">✦ 30 días</p>
                    <p style="font-size:11px;color:#444;margin:0;line-height:1.6;">Devolución sin coste</p>
                  </td>
                  <td style="width:33%;padding:0 0 0 8px;vertical-align:top;">
                    <p style="font-size:10px;color:#c9a84c;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px;">✦ Envío gratis</p>
                    <p style="font-size:11px;color:#444;margin:0;line-height:1.6;">En pedidos desde 60 €</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer email -->
          <tr>
            <td style="padding:20px 48px;border-top:1px solid #111;text-align:center;">
              <p style="font-size:10px;color:#2a2a2a;letter-spacing:0.1em;margin:0 0 6px;">
                © ${new Date().getFullYear()} PLATACO — Joyería Artesanal · España
              </p>
              <p style="font-size:10px;color:#222;margin:0;">
                Recibes este email porque te suscribiste en plataco.es
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    // 2. Notificación interna (si está configurado NEWSLETTER_RECIPIENT)
    const adminEmail = process.env.NEWSLETTER_RECIPIENT;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `📬 Nueva suscripción newsletter — ${emailLower}`,
        html: `
          <p style="font-family:sans-serif;font-size:14px;color:#333;">
            Nueva suscripción al newsletter de PLATACO:<br><br>
            <strong>${emailLower}</strong><br><br>
            Fecha: ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
          </p>
        `,
      });
    }

    return res.json({ ok: true, message: 'Suscripción completada. ¡Revisa tu bandeja de entrada!' });

  } catch (err) {
    console.error('❌ Error newsletter:', err);
    return res.status(500).json({ error: 'No se pudo completar la suscripción. Inténtalo de nuevo.' });
  }
});

export default router;

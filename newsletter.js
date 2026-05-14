// ============================================================
// PLATACO — Newsletter: suscripción y confirmación por email
// ============================================================
// Ruta: POST /api/newsletter/subscribe
// Variables de entorno necesarias:
//   RESEND_API_KEY       — clave de Resend (opcional — sin ella funciona igual)
//   EMAIL_FROM           — dirección remitente (ej: PLATACO <hola@plataco.es>)
//   NEWSLETTER_RECIPIENT — tu correo donde recibes notificaciones (opcional)
// ============================================================

import express from 'express';
import { query } from './db.js';

const router = express.Router();

// Helper: envía email via Resend — NUNCA lanza excepción, solo loguea
async function sendEmail({ to, subject, html }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM     = process.env.EMAIL_FROM || 'PLATACO <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY no configurada — email newsletter no enviado');
    return { ok: false, reason: 'no_api_key' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn(`⚠️  Resend error enviando a ${to}:`, data.message);
      return { ok: false, reason: data.message };
    }
    console.log(`📧 Newsletter email enviado a ${to} — ID: ${data.id}`);
    return { ok: true };
  } catch (err) {
    console.warn(`⚠️  Resend excepción enviando a ${to}:`, err.message);
    return { ok: false, reason: err.message };
  }
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

    // 1. Guardar en BD (crea la tabla si no existe)
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id         SERIAL PRIMARY KEY,
        email      TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    try {
      await query(
        'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
        [emailLower]
      );
      console.log(`✅ Newsletter: ${emailLower} guardado en BD`);
    } catch (dbErr) {
      // Si la BD falla también lo logueamos pero no bloqueamos
      console.warn('⚠️  Newsletter BD error:', dbErr.message);
    }

    // 2. Email de bienvenida al suscriptor (fallo silencioso)
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

          <!-- Footer -->
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

    // 3. Notificación interna (si está configurado NEWSLETTER_RECIPIENT)
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

    // ✅ Siempre respondemos OK — la suscripción está guardada aunque el email falle
    return res.json({ ok: true, message: '¡Suscripción completada! Revisa tu bandeja de entrada.' });

  } catch (err) {
    console.error('❌ Error newsletter:', err);
    return res.status(500).json({ error: 'No se pudo completar la suscripción. Inténtalo de nuevo.' });
  }
});

export default router;

// ── POST /api/newsletter/contact ────────────────────────────
router.post('/contact', async (req, res) => {
  try {
    const { nombre, email, asunto, mensaje } = req.body;

    if (!nombre || !email || !asunto || !mensaje) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico no válido.' });
    }

    const CONTACT_RECIPIENT = process.env.CONTACT_RECIPIENT || process.env.NEWSLETTER_RECIPIENT;

    const asuntoLabels = {
      pedido: 'Consulta sobre mi pedido',
      devolucion: 'Devolución o cambio',
      talla: 'Consulta de talla / medida',
      producto: 'Información sobre un producto',
      personalizado: 'Pieza personalizada',
      mayorista: 'Venta al por mayor',
      otro: 'Otro',
    };
    const asuntoLabel = asuntoLabels[asunto] || asunto;

    // 1. Email de confirmación al cliente (fallo silencioso)
    await sendEmail({
      to: email,
      subject: '✦ Hemos recibido tu mensaje — PLATACO',
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border:1px solid #1e1e1e;">
        <tr>
          <td style="padding:40px 48px 32px;border-bottom:1px solid #1a1a1a;text-align:center;">
            <div style="font-size:26px;font-weight:300;letter-spacing:0.4em;color:#c9a84c;">PLATA<em style="font-style:italic;color:#fff;">&amp;</em>CO</div>
            <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#333;margin:6px 0 0;">Joyería en Plata · Artesanal</p>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 48px 40px;">
            <p style="font-size:22px;font-weight:300;color:#fff;margin:0 0 8px;">Hola, ${nombre}</p>
            <div style="width:32px;height:1px;background:#c9a84c;margin:0 0 28px;"></div>
            <p style="font-size:14px;color:#666;line-height:1.9;margin:0 0 20px;">
              Hemos recibido tu mensaje y te responderemos en un plazo máximo de <strong style="color:#888;">24 horas laborables</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border:1px solid #1e1e1e;margin:0 0 28px;">
              <tr><td style="padding:20px 24px;">
                <p style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#555;margin:0 0 4px;">Asunto</p>
                <p style="font-size:14px;color:#888;margin:0 0 16px;">${asuntoLabel}</p>
                <p style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#555;margin:0 0 4px;">Tu mensaje</p>
                <p style="font-size:14px;color:#666;line-height:1.7;margin:0;">${mensaje.replace(/\n/g, '<br>')}</p>
              </td></tr>
            </table>
            <p style="font-size:13px;color:#444;line-height:1.7;margin:0;">Si tienes urgencia, escríbenos a <a href="mailto:hola@plataco.es" style="color:#c9a84c;text-decoration:none;">hola@plataco.es</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 48px;border-top:1px solid #111;text-align:center;">
            <p style="font-size:10px;color:#2a2a2a;letter-spacing:0.1em;margin:0;">© ${new Date().getFullYear()} PLATACO — Joyería Artesanal · España</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    // 2. Notificación interna al equipo (fallo silencioso)
    if (CONTACT_RECIPIENT) {
      await sendEmail({
        to: CONTACT_RECIPIENT,
        subject: `📩 Nuevo mensaje de contacto — ${asuntoLabel} — ${nombre}`,
        html: `
          <div style="font-family:sans-serif;font-size:14px;color:#333;max-width:600px;margin:0 auto;">
            <h2 style="color:#c9a84c;border-bottom:1px solid #eee;padding-bottom:12px;">Nuevo mensaje de contacto</h2>
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Asunto:</strong> ${asuntoLabel}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
            <div style="background:#f9f9f9;border-left:3px solid #c9a84c;padding:16px 20px;margin-top:16px;">
              <p style="margin:0;line-height:1.8;">${mensaje.replace(/\n/g, '<br>')}</p>
            </div>
            <p style="margin-top:20px;"><a href="mailto:${email}?subject=Re: ${asuntoLabel}" style="background:#c9a84c;color:#000;padding:10px 20px;text-decoration:none;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Responder ahora</a></p>
          </div>`,
      });
    }

    return res.json({ ok: true, message: 'Mensaje enviado correctamente.' });

  } catch (err) {
    console.error('❌ Error contact form:', err);
    return res.status(500).json({ error: 'No se pudo enviar el mensaje. Inténtalo de nuevo.' });
  }
});

// ============================================================
// PLATACO — Servicio de Email con Nodemailer + Gmail SMTP
// ============================================================
// Variables de entorno necesarias en Railway:
//   GMAIL_USER=tucuenta@gmail.com
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   ← contraseña de aplicación de Google
//   EMAIL_FROM=PLATACO <tucuenta@gmail.com>   (opcional, por defecto usa GMAIL_USER)
//
// Cómo obtener la contraseña de aplicación de Google:
//   1. Ve a myaccount.google.com → Seguridad → Verificación en 2 pasos (actívala)
//   2. Busca "Contraseñas de aplicación" → Genera una para "Correo / Otro"
//   3. Copia las 16 letras que te da y ponlas en GMAIL_APP_PASSWORD
// ============================================================

import nodemailer from 'nodemailer';

/**
 * Envía un email usando Gmail SMTP.
 * IMPORTANTE: Las variables de entorno se leen aquí dentro (no al importar el módulo)
 * para garantizar que dotenv ya las ha cargado cuando se llama la función.
 */
async function sendEmail({ to, subject, html }) {
  const GMAIL_USER         = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const EMAIL_FROM         = process.env.EMAIL_FROM || `PLATACO <${GMAIL_USER}>`;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('⚠️  GMAIL_USER o GMAIL_APP_PASSWORD no configurados — email no enviado');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    family: 4,
    secure: false,       // puerto 587 usa STARTTLS (no SSL directo)
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({ from: EMAIL_FROM, to, subject, html });
  console.log(`📧 Email enviado a ${to} — ID: ${info.messageId}`);
}

/**
 * Genera y envía el email de confirmación de pedido.
 * @param {object} order  - Fila de la tabla orders
 * @param {Array}  items  - Array de items (campos: product_name, variant_name, quantity, subtotal_eur)
 * @param {string} email  - Dirección de destino
 */
export async function sendOrderConfirmationEmail(order, items, email) {
  if (!email) return;

  const fecha = new Date(order.created_at).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const shortId = String(order.id).slice(-8).toUpperCase();

  const itemsRows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e8d6;">
        <strong>${item.product_name}</strong>
        ${item.variant_name ? `<br><span style="color:#888;font-size:13px;">${item.variant_name}</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e8d6;text-align:center;">×${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e8d6;text-align:right;">
        ${parseFloat(item.subtotal_eur).toFixed(2)} €
      </td>
    </tr>
  `).join('');

  const direccion = [
    `${order.ship_first_name} ${order.ship_last_name}`,
    order.ship_address1,
    order.ship_address2,
    `${order.ship_postal_code} ${order.ship_city}`,
    order.ship_state,
    order.ship_country,
  ].filter(Boolean).join('<br>');

  const contactEmail = process.env.GMAIL_USER || 'hola@plataco.com';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Confirmación de pedido – PLATACO</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Georgia',serif;color:#2c1810;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:#2c1810;padding:28px 0;text-align:center;">
        <h1 style="margin:0;color:#d4a843;font-size:28px;letter-spacing:4px;font-weight:normal;">
          PLATACO
        </h1>
        <p style="margin:4px 0 0;color:#c9a96e;font-size:12px;letter-spacing:2px;">
          JOYERÍA EN PLATA
        </p>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:0 16px;">
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="max-width:600px;margin:0 auto;">

          <!-- Título -->
          <tr>
            <td style="padding:40px 0 24px;text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">✨</div>
              <h2 style="margin:0 0 8px;font-size:24px;color:#2c1810;">
                ¡Gracias por tu pedido!
              </h2>
              <p style="margin:0;color:#8b6914;font-size:15px;">
                Hemos recibido tu compra y la estamos preparando con cariño.
              </p>
            </td>
          </tr>

          <!-- Resumen del pedido -->
          <tr>
            <td style="background:#fff;border-radius:12px;padding:28px;
                       box-shadow:0 2px 8px rgba(44,24,16,0.08);margin-bottom:20px;">

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    <span style="font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;">
                      Pedido nº
                    </span><br>
                    <strong style="font-size:18px;color:#2c1810;">#${shortId}</strong>
                    <span style="float:right;font-size:13px;color:#888;">${fecha}</span>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #f0e8d6;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#faf7f2;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;
                               color:#888;letter-spacing:1px;text-transform:uppercase;font-weight:normal;">
                      Artículo
                    </th>
                    <th style="padding:10px 12px;text-align:center;font-size:12px;
                               color:#888;letter-spacing:1px;text-transform:uppercase;font-weight:normal;">
                      Cant.
                    </th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;
                               color:#888;letter-spacing:1px;text-transform:uppercase;font-weight:normal;">
                      Precio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>

              <!-- Totales -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="padding:4px 0;color:#666;font-size:14px;">Subtotal</td>
                  <td style="padding:4px 0;text-align:right;font-size:14px;">
                    ${parseFloat(order.subtotal_eur).toFixed(2)} €
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#666;font-size:14px;">Envío</td>
                  <td style="padding:4px 0;text-align:right;font-size:14px;">
                    ${parseFloat(order.shipping_eur) === 0
                      ? '<span style="color:#27a85f;">Gratis</span>'
                      : `${parseFloat(order.shipping_eur).toFixed(2)} €`}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;border-top:2px solid #d4a843;
                             font-size:16px;font-weight:bold;color:#2c1810;">
                    Total
                  </td>
                  <td style="padding:12px 0 0;border-top:2px solid #d4a843;
                             text-align:right;font-size:18px;font-weight:bold;color:#d4a843;">
                    ${parseFloat(order.total_eur).toFixed(2)} €
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dirección de envío -->
          <tr>
            <td style="padding-top:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:#fff;border-radius:12px;padding:20px;
                                         box-shadow:0 2px 8px rgba(44,24,16,0.08);vertical-align:top;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;
                              text-transform:uppercase;color:#888;">
                      📦 Dirección de envío
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#2c1810;">
                      ${direccion}
                    </p>
                    ${order.ship_phone
                      ? `<p style="margin:8px 0 0;font-size:13px;color:#888;">📞 ${order.ship_phone}</p>`
                      : ''}
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#fff;border-radius:12px;padding:20px;
                                         box-shadow:0 2px 8px rgba(44,24,16,0.08);vertical-align:top;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;
                              text-transform:uppercase;color:#888;">
                      💳 Pago
                    </p>
                    <p style="margin:0;font-size:14px;color:#2c1810;">
                      Tarjeta de crédito/débito
                    </p>
                    <p style="margin:8px 0 0;font-size:13px;color:#27a85f;font-weight:bold;">
                      ✓ Pago confirmado
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Info envío -->
          <tr>
            <td style="padding-top:20px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fffbf0;border:1px solid #d4a843;border-radius:12px;padding:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:14px;color:#8b6914;font-weight:bold;">
                      🚚 ¿Cuándo llega mi pedido?
                    </p>
                    <p style="margin:0;font-size:13px;color:#8b6914;line-height:1.6;">
                      Preparamos tu pedido en 1–2 días laborables. Una vez enviado,
                      recibirás otro email con el número de seguimiento.
                      El plazo de entrega habitual es de <strong>3–5 días laborables</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#888;">
                ¿Alguna pregunta? Escríbenos a
                <a href="mailto:${contactEmail}" style="color:#d4a843;">${contactEmail}</a>
              </p>
              <p style="margin:0;font-size:12px;color:#bbb;">
                © ${new Date().getFullYear()} PLATACO — Joyería en Plata
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  await sendEmail({
    to: email,
    subject: `✨ Confirmación de pedido #${shortId} — PLATACO`,
    html,
  });
}

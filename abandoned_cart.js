// ============================================================
// PLATACO — Email de Carrito Abandonado
// ============================================================
// Flujo:
//   1. El frontend llama POST /api/payments/checkout-started
//      cuando el usuario llega al paso de pago (con su email).
//   2. Un job cron (startAbandonedCartJob) corre cada 30 min.
//   3. Si el pedido sigue en 'pending' tras 2h, se envía el email.
//
// Rutas exportadas:
//   POST /api/abandoned-cart/checkout-started  → marcar inicio checkout
//
// Función interna (llamar desde server.js al arrancar):
//   startAbandonedCartJob()
// ============================================================

import { Router }  from 'express';
import { query }   from './db.js';

const router = Router();

// ── POST /api/abandoned-cart/checkout-started ──────────────
// Body: { order_id, email }
// El frontend llama esto en cuanto el usuario llega al formulario de pago.
router.post('/checkout-started', async (req, res) => {
  const { order_id, email } = req.body;
  if (!order_id || !email) {
    return res.status(400).json({ error: 'order_id y email son obligatorios.' });
  }
  try {
    await query(
      `UPDATE orders
       SET checkout_started_at = COALESCE(checkout_started_at, NOW()),
           guest_email = COALESCE(guest_email, $2)
       WHERE id = $1 AND status = 'pending'`,
      [order_id, email]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── JOB: Buscar y enviar emails de carrito abandonado ──────
export function startAbandonedCartJob() {
  const INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos

  async function runJob() {
    try {
      // Pedidos en pending, con checkout iniciado hace más de 2h,
      // sin email ya enviado, con email de cliente disponible
      const abandonedOrders = await query(`
        SELECT
          o.id,
          o.total_eur,
          o.subtotal_eur,
          o.shipping_eur,
          o.checkout_started_at,
          COALESCE(u.email, o.guest_email) AS email,
          COALESCE(u.first_name, o.ship_first_name, 'cliente') AS first_name,
          json_agg(json_build_object(
            'product_name', oi.product_name,
            'variant_name', oi.variant_name,
            'quantity',     oi.quantity,
            'unit_price_eur', oi.unit_price_eur,
            'subtotal_eur', oi.subtotal_eur
          )) AS items
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN abandoned_cart_logs acl ON acl.order_id = o.id
        WHERE o.status = 'pending'
          AND o.checkout_started_at IS NOT NULL
          AND o.checkout_started_at < NOW() - INTERVAL '2 hours'
          AND acl.order_id IS NULL
          AND COALESCE(u.email, o.guest_email) IS NOT NULL
        GROUP BY o.id, u.email, u.first_name
      `);

      if (!abandonedOrders.rows.length) return;

      console.log(`🛒 Job carrito abandonado: ${abandonedOrders.rows.length} pedidos a notificar`);

      for (const order of abandonedOrders.rows) {
        try {
          await sendAbandonedCartEmail(order);
          await query(
            `INSERT INTO abandoned_cart_logs (order_id) VALUES ($1) ON CONFLICT DO NOTHING`,
            [order.id]
          );
          console.log(`📧 Email carrito abandonado → ${order.email}`);
        } catch (emailErr) {
          console.error(`Error enviando email abandonado a ${order.email}:`, emailErr.message);
        }
      }
    } catch (err) {
      console.error('Error en job carrito abandonado:', err.message);
    }
  }

  // Ejecutar inmediatamente al arrancar y luego cada INTERVAL_MS
  runJob();
  setInterval(runJob, INTERVAL_MS);
  console.log('🛒 Job de carrito abandonado iniciado (cada 30 min)');
}

// ── Email de carrito abandonado ────────────────────────────
async function sendAbandonedCartEmail(order) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM     = process.env.EMAIL_FROM || 'PLATACO <onboarding@resend.dev>';
  const frontendUrl    = process.env.FRONTEND_URL || 'https://plataco.com';
  const checkoutUrl    = `${frontendUrl}/checkout.html`;

  if (!RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY no configurada — email no enviado');
    return;
  }

  const items = Array.isArray(order.items) ? order.items.filter(Boolean) : [];

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

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Olvidaste algo — PLATACO</title>
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

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:0 16px;">
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="max-width:600px;margin:0 auto;">

          <!-- Título -->
          <tr>
            <td style="padding:40px 0 24px;text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">💍</div>
              <h2 style="margin:0 0 8px;font-size:24px;color:#2c1810;">
                Hola ${order.first_name}, ¿te olvidaste de algo?
              </h2>
              <p style="margin:0;color:#666;font-size:15px;line-height:1.6;">
                Dejaste algunas piezas esperándote en tu carrito.<br>
                Están reservadas, pero no por mucho tiempo.
              </p>
            </td>
          </tr>

          <!-- Productos del carrito -->
          ${items.length ? `
          <tr>
            <td style="background:#fff;border-radius:12px;padding:24px;
                       box-shadow:0 2px 8px rgba(44,24,16,0.08);">
              <p style="margin:0 0 16px;font-size:12px;color:#888;letter-spacing:1px;
                        text-transform:uppercase;">Tu carrito</p>
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #f0e8d6;border-radius:8px;overflow:hidden;">
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="font-size:16px;font-weight:bold;color:#2c1810;">Total</td>
                  <td style="text-align:right;font-size:18px;font-weight:bold;color:#d4a843;">
                    ${parseFloat(order.total_eur).toFixed(2)} €
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding:32px 0;text-align:center;">
              <a href="${checkoutUrl}"
                 style="display:inline-block;background:#d4a843;color:#fff;
                        text-decoration:none;padding:18px 48px;border-radius:8px;
                        font-size:16px;letter-spacing:1px;font-family:sans-serif;
                        font-weight:bold;">
                Completar mi pedido
              </a>
              <p style="margin:20px 0 0;font-size:13px;color:#999;">
                El stock es limitado. No dejes escapar tus piezas.
              </p>
            </td>
          </tr>

          <!-- Garantías -->
          <tr>
            <td style="padding:20px 0;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fffbf0;border:1px solid #d4a843;border-radius:12px;padding:20px;">
                <tr>
                  <td style="text-align:center;padding:8px;">
                    <span style="font-size:20px;">🔒</span>
                    <p style="margin:4px 0 0;font-size:13px;color:#8b6914;">Pago seguro con Stripe</p>
                  </td>
                  <td style="text-align:center;padding:8px;">
                    <span style="font-size:20px;">🚚</span>
                    <p style="margin:4px 0 0;font-size:13px;color:#8b6914;">Envío gratis desde 60€</p>
                  </td>
                  <td style="text-align:center;padding:8px;">
                    <span style="font-size:20px;">↩️</span>
                    <p style="margin:4px 0 0;font-size:13px;color:#8b6914;">30 días de devolución</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
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

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: order.email,
      subject: '💍 ¿Olvidaste tu pedido? Todavía está aquí — PLATACO',
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error Resend');
}

export default router;

// ============================================================
// PLATACO — Aviso de reposición de stock
// ============================================================
// Rutas:
//   POST /api/stock-alerts          → el usuario deja su email
//   DELETE /api/stock-alerts        → desuscribirse
//
// Trigger interno (usado por admin.js):
//   triggerStockAlerts(productId)   → envía emails si hay stock
// ============================================================

import { Router } from 'express';
import { query }  from './db.js';

const router = Router();

// ── POST /api/stock-alerts ─────────────────────────────────
// Body: { product_id, email }
router.post('/', async (req, res) => {
  const { product_id, email } = req.body;

  if (!product_id || !email) {
    return res.status(400).json({ error: 'product_id y email son obligatorios.' });
  }

  // Validación básica de email
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    return res.status(400).json({ error: 'Email no válido.' });
  }

  try {
    // Verificar que el producto existe y está sin stock
    const prod = await query(
      `SELECT id, name, stock FROM products WHERE id = $1 AND is_active = TRUE`,
      [product_id]
    );
    if (!prod.rows.length) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    if (prod.rows[0].stock > 0) {
      return res.status(400).json({ error: 'Este producto ya tiene stock disponible.' });
    }

    // Insertar (ON CONFLICT no hace nada si ya existe)
    await query(
      `INSERT INTO stock_alerts (product_id, email)
       VALUES ($1, $2)
       ON CONFLICT (product_id, email) DO NOTHING`,
      [product_id, email.toLowerCase().trim()]
    );

    res.json({ ok: true, message: 'Te avisaremos cuando vuelva a haber stock.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/stock-alerts ────────────────────────────────
// Body: { product_id, email }
router.delete('/', async (req, res) => {
  const { product_id, email } = req.body;
  if (!product_id || !email) {
    return res.status(400).json({ error: 'product_id y email son obligatorios.' });
  }
  try {
    await query(
      `DELETE FROM stock_alerts WHERE product_id = $1 AND email = $2`,
      [product_id, email.toLowerCase().trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── FUNCIÓN INTERNA: disparar alertas al actualizar stock ──
// Llámala desde admin.js tras actualizar el stock de un producto.
// triggerStockAlerts(productId, productName, productSlug)
export async function triggerStockAlerts(productId, productName, productSlug) {
  try {
    // Buscar suscriptores pendientes de notificación
    const alerts = await query(
      `SELECT id, email FROM stock_alerts
       WHERE product_id = $1 AND notified_at IS NULL`,
      [productId]
    );

    if (!alerts.rows.length) return;

    const frontendUrl = process.env.FRONTEND_URL || 'https://plataco.com';
    const productUrl  = `${frontendUrl}/producto/${productSlug}`;

    for (const alert of alerts.rows) {
      try {
        await sendStockAlertEmail(alert.email, productName, productUrl);
        await query(
          `UPDATE stock_alerts SET notified_at = NOW() WHERE id = $1`,
          [alert.id]
        );
        console.log(`🔔 Alerta de stock enviada a ${alert.email} para "${productName}"`);
      } catch (emailErr) {
        console.error(`Error enviando alerta a ${alert.email}:`, emailErr.message);
      }
    }
  } catch (err) {
    console.error('Error en triggerStockAlerts:', err.message);
  }
}

// ── Email de aviso de stock ────────────────────────────────
async function sendStockAlertEmail(to, productName, productUrl) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM     = process.env.EMAIL_FROM || 'PLATACO <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY no configurada — email no enviado');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>¡Ya hay stock! — PLATACO</title>
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

          <tr>
            <td style="padding:48px 0 24px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">🔔</div>
              <h2 style="margin:0 0 12px;font-size:26px;color:#2c1810;">
                ¡Ya está disponible!
              </h2>
              <p style="margin:0;color:#666;font-size:16px;line-height:1.6;">
                Nos pediste que te avisáramos, y aquí estamos.<br>
                <strong style="color:#2c1810;">${productName}</strong> vuelve a tener stock.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:16px 0 40px;text-align:center;">
              <a href="${productUrl}"
                 style="display:inline-block;background:#d4a843;color:#fff;
                        text-decoration:none;padding:16px 40px;border-radius:8px;
                        font-size:16px;letter-spacing:1px;font-family:sans-serif;">
                Ver producto
              </a>
              <p style="margin:20px 0 0;font-size:13px;color:#999;">
                Date prisa — el stock puede agotarse de nuevo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;border-top:1px solid #f0e8d6;">
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
    body: JSON.stringify({ from: EMAIL_FROM, to, subject: `🔔 ¡${productName} ya tiene stock! — PLATACO`, html }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error enviando email de stock');
}

export default router;

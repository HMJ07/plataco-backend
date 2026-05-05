// backend/routes/webhooks.js
// ============================================================
// Stripe envía eventos a esta URL cuando pasan cosas:
//   - Pago confirmado (payment_intent.succeeded)
//   - Pago fallido (payment_intent.payment_failed)
//   - Reembolso (charge.refunded)
// IMPORTANTE: Esta ruta recibe el body en RAW (sin parse JSON).
// Está configurado en server.js con express.raw()
// ============================================================
import { Router } from 'express';
import Stripe from 'stripe';
import { query } from './db.js';
import { sendOrderConfirmationEmail } from './email.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    // Verificar que el evento viene realmente de Stripe (no un atacante)
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Guardar el evento para auditoría (evitar duplicados con ON CONFLICT)
  try {
    await query(`
      INSERT INTO stripe_webhooks (event_id, event_type, payload)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id) DO NOTHING
    `, [event.id, event.type, JSON.stringify(event.data)]);
  } catch (err) {
    console.error('Error guardando webhook:', err);
  }

  // Procesar según el tipo de evento
  switch (event.type) {

    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      await query(
        `UPDATE payments SET status='succeeded' WHERE stripe_payment_intent_id=$1`,
        [pi.id]
      );
      console.log(`✅ Pago confirmado: ${pi.id} — ${pi.amount / 100} ${pi.currency.toUpperCase()}`);

      // Enviar email de confirmación al cliente
      try {
        // Recuperar datos del pedido
        const orderResult = await query(`
          SELECT o.*,
                 u.email AS user_email,
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
          WHERE o.id = (
            SELECT order_id FROM payments WHERE stripe_payment_intent_id = $1
          )
          GROUP BY o.id, u.email
        `, [pi.id]);

        const order = orderResult.rows[0];
        if (order) {
          const clientEmail = order.user_email || order.guest_email;
          await sendOrderConfirmationEmail(order, order.items || [], clientEmail);
          console.log(`📧 Email de confirmación enviado a ${clientEmail}`);
        }
      } catch (emailErr) {
        // El error de email NO debe bloquear el flujo del pedido
        console.error('Error enviando email de confirmación:', emailErr.message);
      }

      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await query(
        `UPDATE payments SET status='failed', failure_message=$1 WHERE stripe_payment_intent_id=$2`,
        [pi.last_payment_error?.message || 'Pago fallido', pi.id]
      );
      console.log(`❌ Pago fallido: ${pi.id}`);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const refundAmount = charge.amount_refunded / 100;
      await query(
        `UPDATE payments SET status='refunded', refund_amount_eur=$1 WHERE stripe_charge_id=$2`,
        [refundAmount, charge.id]
      );
      // Actualizar estado del pedido
      await query(`
        UPDATE orders SET status='refunded'
        WHERE id=(SELECT order_id FROM payments WHERE stripe_charge_id=$1)
      `, [charge.id]);
      console.log(`💸 Reembolso procesado: ${charge.id} — ${refundAmount}`);
      break;
    }

    default:
      console.log(`Evento Stripe no procesado: ${event.type}`);
  }

  // Siempre responder 200 a Stripe para confirmar recepción
  res.json({ received: true });
});

export default router;

// backend/routes/payments.js
// ============================================================
// Integración completa con Stripe
// ============================================================
import { Router } from 'express';
import Stripe from 'stripe';
import { query, withTransaction } from './db.js';
import { requireAuth } from './middleware_auth.js';
import { sendOrderConfirmationEmail } from './email.js';
import jwt from 'jsonwebtoken';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Tipos de cambio aproximados (en producción usa una API de divisas en tiempo real)
const EXCHANGE_RATES = { EUR: 1, USD: 1.08, GBP: 0.86, JPY: 163.2, CAD: 1.47, AUD: 1.65, CHF: 0.97 };

// ── POST /api/payments/create-intent ──────────────────────
// El frontend llama a esto ANTES de mostrar el formulario de tarjeta.
// Devuelve un client_secret que Stripe.js usa para confirmar el pago.
router.post('/create-intent', async (req, res) => {
  try {
    const { items, currency = 'EUR', shipping_address, coupon_code } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    // Calcular total verificando precios desde la base de datos (NUNCA confiar en el cliente)
    let total_eur = 0;
    const validatedItems = [];

    for (const item of items) {
      const productResult = await query(
        'SELECT id, name, price_eur, stock FROM products WHERE id=$1 AND is_active=TRUE',
        [item.product_id]
      );
      const product = productResult.rows[0];
      if (!product) return res.status(400).json({ error: `Producto no encontrado: ${item.product_id}` });
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuficiente: ${product.name}` });
      }

      let price_eur = parseFloat(product.price_eur);

      // Añadir precio extra de variante si hay
      if (item.variant_id) {
        const varResult = await query(
          'SELECT price_extra FROM product_variants WHERE id=$1 AND product_id=$2',
          [item.variant_id, item.product_id]
        );
        if (varResult.rows[0]) price_eur += parseFloat(varResult.rows[0].price_extra);
      }

      const subtotal = price_eur * item.quantity;
      total_eur += subtotal;
      validatedItems.push({ ...item, product_name: product.name, unit_price_eur: price_eur, subtotal_eur: subtotal });
    }

    // Calcular envío
    const shipping_eur = total_eur >= 80 ? 0 : 6.95;
    const subtotal_before_discount = total_eur;
    total_eur += shipping_eur;

    // ── Aplicar cupón de descuento ────────────────────────
    let discount_eur = 0;
    let appliedCoupon = null;

    if (coupon_code) {
      const couponRes = await query(
        `SELECT * FROM coupons
         WHERE code = UPPER($1)
           AND is_active = TRUE
           AND (valid_from IS NULL OR valid_from <= NOW())
           AND (valid_until IS NULL OR valid_until >= NOW())`,
        [coupon_code]
      );
      const coupon = couponRes.rows[0];

      if (coupon && (coupon.max_uses === null || coupon.uses_count < coupon.max_uses)) {
        if (subtotal_before_discount >= parseFloat(coupon.min_order_eur)) {
          if (coupon.discount_type === 'percent') {
            discount_eur = +(subtotal_before_discount * (parseFloat(coupon.discount_value) / 100)).toFixed(2);
          } else {
            discount_eur = +Math.min(parseFloat(coupon.discount_value), subtotal_before_discount).toFixed(2);
          }
          total_eur = +(total_eur - discount_eur).toFixed(2);
          appliedCoupon = { id: coupon.id, code: coupon.code, discount_eur };
        }
      }
    }

    // Convertir a la divisa del cliente
    const rate = EXCHANGE_RATES[currency] || 1;
    const total_customer = Math.round(total_eur * rate * 100); // en centavos

    // Crear PaymentIntent en Stripe
    // IMPORTANTE: Stripe limita cada campo de metadata a 500 chars.
    // Guardamos solo IDs+cantidades+precio (compacto). El nombre del
    // producto se recupera de la DB en confirm-order.
    const compactItems = validatedItems.map(i => ({
      pid: i.product_id,
      vid: i.variant_id || null,
      qty: i.quantity,
      eur: i.unit_price_eur,
    }));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total_customer,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        items_compact: JSON.stringify(compactItems),
        total_eur:     total_eur.toFixed(2),
        shipping_eur:  shipping_eur.toFixed(2),
        discount_eur:  discount_eur.toFixed(2),
        coupon_id:     appliedCoupon?.id || '',
        coupon_code:   appliedCoupon?.code || '',
        currency:      currency,
        exchange_rate: rate.toString(),
      },
    });

    res.json({
      client_secret:    paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      total_eur,
      shipping_eur,
      discount_eur,
      coupon: appliedCoupon,
      total_customer_currency: (total_customer / 100).toFixed(2),
      currency,
      validated_items: validatedItems,
    });

  } catch (err) {
    console.error('Error create-intent:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payments/confirm-order ──────────────────────
// Llamado por el frontend DESPUÉS de que Stripe confirma el pago.
// Crea el pedido en la base de datos.
// Middleware inline: intenta autenticar con JWT si viene el header,
// pero NO bloquea si no hay token (para invitados).

router.post('/confirm-order', (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch {
      req.user = null; // Token inválido → tratar como invitado
    }
  }
  next();
}, async (req, res) => {
  try {
    const {
      payment_intent_id,
      shipping_address,
      guest_email,
    } = req.body;

    // Verificar el pago con Stripe (no confiar en el cliente)
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'El pago no se ha completado' });
    }

    // Comprobar que no se ha procesado ya
    const existingPayment = await query(
      'SELECT id FROM payments WHERE stripe_payment_intent_id=$1',
      [payment_intent_id]
    );
    if (existingPayment.rows.length > 0) {
      return res.status(409).json({ error: 'Este pago ya ha sido procesado' });
    }

    const meta = paymentIntent.metadata;
    // Reconstruir items desde el formato compacto (items_compact)
    // o desde el formato antiguo (items_json) para retrocompatibilidad
    let items;
    if (meta.items_compact) {
      const compact = JSON.parse(meta.items_compact);
      // Recuperar nombres de producto desde la DB
      items = await Promise.all(compact.map(async (c) => {
        const pr = await query('SELECT name FROM products WHERE id=$1', [c.pid]);
        let variant_name = null;
        if (c.vid) {
          const vr = await query('SELECT name FROM product_variants WHERE id=$1', [c.vid]);
          variant_name = vr.rows[0]?.name || null;
        }
        return {
          product_id:    c.pid,
          variant_id:    c.vid,
          product_name:  pr.rows[0]?.name || 'Producto',
          variant_name,
          quantity:      c.qty,
          unit_price_eur: c.eur,
        };
      }));
    } else {
      items = JSON.parse(meta.items_json);
    }
    const total_eur = parseFloat(meta.total_eur);
    const shipping_eur = parseFloat(meta.shipping_eur);
    const discount_eur = parseFloat(meta.discount_eur || '0');
    const subtotal_eur = total_eur - shipping_eur + discount_eur;
    const coupon_id   = meta.coupon_id   || null;
    const coupon_code = meta.coupon_code || null;
    const user_id = req.user?.id || null;

    // Crear pedido y pago en una transacción
    const order = await withTransaction(async (client) => {
      // 1. Crear pedido
      const orderResult = await client.query(`
        INSERT INTO orders (
          user_id, guest_email, status,
          subtotal_eur, shipping_eur, discount_eur, total_eur,
          coupon_id, coupon_code,
          currency, total_customer_currency, exchange_rate,
          ship_first_name, ship_last_name, ship_address1, ship_address2,
          ship_city, ship_state, ship_postal_code, ship_country, ship_phone
        ) VALUES ($1,$2,'paid',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING *
      `, [
        user_id, guest_email || null,
        subtotal_eur, shipping_eur, discount_eur, total_eur,
        coupon_id, coupon_code,
        meta.currency, parseFloat(meta.total_eur) * parseFloat(meta.exchange_rate), parseFloat(meta.exchange_rate),
        shipping_address.first_name, shipping_address.last_name,
        shipping_address.address1, shipping_address.address2 || null,
        shipping_address.city, shipping_address.state || null,
        shipping_address.postal_code, shipping_address.country, shipping_address.phone || null,
      ]);
      const order = orderResult.rows[0];

      // 2. Insertar líneas de pedido y descontar stock
      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, product_variant_id, product_name, variant_name, unit_price_eur, quantity, subtotal_eur)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          order.id, item.product_id, item.variant_id || null,
          item.product_name, item.variant_name || null,
          item.unit_price_eur, item.quantity, item.unit_price_eur * item.quantity,
        ]);

        // Descontar stock
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      // 3. Registrar el pago
      const charge = paymentIntent.latest_charge;
      await client.query(`
        INSERT INTO payments (order_id, stripe_payment_intent_id, stripe_charge_id, amount_eur, currency, status, payment_method)
        VALUES ($1,$2,$3,$4,$5,'succeeded',$6)
      `, [order.id, payment_intent_id, charge || null, total_eur, meta.currency, 'card']);

      // 4. Registrar uso de cupón y actualizar contador
      if (coupon_id && discount_eur > 0) {
        await client.query(
          `INSERT INTO coupon_uses (coupon_id, order_id, user_id, discount_eur)
           VALUES ($1, $2, $3, $4)`,
          [coupon_id, order.id, user_id, discount_eur]
        );
        await client.query(
          'UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1',
          [coupon_id]
        );
      }

      return order;
    });

    res.json({
      success: true,
      order_id: order.id,
      message: 'Pedido creado correctamente',
    });

    // Enviar email de confirmación (después de responder para no bloquear)
    // Prioridad: guest_email del body → email del JWT → email de la BD por user_id
    (async () => {
      try {
        let emailAddress = guest_email || req.user?.email || null;

        // Si hay user_id pero aún no tenemos email, buscarlo en la BD
        if (!emailAddress && req.user?.id) {
          const userRow = await query('SELECT email FROM users WHERE id=$1', [req.user.id]);
          emailAddress = userRow.rows[0]?.email || null;
        }

        if (!emailAddress) {
          console.warn('No se encontró email para confirmar pedido', order.id);
          return;
        }

        const itemsForEmail = items.map(i => ({
          product_name: i.product_name,
          variant_name: i.variant_name || null,
          quantity:     i.quantity,
          subtotal_eur: i.unit_price_eur * i.quantity,
        }));
        await sendOrderConfirmationEmail(order, itemsForEmail, emailAddress);
        console.log('Email confirmación enviado a ' + emailAddress + ' (pedido #' + order.id + ')');
      } catch (e) {
        console.error('Error enviando email confirmación:', e);
      }
    })();

  } catch (err) {
    console.error('Error confirm-order:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payments/order/:id ────────────────────────────
router.get('/order/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT o.*, p.status AS payment_status, p.card_brand, p.card_last4,
        json_agg(json_build_object(
          'product_name',oi.product_name,
          'variant_name',oi.variant_name,
          'quantity',oi.quantity,
          'unit_price_eur',oi.unit_price_eur,
          'subtotal_eur',oi.subtotal_eur
        )) AS items
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id=$1 AND (o.user_id=$2 OR $3='admin')
      GROUP BY o.id, p.status, p.card_brand, p.card_last4
    `, [req.params.id, req.user.id, req.user.role]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

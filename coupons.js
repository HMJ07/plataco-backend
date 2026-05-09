// backend/routes/coupons.js
// ============================================================
// Cupones de descuento
// ============================================================
import { Router } from 'express';
import { query } from './db.js';
import { requireAuth } from './middleware_auth.js';

const router = Router();

// ── POST /api/coupons/validate ─────────────────────────────
// Valida un cupón y devuelve el descuento calculado
// Body: { code, cart_total_eur }
router.post('/validate', async (req, res) => {
  try {
    const { code, cart_total_eur } = req.body;

    if (!code) return res.status(400).json({ error: 'Código de cupón requerido' });

    const couponRes = await query(
      `SELECT * FROM coupons
       WHERE code = UPPER($1)
         AND is_active = TRUE
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())`,
      [code]
    );

    if (!couponRes.rows[0]) {
      return res.status(404).json({ error: 'Cupón inválido o caducado' });
    }

    const coupon = couponRes.rows[0];

    // Verificar usos totales
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
      return res.status(400).json({ error: 'Este cupón ha alcanzado el límite de usos' });
    }

    // Verificar pedido mínimo
    const total = parseFloat(cart_total_eur) || 0;
    if (total < parseFloat(coupon.min_order_eur)) {
      return res.status(400).json({
        error: `Pedido mínimo de ${coupon.min_order_eur} € para este cupón`,
        min_order_eur: coupon.min_order_eur,
      });
    }

    // Verificar usos por usuario (si está autenticado)
    let userUses = 0;
    if (req.headers.authorization) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.default.verify(token, process.env.JWT_SECRET);
        const usesRes = await query(
          'SELECT COUNT(*) FROM coupon_uses WHERE coupon_id=$1 AND user_id=$2',
          [coupon.id, payload.id]
        );
        userUses = parseInt(usesRes.rows[0].count);
      } catch (_) {
        // Token inválido — ignorar silenciosamente
      }
    }

    if (coupon.max_uses_per_user !== null && userUses >= coupon.max_uses_per_user) {
      return res.status(400).json({ error: 'Ya has utilizado este cupón' });
    }

    // Calcular descuento
    let discount_eur = 0;
    if (coupon.discount_type === 'percent') {
      discount_eur = +(total * (parseFloat(coupon.discount_value) / 100)).toFixed(2);
    } else {
      discount_eur = +Math.min(parseFloat(coupon.discount_value), total).toFixed(2);
    }

    res.json({
      valid: true,
      coupon_id:      coupon.id,
      code:           coupon.code,
      description:    coupon.description,
      discount_type:  coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_eur,
      new_total_eur:  +(total - discount_eur).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// backend/routes/reviews.js
// ============================================================
// Valoraciones y Reseñas de productos
// ============================================================
import { Router } from 'express';
import { query } from './db.js';
import { requireAuth } from './middleware_auth.js';

const router = Router();

// ── GET /api/reviews/:productSlug ─────────────────────────
// Reseñas públicas de un producto, con paginación
router.get('/:productSlug', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const sortMap = {
      recent:     'r.created_at DESC',
      oldest:     'r.created_at ASC',
      rating_asc: 'r.rating ASC',
      rating_desc:'r.rating DESC',
    };
    const orderBy = sortMap[sort] || 'r.created_at DESC';

    const result = await query(`
      SELECT
        r.id, r.rating, r.title, r.body, r.is_verified,
        r.created_at,
        u.first_name, LEFT(u.last_name, 1) || '.' AS last_initial
      FROM product_reviews r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE p.slug = $1 AND r.is_approved = TRUE
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `, [req.params.productSlug, parseInt(limit), offset]);

    const countResult = await query(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(r.rating), 2) AS avg_rating,
        COUNT(*) FILTER (WHERE r.rating = 5) AS five_stars,
        COUNT(*) FILTER (WHERE r.rating = 4) AS four_stars,
        COUNT(*) FILTER (WHERE r.rating = 3) AS three_stars,
        COUNT(*) FILTER (WHERE r.rating = 2) AS two_stars,
        COUNT(*) FILTER (WHERE r.rating = 1) AS one_star
      FROM product_reviews r
      JOIN products p ON p.id = r.product_id
      WHERE p.slug = $1 AND r.is_approved = TRUE
    `, [req.params.productSlug]);

    res.json({
      reviews: result.rows,
      summary: countResult.rows[0],
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reviews/:productSlug ────────────────────────
// Enviar una reseña (usuario autenticado)
router.post('/:productSlug', requireAuth, async (req, res) => {
  try {
    const { rating, title, body } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'La puntuación debe ser entre 1 y 5' });
    }

    // Obtener el producto
    const productRes = await query(
      'SELECT id FROM products WHERE slug = $1 AND is_active = TRUE',
      [req.params.productSlug]
    );
    if (!productRes.rows[0]) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const productId = productRes.rows[0].id;

    // Comprobar si el usuario compró el producto (reseña verificada)
    const purchaseRes = await query(`
      SELECT o.id FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
        AND oi.product_id = $2
        AND o.status IN ('delivered', 'shipped', 'paid', 'processing')
      LIMIT 1
    `, [req.user.id, productId]);
    const isVerified = purchaseRes.rows.length > 0;
    const orderId    = isVerified ? purchaseRes.rows[0].id : null;

    const result = await query(`
      INSERT INTO product_reviews (product_id, user_id, order_id, rating, title, body, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (product_id, user_id)
        DO UPDATE SET rating=$4, title=$5, body=$6, updated_at=NOW()
      RETURNING *
    `, [productId, req.user.id, orderId, rating, title || null, body || null, isVerified]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/reviews/:id ────────────────────────────────
// El usuario puede borrar su propia reseña
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM product_reviews WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Reseña no encontrada o no autorizado' });
    }
    res.json({ message: 'Reseña eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

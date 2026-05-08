// backend/routes/favorites.js
import { Router } from 'express';
import { query } from './db.js';
import { requireAuth } from './middleware_auth.js';

const router = Router();

// ── GET /api/auth/favorites/ids ────────────────────────────
// Devuelve solo los IDs de favoritos del usuario (para UI rápida)
router.get('/ids', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT product_id FROM favorites WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows.map(r => r.product_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/favorites ────────────────────────────────
// Devuelve los productos completos favoritos del usuario
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        p.id, p.name, p.slug, p.price_eur, p.material, p.badge, p.stock,
        c.name AS category_name, c.slug AS category_slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS image_url,
        f.created_at AS favorited_at
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/favorites/:productId ───────────────────
// Añade un producto a favoritos
router.post('/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    // Verificar que el producto existe
    const product = await query('SELECT id FROM products WHERE id = $1 AND is_active = TRUE', [productId]);
    if (!product.rows[0]) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await query(
      'INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, productId]
    );

    res.status(201).json({ message: 'Añadido a favoritos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/auth/favorites/:productId ─────────────────
// Elimina un producto de favoritos
router.delete('/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    await query(
      'DELETE FROM favorites WHERE user_id = $1 AND product_id = $2',
      [req.user.id, productId]
    );
    res.json({ message: 'Eliminado de favoritos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

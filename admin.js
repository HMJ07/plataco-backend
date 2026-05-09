// backend/routes/admin.js
import { Router } from 'express';
import { query } from './db.js';
import { requireAdmin } from './middleware_auth.js';
import { upload, uploadToCloudinary, deleteFromCloudinary } from './cloudinary.js';

const router = Router();
router.use(requireAdmin); // Todas las rutas requieren rol admin

// ── GET /api/admin/dashboard ───────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [orders, revenue, products, customers] = await Promise.all([
      query(`SELECT COUNT(*) FROM orders WHERE status='paid'`),
      query(`SELECT COALESCE(SUM(total_eur),0) AS total FROM orders WHERE status IN ('paid','processing','shipped','delivered')`),
      query(`SELECT COUNT(*) FROM products WHERE is_active=TRUE`),
      query(`SELECT COUNT(*) FROM users WHERE role='customer'`),
    ]);

    const recentOrders = await query(`
      SELECT o.id, o.status, o.total_eur, o.currency, o.created_at,
             u.email, u.first_name, u.last_name,
             o.guest_email
      FROM orders o
      LEFT JOIN users u ON u.id=o.user_id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    res.json({
      stats: {
        total_orders:    parseInt(orders.rows[0].count),
        total_revenue:   parseFloat(revenue.rows[0].total),
        active_products: parseInt(products.rows[0].count),
        total_customers: parseInt(customers.rows[0].count),
      },
      recent_orders: recentOrders.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/products ────────────────────────────────
// Devuelve productos con su imagen principal incluida
router.get('/products', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        p.*,
        c.name AS category_name,
        pi.url        AS main_image_url,
        pi.url_thumb  AS main_image_thumb,
        pi.url_medium AS main_image_medium
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT url, url_thumb, url_medium
        FROM product_images
        WHERE product_id = p.id
        ORDER BY position ASC
        LIMIT 1
      ) pi ON TRUE
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/products ───────────────────────────────
router.post('/products', async (req, res) => {
  try {
    const {
      name, slug, description, material, price_eur,
      stock, category_id, badge, weight_grams, purity, finish, is_featured,
    } = req.body;
    const result = await query(`
      INSERT INTO products
        (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [name, slug, description, material, price_eur, stock || 0, category_id, badge, weight_grams, purity || '925', finish, is_featured || false]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/products/:id ────────────────────────────
router.put('/products/:id', async (req, res) => {
  try {
    const { name, description, material, price_eur, stock, badge, is_active, is_featured } = req.body;
    const result = await query(`
      UPDATE products SET name=$1, description=$2, material=$3, price_eur=$4,
        stock=$5, badge=$6, is_active=$7, is_featured=$8
      WHERE id=$9 RETURNING *
    `, [name, description, material, price_eur, stock, badge, is_active, is_featured, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// IMÁGENES DE PRODUCTO
// ══════════════════════════════════════════════════════════════

// ── GET /api/admin/products/:id/images ────────────────────
// Lista todas las imágenes de un producto ordenadas por posición
router.get('/products/:id/images', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM product_images
      WHERE product_id = $1
      ORDER BY position ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/products/:id/images ───────────────────
// Sube una o varias imágenes (campo: "images", máx 10 archivos)
router.post('/products/:id/images', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    }

    // Calcular la posición de la próxima imagen
    const posResult = await query(`
      SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
      FROM product_images WHERE product_id = $1
    `, [req.params.id]);
    let nextPos = parseInt(posResult.rows[0].next_pos);

    const uploaded = [];

    for (const file of req.files) {
      // Subir a Cloudinary
      const cloudResult = await uploadToCloudinary(file.buffer, {
        folder: `plataco/products/${req.params.id}`,
      });

      // Guardar en base de datos
      const alt = req.body.alt_text || '';
      const dbResult = await query(`
        INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [req.params.id, cloudResult.cloudinary_id, cloudResult.url, cloudResult.url_thumb, cloudResult.url_medium, nextPos, alt]);

      uploaded.push(dbResult.rows[0]);
      nextPos++;
    }

    res.status(201).json(uploaded);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/products/:id/images/:imageId ────────
// Elimina una imagen de Cloudinary y de la base de datos
router.delete('/products/:id/images/:imageId', async (req, res) => {
  try {
    const imgResult = await query(`
      SELECT * FROM product_images WHERE id = $1 AND product_id = $2
    `, [req.params.imageId, req.params.id]);

    if (!imgResult.rows[0]) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Borrar de Cloudinary
    await deleteFromCloudinary(imgResult.rows[0].cloudinary_id);

    // Borrar de la base de datos
    await query(`DELETE FROM product_images WHERE id = $1`, [req.params.imageId]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/products/:id/images/reorder ────────────
// Reordena las imágenes. Body: { order: ["uuid1", "uuid2", ...] }
// El primer UUID de la lista será la foto principal (position = 0)
router.put('/products/:id/images/reorder', async (req, res) => {
  try {
    const { order } = req.body; // array de IDs en el nuevo orden
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Se esperaba un array "order"' });
    }

    // Actualizar cada posición
    await Promise.all(
      order.map((imageId, index) =>
        query(`
          UPDATE product_images SET position = $1
          WHERE id = $2 AND product_id = $3
        `, [index, imageId, req.params.id])
      )
    );

    // Devolver las imágenes ya reordenadas
    const result = await query(`
      SELECT * FROM product_images WHERE product_id = $1 ORDER BY position ASC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/products/:id/images/:imageId ───────────
// Actualiza el alt_text de una imagen
router.put('/products/:id/images/:imageId', async (req, res) => {
  try {
    const { alt_text } = req.body;
    const result = await query(`
      UPDATE product_images SET alt_text = $1
      WHERE id = $2 AND product_id = $3
      RETURNING *
    `, [alt_text, req.params.imageId, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
// PEDIDOS (sin cambios)
// ══════════════════════════════════════════════════════════════

// ── GET /api/admin/orders ──────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    const params = [limit, offset];
    let where = '';
    if (status) { params.unshift(status); where = `WHERE o.status=$1`; }

    const result = await query(`
      SELECT o.id, o.status, o.total_eur, o.currency, o.created_at,
             o.ship_first_name, o.ship_last_name, o.ship_country,
             o.tracking_number, u.email, o.guest_email,
             p.status AS payment_status
      FROM orders o
      LEFT JOIN users u ON u.id=o.user_id
      LEFT JOIN payments p ON p.order_id=o.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/orders/:id ─────────────────────────────
router.get('/orders/:id', async (req, res) => {
  try {
    const orderResult = await query(`
      SELECT
        o.*,
        u.email        AS user_email,
        u.first_name   AS user_first_name,
        u.last_name    AS user_last_name,
        u.phone        AS user_phone,
        p.status       AS payment_status,
        p.stripe_payment_intent_id,
        p.stripe_charge_id,
        p.amount_eur   AS payment_amount_eur,
        p.currency     AS payment_currency,
        p.payment_method,
        p.card_brand,
        p.card_last4,
        p.failure_message,
        p.refund_amount_eur,
        p.created_at   AS payment_created_at
      FROM orders o
      LEFT JOIN users u    ON u.id = o.user_id
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.id = $1
    `, [req.params.id]);

    if (!orderResult.rows[0]) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const itemsResult = await query(`
      SELECT
        oi.*,
        p.name         AS current_product_name,
        p.slug         AS product_slug,
        p.is_active    AS product_is_active
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at
    `, [req.params.id]);

    res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/orders/:id/status ──────────────────────
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status, tracking_number } = req.body;
    const validStatuses = ['pending','paid','processing','shipped','delivered','cancelled','refunded'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Estado inválido' });

    const result = await query(`
      UPDATE orders SET status=$1, tracking_number=$2,
        shipped_at   = CASE WHEN $1='shipped'   THEN NOW() ELSE shipped_at   END,
        delivered_at = CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END
      WHERE id=$3 RETURNING *
    `, [status, tracking_number || null, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN — Gestión de reseñas
// ============================================================

// GET /api/admin/reviews — Listar todas las reseñas pendientes o todas
router.get('/reviews', async (req, res) => {
  try {
    const { approved } = req.query; // 'true' | 'false' | undefined (todas)
    const conditions = [];
    const params = [];
    if (approved !== undefined) {
      params.push(approved === 'true');
      conditions.push(`r.is_approved = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT r.*, p.name AS product_name, p.slug AS product_slug,
             u.email AS user_email, u.first_name, u.last_name
      FROM product_reviews r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN users u ON u.id = r.user_id
      ${where}
      ORDER BY r.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/reviews/:id — Aprobar / rechazar reseña
router.put('/reviews/:id', async (req, res) => {
  try {
    const { is_approved } = req.body;
    const result = await query(
      'UPDATE product_reviews SET is_approved=$1 WHERE id=$2 RETURNING *',
      [is_approved, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Reseña no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
  try {
    await query('DELETE FROM product_reviews WHERE id=$1', [req.params.id]);
    res.json({ message: 'Reseña eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN — Gestión de cupones
// ============================================================

// GET /api/admin/coupons
router.get('/coupons', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM coupon_uses WHERE coupon_id = c.id) AS actual_uses
      FROM coupons c
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/coupons
router.post('/coupons', async (req, res) => {
  try {
    const {
      code, description, discount_type, discount_value,
      min_order_eur, max_uses, max_uses_per_user, valid_from, valid_until,
    } = req.body;

    if (!['percent','fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'discount_type debe ser "percent" o "fixed"' });
    }

    const result = await query(`
      INSERT INTO coupons
        (code, description, discount_type, discount_value, min_order_eur,
         max_uses, max_uses_per_user, valid_from, valid_until)
      VALUES (UPPER($1),$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      code, description || null, discount_type, discount_value,
      min_order_eur || 0, max_uses || null, max_uses_per_user || 1,
      valid_from || null, valid_until || null,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un cupón con ese código' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/coupons/:id
router.put('/coupons/:id', async (req, res) => {
  try {
    const {
      description, discount_type, discount_value,
      min_order_eur, max_uses, max_uses_per_user,
      valid_from, valid_until, is_active,
    } = req.body;

    const result = await query(`
      UPDATE coupons SET
        description=$1, discount_type=$2, discount_value=$3,
        min_order_eur=$4, max_uses=$5, max_uses_per_user=$6,
        valid_from=$7, valid_until=$8, is_active=$9
      WHERE id=$10 RETURNING *
    `, [
      description || null, discount_type, discount_value,
      min_order_eur || 0, max_uses || null, max_uses_per_user || 1,
      valid_from || null, valid_until || null, is_active !== false,
      req.params.id,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Cupón no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/coupons/:id
router.delete('/coupons/:id', async (req, res) => {
  try {
    await query('DELETE FROM coupons WHERE id=$1', [req.params.id]);
    res.json({ message: 'Cupón eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

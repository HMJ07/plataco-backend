-- ============================================================
-- PLATACO — Migración: galería de imágenes por producto
-- Ejecutar en Railway: psql $DATABASE_URL -f add_product_images.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS product_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cloudinary_id   TEXT NOT NULL,          -- public_id de Cloudinary (para borrar)
  url             TEXT NOT NULL,          -- URL optimizada (https://res.cloudinary.com/...)
  url_thumb       TEXT,                   -- Miniatura 200×200
  url_medium      TEXT,                   -- Tamaño medio 600×600
  position        INT  NOT NULL DEFAULT 0, -- Orden en la galería (0 = foto principal)
  alt_text        TEXT,                   -- Texto alternativo (SEO/accesibilidad)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_position   ON product_images(product_id, position);

-- Vista útil para el frontend: productos con su foto principal
CREATE OR REPLACE VIEW products_with_main_image AS
SELECT
  p.*,
  pi.url          AS main_image_url,
  pi.url_thumb    AS main_image_thumb,
  pi.url_medium   AS main_image_medium,
  pi.alt_text     AS main_image_alt
FROM products p
LEFT JOIN LATERAL (
  SELECT * FROM product_images
  WHERE product_id = p.id
  ORDER BY position ASC
  LIMIT 1
) pi ON TRUE;

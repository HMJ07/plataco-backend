-- ============================================================
-- PLATACO — Migración: Valoraciones, Stock visible, Cupones
-- Segura y reidempotente (IF NOT EXISTS / ON CONFLICT)
-- ============================================================

-- ============================================================
-- 1. VALORACIONES Y RESEÑAS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       VARCHAR(150),
  body        TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user    ON product_reviews(user_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_avg   NUMERIC(3,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION refresh_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET
    review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = TRUE),
    rating_avg   = (SELECT COALESCE(AVG(rating),0) FROM product_reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = TRUE)
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_rating ON product_reviews;
CREATE TRIGGER trg_refresh_rating
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

-- ============================================================
-- 2. STOCK VISIBLE
-- ============================================================
CREATE OR REPLACE VIEW product_stock_status AS
SELECT
  id,
  slug,
  stock,
  CASE
    WHEN stock = 0   THEN 'sin_stock'
    WHEN stock <= 3  THEN 'pocas_unidades'
    WHEN stock <= 10 THEN 'stock_bajo'
    ELSE                  'disponible'
  END AS stock_label,
  CASE
    WHEN stock > 0 AND stock <= 10 THEN TRUE
    ELSE FALSE
  END AS show_stock_count
FROM products
WHERE is_active = TRUE;

-- ============================================================
-- 3. CUPONES DE DESCUENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              VARCHAR(50)  UNIQUE NOT NULL,
  description       VARCHAR(255),
  discount_type     VARCHAR(20)  NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value    NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_eur     NUMERIC(10,2) DEFAULT 0,
  max_uses          INTEGER,
  max_uses_per_user INTEGER      DEFAULT 1,
  uses_count        INTEGER      DEFAULT 0,
  valid_from        TIMESTAMPTZ  DEFAULT NOW(),
  valid_until       TIMESTAMPTZ,
  is_active         BOOLEAN      DEFAULT TRUE,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id    UUID         REFERENCES coupons(id),
  order_id     UUID         REFERENCES orders(id),
  user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
  discount_eur NUMERIC(10,2) NOT NULL,
  used_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon ON coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user   ON coupon_uses(user_id);

-- Columnas en coupons (se añaden solo si no existen — por si la tabla fue creada con una versión anterior)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_eur     NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses          INTEGER;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS uses_count        INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_from        TIMESTAMPTZ;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_until       TIMESTAMPTZ;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active         BOOLEAN DEFAULT TRUE;

-- Columnas en orders (se añaden solo si no existen)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id    UUID REFERENCES coupons(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_eur NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code  VARCHAR(50);

-- Cupones de ejemplo (idempotente)
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_eur, max_uses, valid_until)
VALUES
  ('BIENVENIDA10', '10% descuento en tu primer pedido', 'percent', 10,  0,   NULL, NOW() + INTERVAL '1 year'),
  ('VERANO5',      '5 EUR de descuento en verano',       'fixed',    5,  30,  500,  NOW() + INTERVAL '6 months'),
  ('PLATACO20',    '20% especial para socios',           'percent',  20, 50,  100,  NULL)
ON CONFLICT (code) DO NOTHING;

-- Verificación final
SELECT 'coupons' AS tabla, COUNT(*) AS filas FROM coupons
UNION ALL
SELECT 'coupon_uses', COUNT(*) FROM coupon_uses;

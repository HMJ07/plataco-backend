-- ============================================================
-- PLATACO — Migración: Carrito Abandonado + Alertas de Stock
-- ============================================================
-- Ejecutar en la base de datos de producción una sola vez.
-- ============================================================

-- 1. Columna checkout_started_at en orders (si no existe)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMPTZ;

-- 2. Tabla de logs para carrito abandonado
--    Evita enviar el mismo email dos veces al mismo pedido.
CREATE TABLE IF NOT EXISTS abandoned_cart_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT abandoned_cart_logs_order_id_unique UNIQUE (order_id)
);

-- 3. Tabla de alertas de stock
CREATE TABLE IF NOT EXISTS stock_alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  CONSTRAINT stock_alerts_product_email_unique UNIQUE (product_id, email)
);

-- Índice para acelerar la búsqueda de alertas pendientes por producto
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_notified
  ON stock_alerts (product_id, notified_at)
  WHERE notified_at IS NULL;

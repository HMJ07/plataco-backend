-- ============================================================
-- PLATACO — Migración: lista de favoritos
-- Ejecutar en Railway: psql $DATABASE_URL -f add_favorites.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)   -- Un usuario no puede favoritar el mismo producto dos veces
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id    ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);

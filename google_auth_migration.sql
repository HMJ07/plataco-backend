-- ============================================================
-- PLATACO — Migración: soporte para Google OAuth
-- Ejecutar en Railway: psql $DATABASE_URL -f google_auth_migration.sql
-- ============================================================

-- 1. Añadir columna google_id a la tabla users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- 2. Hacer password_hash opcional (usuarios de Google no tienen contraseña)
ALTER TABLE users
  ALTER COLUMN password_hash SET DEFAULT '';

-- 3. Índice para búsquedas rápidas por google_id
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
  WHERE google_id IS NOT NULL;

-- ============================================================
-- Nota: Ejecutar también add_favorites.sql si no lo has hecho:
--   psql $DATABASE_URL -f add_favorites.sql
-- ============================================================

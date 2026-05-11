-- ============================================================
-- PLATACO — Migración: tokens para recuperación de contraseña
-- Ejecutar: psql $DATABASE_URL -f add_password_reset.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256 del token (nunca guardamos el token en claro)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  used_at    TIMESTAMPTZ,                   -- NULL = no usado todavía
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token  ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user   ON password_reset_tokens(user_id);

-- Limpieza automática de tokens caducados (opcional pero recomendado)
-- Puedes llamar a esto con un cron job diario:
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '1 day';

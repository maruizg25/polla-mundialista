-- ============================================================
--  MIGRACIÓN — QUITAR JUGADORES (que no puedan volver a entrar)
--  ------------------------------------------------------------
--  Pega esto en Supabase -> SQL Editor -> Run (seguro y repetible).
-- ============================================================

-- Marca de "bloqueado": cuando el organizador quita a un jugador,
-- se marca aquí y ya no puede volver a entrar (ni recrearse al loguear).
alter table jugadores add column if not exists bloqueado boolean default false;

-- ============================================================
--  MIGRACIÓN v2 — PRONÓSTICO 1X2 (Local / Empate / Visita)
--  ------------------------------------------------------------
--  Pega esto en Supabase -> SQL Editor -> Run (es seguro y se
--  puede repetir). Hazlo ANTES de publicar el código de la v2.
-- ============================================================

-- El pronóstico de cada jugador ahora es un resultado: 'L', 'E' o 'V'
alter table predicciones add column if not exists resultado text;

-- El resultado oficial de cada partido también es 'L', 'E' o 'V'
alter table partidos add column if not exists resultado text;

-- ============================================================
--  MIGRACIÓN — SISTEMA DE 3 FASES
--  ------------------------------------------------------------
--  Pega esto en Supabase -> SQL Editor -> Run (seguro y repetible).
--  Hazlo ANTES de publicar el código con las fases.
-- ============================================================

-- Configuración de las fases (grupos / eliminatorias / final): abierta + premio
alter table config add column if not exists fases jsonb;

-- Etiqueta de ronda para los partidos de eliminatoria (Octavos, Cuartos, etc.)
alter table partidos add column if not exists ronda text;

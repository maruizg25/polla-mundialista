-- ============================================================
--  MIGRACIÓN COMPLETA v2  (todos los cambios de una)
--  ------------------------------------------------------------
--  Pega TODO esto en Supabase -> SQL Editor -> New query -> Run.
--  Es seguro y se puede repetir. Hazlo ANTES de publicar la v2.
--
--  Incluye: pronóstico 1X2 + 3 fases + login con correo.
-- ============================================================

-- 1) PRONÓSTICO 1X2 (Local / Empate / Visita)
alter table predicciones add column if not exists resultado text;
alter table partidos     add column if not exists resultado text;

-- 2) TRES FASES (grupos / eliminatorias / final)
alter table config   add column if not exists fases jsonb;
alter table partidos add column if not exists ronda text;

-- 3) LOGIN CON CORREO (Supabase Auth)
alter table jugadores add column if not exists email text;

-- 4) Limpia los jugadores de PRUEBA del sistema anterior (entraban con
--    nombre + PIN, sin correo, y no podrán iniciar sesión con el login
--    nuevo). Borra también sus predicciones (en cascada). Como el Mundial
--    aún no empieza, no se pierde nada real.
--    >>> Si quieres conservarlos, NO corras la línea de abajo. <<<
delete from jugadores where email is null;

-- ============================================================
--  MIGRACIÓN — LOGIN CON CORREO Y CONTRASEÑA (Supabase Auth)
--  ------------------------------------------------------------
--  Pega esto en Supabase -> SQL Editor -> Run.
--  Hazlo ANTES de publicar el código con login.
-- ============================================================

-- 1) Columna de correo: enlaza la cuenta (Auth) con el jugador.
alter table jugadores add column if not exists email text;

-- 2) Limpia los jugadores de PRUEBA del sistema anterior (entraban con
--    nombre + PIN, sin correo, y NO podrán iniciar sesión con el nuevo
--    login). Esto deja la base limpia para las cuentas reales.
--    Borra también sus predicciones (en cascada). Como el Mundial aún no
--    empieza, no se pierde nada real.
--    >>> Si por algo quieres conservarlos, NO corras esta línea. <<<
delete from jugadores where email is null;

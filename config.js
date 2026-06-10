/* ============================================================
   CONFIGURACIÓN DE CONEXIÓN
   ------------------------------------------------------------
   👉 Para jugar EN LÍNEA con tus amigos (datos compartidos),
      pega aquí las 2 claves de tu proyecto gratis de Supabase.
      (En el archivo GUIA-PUBLICAR.md están los pasos con clics.)

   Si dejas estas claves vacías, la app funciona en "modo local"
   (solo en este equipo) — ideal para probar antes de publicar.
   ============================================================ */

const SUPABASE_URL  = 'https://mvauujppcrdxfvmsimqt.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_tCClRjUeo1PK_A6XXABZ5g_FUWRs4BF';
// Clave de alta para la cuenta administradora (solo frontend).
const CLAVE_ADMIN   = 'ADMIN-2026';

/* --- No necesitas tocar nada de aquí para abajo --- */
const MODO_ONLINE = Boolean(SUPABASE_URL && SUPABASE_KEY);

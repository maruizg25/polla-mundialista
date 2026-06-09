-- ============================================================
--  BASE DE DATOS DE LA POLLA MUNDIALISTA (para Supabase)
--  ------------------------------------------------------------
--  Copia TODO este archivo y pégalo en:
--    Supabase  ->  SQL Editor  ->  New query  ->  Run
--  Crea las tablas, los permisos y el tiempo real.
--  (Ver pasos con clics en GUIA-PUBLICAR.md)
-- ============================================================

-- ---------- TABLAS ----------
create table if not exists config (
  id            int primary key default 1,
  nombre        text,
  codigo        text,
  moneda        text,
  monto         int,
  monto_partido int default 2,
  puntos        jsonb,
  campeon_real  text,
  subcampeon_real text
);

create table if not exists jugadores (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  color          text,
  pago           boolean default false,
  abonado        int default 0,
  es_organizador boolean default false,
  pin            text default '',
  creado         timestamptz default now()
);

create table if not exists partidos (
  id           text primary key,
  orden        int,
  grupo        text,
  fase         text,
  local        text,
  visita       text,
  fecha        text,
  estadio      text,
  jugado       boolean default false,
  goles_local  int,
  goles_visita int
);

create table if not exists predicciones (
  jugador_id uuid references jugadores(id) on delete cascade,
  partido_id text references partidos(id) on delete cascade,
  local      int,
  visita     int,
  primary key (jugador_id, partido_id)
);

create table if not exists picks_final (
  jugador_id uuid primary key references jugadores(id) on delete cascade,
  campeon    text,
  subcampeon text
);

create table if not exists apuestas (
  jugador_id uuid references jugadores(id) on delete cascade,
  partido_id text references partidos(id) on delete cascade,
  pago       boolean default false,
  primary key (jugador_id, partido_id)
);

-- ---------- PERMISOS ----------
-- Seguridad "casual" para un grupo privado de amigos: cualquiera
-- con la clave pública (anon) y el código de invitación puede jugar.
-- Si más adelante quieres seguridad fuerte, se cambia por login real.
alter table config       enable row level security;
alter table jugadores    enable row level security;
alter table partidos     enable row level security;
alter table predicciones enable row level security;
alter table picks_final  enable row level security;
alter table apuestas     enable row level security;

create policy "acceso_grupo" on config       for all using (true) with check (true);
create policy "acceso_grupo" on jugadores    for all using (true) with check (true);
create policy "acceso_grupo" on partidos     for all using (true) with check (true);
create policy "acceso_grupo" on predicciones for all using (true) with check (true);
create policy "acceso_grupo" on picks_final  for all using (true) with check (true);
create policy "acceso_grupo" on apuestas     for all using (true) with check (true);

-- ---------- TIEMPO REAL ----------
-- Para que los cambios (resultados, predicciones) aparezcan al
-- instante en el celular de todos.
alter publication supabase_realtime add table config;
alter publication supabase_realtime add table jugadores;
alter publication supabase_realtime add table partidos;
alter publication supabase_realtime add table predicciones;
alter publication supabase_realtime add table picks_final;
alter publication supabase_realtime add table apuestas;

-- ¡Listo! Los partidos y la configuración se crean solos la
-- primera vez que abras la app con tus claves puestas.

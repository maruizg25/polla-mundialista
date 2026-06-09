-- ============================================================
--  MIGRACIÓN: ABONOS + APUESTAS POR PARTIDO
--  ------------------------------------------------------------
--  Pega TODO esto en Supabase -> SQL Editor -> New query -> Run.
--  Es SEGURO correrlo (no borra nada y se puede repetir).
--  Hazlo ANTES de publicar el código nuevo.
-- ============================================================

-- 1) Cuánto ha abonado cada jugador de su cuota del bote general
alter table jugadores add column if not exists abonado int default 0;

-- 2) Monto que cuesta entrar a la apuesta de un partido
alter table config add column if not exists monto_partido int default 2;

-- 3) Apuestas por partido: quién entró a cada partido y si ya pagó
create table if not exists apuestas (
  jugador_id uuid references jugadores(id) on delete cascade,
  partido_id text references partidos(id) on delete cascade,
  pago       boolean default false,
  primary key (jugador_id, partido_id)
);

-- Permiso de acceso (igual que las demás tablas)
alter table apuestas enable row level security;
do $$ begin
  create policy "acceso_grupo" on apuestas for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 4) Tiempo real para las apuestas
do $$ begin
  alter publication supabase_realtime add table apuestas;
exception when duplicate_object then null; end $$;

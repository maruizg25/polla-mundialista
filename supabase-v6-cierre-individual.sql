-- Cierre individual de pronosticos por jugador.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.cierres_pronosticos (
  jugador_id uuid primary key references public.jugadores(id) on delete cascade,
  cerrado boolean not null default false,
  cerrado_en timestamptz null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_cierres_pronosticos_cerrado
  on public.cierres_pronosticos(cerrado);

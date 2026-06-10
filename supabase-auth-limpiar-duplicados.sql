-- Limpieza manual para Supabase Auth y datos de la polla.
-- Ejecutar en el SQL Editor de Supabase.
--
-- Qué hace:
-- 1) Conserva el usuario Auth más antiguo por correo.
-- 2) Borra los usuarios Auth duplicados.
-- 3) Borra los jugadores duplicados y sus filas relacionadas.

begin;

drop table if exists _auth_dup_ids;
create temporary table _auth_dup_ids as
with auth_ordenado as (
  select
    id,
    lower(email) as email_norm,
    created_at,
    row_number() over (
      partition by lower(email)
      order by created_at asc, id asc
    ) as rn
  from auth.users
  where email is not null
),
auth_dups as (
  select id from auth_ordenado where rn > 1
)
select id from auth_dups;

delete from auth.users
where id in (select id from _auth_dup_ids);

drop table if exists _jug_dup_ids;
create temporary table _jug_dup_ids as
with jug_ordenado as (
  select
    id,
    lower(email) as email_norm,
    creado,
    row_number() over (
      partition by lower(email)
      order by creado asc, id asc
    ) as rn
  from jugadores
  where email is not null
),
jug_dups as (
  select id from jug_ordenado where rn > 1
)
select id from jug_dups;

delete from predicciones where jugador_id in (select id from _jug_dup_ids);
delete from picks_final where jugador_id in (select id from _jug_dup_ids);
delete from apuestas where jugador_id in (select id from _jug_dup_ids);
delete from jugadores where id in (select id from _jug_dup_ids);

commit;

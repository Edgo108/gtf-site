-- Gang Task Force — carte interactive des zones sensibles
-- À exécuter APRÈS schema.sql, investigations.sql et gangs.sql (réutilise
-- public.is_active_agent(), public.is_admin(), public.set_updated_at()).
-- Dashboard Supabase → SQL Editor → New query.

-- --- sensitive_zones (table + policies ne référençant pas zone_locks) ----

create table public.sensitive_zones (
  id uuid primary key default gen_random_uuid(),
  gang_id uuid not null references public.gangs (id) on delete cascade,
  type_zone text not null check (type_zone in ('vente', 'influence')),
  -- Liste de points {x, y} en coordonnées pixel relatives à l'image de
  -- carte (identiques sur les 3 versions, puisqu'elles sont alignées).
  points jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_sensitive_zones_updated_at
before update on public.sensitive_zones
for each row execute function public.set_updated_at();

alter table public.sensitive_zones enable row level security;

revoke all on public.sensitive_zones from anon;
revoke all on public.sensitive_zones from authenticated;

grant select, insert on public.sensitive_zones to authenticated;
grant update (gang_id, type_zone, points) on public.sensitive_zones to authenticated;
-- Pas de grant sur deleted_at, ni de DELETE : la corbeille passe par le
-- serveur (service_role), comme pour gangs/investigations/wanted_notices.

create policy "sensitive_zones_select"
  on public.sensitive_zones for select
  to authenticated
  using (deleted_at is null and public.is_active_agent());

create policy "sensitive_zones_insert"
  on public.sensitive_zones for insert
  to authenticated
  with check (public.is_active_agent() and created_by = auth.uid());

-- --- zone_locks -----------------------------------------------------------
-- Créée avant la policy UPDATE de sensitive_zones ci-dessous, qui la
-- référence. Verrouillage temporaire anti-conflit : l'acquisition/le vol
-- après expiration (3 min) passe par le serveur (service_role), après
-- vérification applicative de l'état du verrou — évite l'ambiguïté RLS
-- d'un upsert "soit à moi, soit expiré". La libération (delete de son
-- propre verrou) reste directement accessible via RLS.

create table public.zone_locks (
  zone_id uuid primary key references public.sensitive_zones (id) on delete cascade,
  locked_by uuid not null references auth.users (id) on delete cascade,
  locked_at timestamptz not null default now()
);

alter table public.zone_locks enable row level security;

revoke all on public.zone_locks from anon;
revoke all on public.zone_locks from authenticated;

grant select, delete on public.zone_locks to authenticated;
-- Pas d'insert/update pour authenticated : acquisition/renouvellement du
-- verrou uniquement via le serveur (voir app/(app)/zones/actions.ts).

create policy "zone_locks_select"
  on public.zone_locks for select
  to authenticated
  using (public.is_active_agent());

create policy "zone_locks_delete_own"
  on public.zone_locks for delete
  to authenticated
  using (locked_by = auth.uid());

-- --- sensitive_zones : policy UPDATE (référence zone_locks) --------------
-- La modification est bloquée au niveau base si la zone est verrouillée
-- par un AUTRE agent depuis moins de 3 minutes (pas seulement côté UI).

create policy "sensitive_zones_update"
  on public.sensitive_zones for update
  to authenticated
  using (
    deleted_at is null
    and public.is_active_agent()
    and not exists (
      select 1 from public.zone_locks
      where zone_locks.zone_id = sensitive_zones.id
        and zone_locks.locked_by <> auth.uid()
        and zone_locks.locked_at > now() - interval '3 minutes'
    )
  )
  with check (public.is_active_agent());

-- --- zone_history ---------------------------------------------------------

create table public.zone_history (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.sensitive_zones (id) on delete cascade,
  agent_id uuid references auth.users (id) on delete set null,
  agent_pseudo text not null,
  resume text not null,
  created_at timestamptz not null default now()
);

alter table public.zone_history enable row level security;

revoke all on public.zone_history from anon;
revoke all on public.zone_history from authenticated;

grant select, insert on public.zone_history to authenticated;

create policy "zone_history_select"
  on public.zone_history for select
  to authenticated
  using (public.is_active_agent());

create policy "zone_history_insert"
  on public.zone_history for insert
  to authenticated
  with check (agent_id = auth.uid() and public.is_active_agent());

-- Gang Task Force — suivi "dernière consultation des mandats" par agent,
-- pour la pastille de compteur dans la navigation.
-- À exécuter APRÈS schema.sql (réutilise public.is_active_agent() si
-- besoin, mais ne l'utilise pas directement ici).
-- Dashboard Supabase → SQL Editor → New query.

create table public.wanted_notice_views (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.wanted_notice_views enable row level security;

revoke all on public.wanted_notice_views from anon;
revoke all on public.wanted_notice_views from authenticated;

grant select, insert on public.wanted_notice_views to authenticated;
grant update (last_seen_at) on public.wanted_notice_views to authenticated;

create policy "wanted_notice_views_select_own"
  on public.wanted_notice_views for select
  to authenticated
  using (user_id = auth.uid());

create policy "wanted_notice_views_insert_own"
  on public.wanted_notice_views for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "wanted_notice_views_update_own"
  on public.wanted_notice_views for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

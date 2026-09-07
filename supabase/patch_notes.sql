-- Gang Task Force — journal des mises à jour du site (« Patch notes »)
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_active_agent() et public.is_admin()).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Écrit par drop policy if exists + create : ré-exécutable sans casser.

create table if not exists public.patch_notes (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text not null default '',
  categorie text not null default 'nouveaute'
    check (categorie in ('nouveaute', 'correction', 'amelioration')),
  -- Date de publication (modifiable par l'admin, pré-remplie à
  -- aujourd'hui côté formulaire).
  date date not null default current_date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.patch_notes enable row level security;

revoke all on public.patch_notes from anon;
revoke all on public.patch_notes from authenticated;

-- Lecture : tout agent actif. Écriture : admin uniquement (voir policies).
grant select, insert, delete on public.patch_notes to authenticated;
grant update (titre, description, categorie, date) on public.patch_notes to authenticated;
-- Pas de grant sur created_by / created_at.

drop policy if exists "patch_notes_select" on public.patch_notes;
create policy "patch_notes_select"
  on public.patch_notes for select
  to authenticated
  using (public.is_active_agent());

drop policy if exists "patch_notes_insert" on public.patch_notes;
create policy "patch_notes_insert"
  on public.patch_notes for insert
  to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "patch_notes_update" on public.patch_notes;
create policy "patch_notes_update"
  on public.patch_notes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "patch_notes_delete" on public.patch_notes;
create policy "patch_notes_delete"
  on public.patch_notes for delete
  to authenticated
  using (public.is_admin());

-- Gang Task Force — mandats de recherche (wanted notices)
-- À exécuter APRÈS schema.sql et investigations.sql (réutilise
-- public.is_active_agent() et public.set_updated_at()).
-- Dashboard Supabase → SQL Editor → New query.

create table public.wanted_notices (
  id uuid primary key default gen_random_uuid(),
  nom_suspect text not null,
  photo_url text,
  description text not null default '',
  niveau_dangerosite text not null default 'moyen' check (niveau_dangerosite in ('faible', 'moyen', 'eleve')),
  statut text not null default 'actif' check (statut in ('actif', 'capture')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_wanted_notices_updated_at
before update on public.wanted_notices
for each row execute function public.set_updated_at();

alter table public.wanted_notices enable row level security;

revoke all on public.wanted_notices from anon;
revoke all on public.wanted_notices from authenticated;

grant select, insert, delete on public.wanted_notices to authenticated;
grant update (
  nom_suspect, photo_url, description, niveau_dangerosite, statut
) on public.wanted_notices to authenticated;

create policy "wanted_notices_select"
  on public.wanted_notices for select
  to authenticated
  using (public.is_active_agent());

create policy "wanted_notices_insert"
  on public.wanted_notices for insert
  to authenticated
  with check (public.is_active_agent() and created_by = auth.uid());

create policy "wanted_notices_update"
  on public.wanted_notices for update
  to authenticated
  using (public.is_active_agent())
  with check (public.is_active_agent());

create policy "wanted_notices_delete"
  on public.wanted_notices for delete
  to authenticated
  using (public.is_active_agent());

-- --- Storage : bucket public pour les photos de suspects ----------------
-- Bucket public : les photos sont accessibles par URL directe (nécessaire
-- pour un affichage simple avec next/image), mais seuls les utilisateurs
-- connectés peuvent en ajouter/modifier/supprimer (policies ci-dessous).

insert into storage.buckets (id, name, public)
values ('wanted-photos', 'wanted-photos', true)
on conflict (id) do nothing;

create policy "wanted_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'wanted-photos');

create policy "wanted_photos_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'wanted-photos');

create policy "wanted_photos_authenticated_update"
on storage.objects for update
to authenticated
using (bucket_id = 'wanted-photos')
with check (bucket_id = 'wanted-photos');

create policy "wanted_photos_authenticated_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'wanted-photos');

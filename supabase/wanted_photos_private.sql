-- Gang Task Force — correctif sécurité (audit pré-V1, point S1) :
-- stockage des photos de mandats (bucket `wanted-photos`).
-- À exécuter APRÈS wanted_notices.sql et permissions_unite.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Avant : bucket public (photos visibles sans connexion) et tout compte
-- connecté, lecture seule comprise, pouvait envoyer / remplacer /
-- supprimer n'importe quel fichier, sans limite de type ni de taille.
-- Après :
--   - bucket privé : lecture réservée aux agents actifs, via des URL
--     signées temporaires générées par le serveur ;
--   - envoi / suppression : agents actifs dont l'unité peut écrire les
--     mandats (ID / GTF / DOJ / EM, admin) — même règle que la table ;
--   - aucun remplacement (update) de fichier existant ;
--   - 5 Mo max, JPEG / PNG / WebP uniquement (appliqué par Supabase).

update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'wanted-photos';

drop policy if exists "wanted_photos_public_read" on storage.objects;
drop policy if exists "wanted_photos_authenticated_insert" on storage.objects;
drop policy if exists "wanted_photos_authenticated_update" on storage.objects;
drop policy if exists "wanted_photos_authenticated_delete" on storage.objects;
drop policy if exists "wanted_photos_select" on storage.objects;
drop policy if exists "wanted_photos_insert" on storage.objects;
drop policy if exists "wanted_photos_delete" on storage.objects;

create policy "wanted_photos_select"
on storage.objects for select
to authenticated
using (bucket_id = 'wanted-photos' and public.is_active_agent());

create policy "wanted_photos_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'wanted-photos'
  and public.is_active_agent()
  and public.unite_peut_ecrire_mandats()
);

create policy "wanted_photos_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'wanted-photos'
  and public.is_active_agent()
  and public.unite_peut_ecrire_mandats()
);

-- Gang Task Force — Pièces jointes des Enquêtes, Rapports et Plaintes
-- À exécuter APRÈS investigations.sql, permissions_unite.sql,
-- unite_etat_major.sql, archives_rapports_plaintes.sql et audit_lot3.sql.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Stockage : bucket PRIVÉ `archives-attachments`, 15 Mo max par fichier,
-- tous formats. Aucune URL publique : lecture via URL signées
-- temporaires, générées avec la session de l'agent (donc soumises aux
-- policies ci-dessous).
-- Chemin d'un fichier : {parent_type}/{parent_id}/{uuid}-{nom_nettoyé}
--
-- Permissions (table ET bucket) :
--   - lecture : tout agent qui peut lire la fiche parente (une fiche en
--     corbeille n'est plus lisible, ses fichiers non plus) ; pour les
--     enquêtes, les unités SASP et DOJ n'ont jamais accès aux fichiers ;
--   - ajout / suppression : les agents qui peuvent modifier la fiche
--     (enquête : unité ID / GTF / EM ou admin ; rapport / plainte : tout
--     agent actif) ;
--   - fiche pas encore enregistrée (formulaire de création) : l'agent qui
--     a le droit de créer ce type de fiche peut déposer des fichiers sous
--     l'identifiant généré par son formulaire, et seul lui peut les relire
--     ou les supprimer ; les lignes `attachments` ne sont créées qu'à
--     l'enregistrement de la fiche ;
--   - suppression définitive d'une fiche : ses lignes `attachments` sont
--     supprimées par trigger, ses fichiers par le serveur (service_role).

-- ====================================================================
-- 1. Identifiant de fiche choisi par le formulaire
-- ====================================================================
-- Le formulaire de création génère l'id de la fiche dès son ouverture
-- (pour déposer les fichiers sous leur chemin définitif) : `id` doit donc
-- être insérable. Un id déjà pris est simplement refusé (clé primaire).

grant insert (id) on public.investigations to authenticated;
grant insert (id) on public.rapports to authenticated;
grant insert (id) on public.plaintes to authenticated;

-- ====================================================================
-- 2. Bucket
-- ====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archives-attachments', 'archives-attachments', false, 15728640, null)
on conflict (id) do update
set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = null;

-- ====================================================================
-- 3. Fonctions d'autorisation
-- ====================================================================

-- État d'une fiche parente, corbeille comprise : 'active', 'deleted' ou
-- 'absent' ; null si le type est inconnu. SECURITY DEFINER car la RLS
-- des fiches masque celles en corbeille : sans cela, une fiche en
-- corbeille passerait pour « pas encore créée » et deviendrait
-- modifiable. Ne renvoie qu'un état, jamais de contenu.
create or replace function public.attachment_parent_state(p_type text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
  v_found boolean;
begin
  if p_id is null then
    return null;
  end if;

  if p_type = 'investigation' then
    select deleted_at, true into v_deleted_at, v_found
    from public.investigations where id = p_id;
  elsif p_type = 'rapport' then
    select deleted_at, true into v_deleted_at, v_found
    from public.rapports where id = p_id;
  elsif p_type = 'plainte' then
    select deleted_at, true into v_deleted_at, v_found
    from public.plaintes where id = p_id;
  else
    return null;
  end if;

  if not coalesce(v_found, false) then
    return 'absent';
  end if;
  return case when v_deleted_at is null then 'active' else 'deleted' end;
end;
$$;

revoke all on function public.attachment_parent_state(text, uuid) from public, anon;
grant execute on function public.attachment_parent_state(text, uuid) to authenticated;

-- L'agent connecté peut-il lire la fiche parente ? (SECURITY INVOKER :
-- s'appuie sur la RLS de la fiche elle-même, qui exclut la corbeille.)
create or replace function public.can_read_attachment_parent(p_type text, p_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_active_agent()
    and case p_type
      when 'investigation' then
        (public.is_admin() or public.mon_unite() not in ('SASP', 'DOJ'))
        and exists (select 1 from public.investigations where id = p_id)
      when 'rapport' then
        exists (select 1 from public.rapports where id = p_id)
      when 'plainte' then
        exists (select 1 from public.plaintes where id = p_id)
      else false
    end;
$$;

-- L'agent connecté a-t-il le droit de modifier (ou, pour une fiche pas
-- encore enregistrée, de créer) ce type de fiche ? Mêmes règles que les
-- policies insert/update des tables parentes.
create or replace function public.can_write_attachment_type(p_type text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_active_agent()
    and case p_type
      when 'investigation' then public.unite_peut_ecrire_operationnel()
      when 'rapport' then true
      when 'plainte' then true
      else false
    end;
$$;

-- Découpe un chemin du bucket : {type}/{uuid}/fichier. Renvoie null pour
-- tout chemin mal formé (aucune policy ne s'applique alors).
create or replace function public.attachment_path_parent_id(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when (storage.foldername(p_name))[2]
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and array_length(storage.foldername(p_name), 1) = 2
    then ((storage.foldername(p_name))[2])::uuid
  end;
$$;

grant execute on function public.can_read_attachment_parent(text, uuid) to authenticated;
grant execute on function public.can_write_attachment_type(text) to authenticated;
grant execute on function public.attachment_path_parent_id(text) to authenticated;

-- ====================================================================
-- 4. Table attachments
-- ====================================================================

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null
    check (parent_type in ('investigation', 'rapport', 'plainte')),
  -- Pas de clé étrangère possible (parent polymorphe) : la cohérence est
  -- assurée par les policies (fiche existante) et par les triggers de
  -- suppression définitive ci-dessous.
  parent_id uuid not null,
  nom_fichier text not null check (char_length(nom_fichier) between 1 and 255),
  storage_path text not null unique,
  taille_octets bigint not null check (taille_octets between 0 and 15728640),
  type_mime text not null default 'application/octet-stream'
    check (char_length(type_mime) <= 255),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Le fichier est toujours rangé dans le dossier de sa fiche.
  constraint attachments_path_matches_parent
    check (storage_path like parent_type || '/' || parent_id::text || '/%')
);

create index if not exists attachments_parent_idx
  on public.attachments (parent_type, parent_id, created_at);

alter table public.attachments enable row level security;

revoke all on public.attachments from anon;
revoke all on public.attachments from authenticated;

grant select, delete on public.attachments to authenticated;
grant insert (
  parent_type, parent_id, nom_fichier, storage_path, taille_octets,
  type_mime, uploaded_by
) on public.attachments to authenticated;

drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select"
  on public.attachments for select
  to authenticated
  using (public.can_read_attachment_parent(parent_type, parent_id));

drop policy if exists "attachments_insert" on public.attachments;
create policy "attachments_insert"
  on public.attachments for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_write_attachment_type(parent_type)
    and public.attachment_parent_state(parent_type, parent_id) = 'active'
  );

drop policy if exists "attachments_delete" on public.attachments;
create policy "attachments_delete"
  on public.attachments for delete
  to authenticated
  using (
    public.can_write_attachment_type(parent_type)
    and public.attachment_parent_state(parent_type, parent_id) = 'active'
  );

-- ====================================================================
-- 5. Suppression définitive d'une fiche → ses lignes attachments
-- ====================================================================
-- (Les fichiers eux-mêmes sont supprimés par le serveur, l'API Storage
-- étant la seule façon propre de les effacer.)

create or replace function public.delete_parent_attachments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.attachments
  where parent_type = tg_argv[0] and parent_id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_parent_attachments() from public, anon, authenticated;

drop trigger if exists trg_investigations_delete_attachments on public.investigations;
create trigger trg_investigations_delete_attachments
after delete on public.investigations
for each row execute function public.delete_parent_attachments('investigation');

drop trigger if exists trg_rapports_delete_attachments on public.rapports;
create trigger trg_rapports_delete_attachments
after delete on public.rapports
for each row execute function public.delete_parent_attachments('rapport');

drop trigger if exists trg_plaintes_delete_attachments on public.plaintes;
create trigger trg_plaintes_delete_attachments
after delete on public.plaintes
for each row execute function public.delete_parent_attachments('plainte');

-- ====================================================================
-- 6. Fichiers orphelins (nettoyage par un admin, via le serveur)
-- ====================================================================
-- Fichiers du bucket sans ligne `attachments`, plus anciens que
-- `p_min_age` : brouillons abandonnés (onglet fermé en pleine création),
-- fichier envoyé dont l'enregistrement a échoué… Réservé à service_role.

create or replace function public.list_orphan_attachment_objects(p_min_age interval)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'archives-attachments'
    and o.created_at < now() - p_min_age
    and not exists (
      select 1 from public.attachments a where a.storage_path = o.name
    )
  order by o.created_at;
$$;

revoke all on function public.list_orphan_attachment_objects(interval) from public, anon, authenticated;
grant execute on function public.list_orphan_attachment_objects(interval) to service_role;

-- ====================================================================
-- 7. Policies du bucket
-- ====================================================================

drop policy if exists "archives_attachments_select" on storage.objects;
drop policy if exists "archives_attachments_insert" on storage.objects;
drop policy if exists "archives_attachments_delete" on storage.objects;

-- Lecture (URL signées comprises) : fiche lisible, ou brouillon déposé
-- par l'agent lui-même sur une fiche pas encore enregistrée.
create policy "archives_attachments_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'archives-attachments'
  and (
    public.can_read_attachment_parent(
      (storage.foldername(name))[1], public.attachment_path_parent_id(name)
    )
    or (
      owner_id = auth.uid()::text
      and public.can_write_attachment_type((storage.foldername(name))[1])
      and public.attachment_parent_state(
        (storage.foldername(name))[1], public.attachment_path_parent_id(name)
      ) = 'absent'
    )
  )
);

-- Dépôt : droit de modification sur la fiche, ou droit de création si
-- elle n'est pas encore enregistrée. Jamais dans une fiche en corbeille.
-- Pas de policy UPDATE : un fichier n'est jamais remplacé.
create policy "archives_attachments_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'archives-attachments'
  and public.can_write_attachment_type((storage.foldername(name))[1])
  and public.attachment_parent_state(
    (storage.foldername(name))[1], public.attachment_path_parent_id(name)
  ) in ('active', 'absent')
);

-- Suppression : droit de modification sur la fiche ; pour une fiche pas
-- encore enregistrée, seulement ses propres brouillons.
create policy "archives_attachments_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'archives-attachments'
  and public.can_write_attachment_type((storage.foldername(name))[1])
  and (
    public.attachment_parent_state(
      (storage.foldername(name))[1], public.attachment_path_parent_id(name)
    ) = 'active'
    or (
      owner_id = auth.uid()::text
      and public.attachment_parent_state(
        (storage.foldername(name))[1], public.attachment_path_parent_id(name)
      ) = 'absent'
    )
  )
);

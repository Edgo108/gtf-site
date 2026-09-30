-- Gang Task Force — point Q5 : toutes les références à un agent pointent
-- vers public.profiles (les tables les plus anciennes pointaient vers
-- auth.users, les récentes vers profiles).
-- À exécuter APRÈS tous les fichiers de création de tables.
-- IDEMPOTENT (ré-exécutable sans risque).
-- Dashboard Supabase → SQL Editor → New query.
--
-- Comportement inchangé : profiles.id référence auth.users avec
-- « on delete cascade », donc supprimer un compte supprime son profil,
-- qui déclenche à son tour le même effet qu'avant (mise à null de
-- l'auteur, ou suppression des verrous / lectures / vues de l'agent).
-- Intérêt : un seul modèle partout, et des jointures possibles vers le
-- profil (pseudo…) depuis ces colonnes.
--
-- Pour chaque colonne : on retire la clé étrangère existante vers
-- auth.users (quel que soit son nom), on nettoie d'éventuelles valeurs
-- orphelines (compte sans profil), puis on la recrée vers profiles.

do $$
declare
  target record;
  fk_name text;
begin
  for target in
    select * from (values
      ('investigations',        'created_by', 'set null'),
      ('investigation_history', 'agent_id',   'set null'),
      ('wanted_notices',        'created_by', 'set null'),
      ('announcements',         'created_by', 'set null'),
      ('announcement_reads',    'user_id',    'cascade'),
      ('wanted_notice_views',   'user_id',    'cascade'),
      ('sensitive_zones',       'created_by', 'set null'),
      ('zone_history',          'agent_id',   'set null'),
      ('zone_locks',            'locked_by',  'cascade'),
      ('lab_markers',           'created_by', 'set null'),
      ('lab_marker_history',    'agent_id',   'set null'),
      ('lab_marker_locks',      'locked_by',  'cascade'),
      ('patch_notes',           'created_by', 'set null')
    ) as t(table_name, column_name, on_delete)
  loop
    -- Table absente (script de création jamais lancé) : on passe.
    if to_regclass(format('public.%I', target.table_name)) is null then
      raise notice 'Table public.% absente, ignorée.', target.table_name;
      continue;
    end if;

    fk_name := null;
    -- Clé étrangère actuelle de cette colonne vers auth.users.
    select c.conname into fk_name
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.conrelid = format('public.%I', target.table_name)::regclass
      and c.confrelid = 'auth.users'::regclass
      and a.attname = target.column_name
    limit 1;

    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I',
        target.table_name, fk_name);
    end if;

    -- Valeurs orphelines (compte sans fiche agent).
    if target.on_delete = 'set null' then
      execute format(
        'update public.%1$I set %2$I = null
         where %2$I is not null
           and not exists (select 1 from public.profiles p where p.id = %1$I.%2$I)',
        target.table_name, target.column_name);
    else
      execute format(
        'delete from public.%1$I
         where not exists (select 1 from public.profiles p where p.id = %1$I.%2$I)',
        target.table_name, target.column_name);
    end if;

    execute format(
      'alter table public.%1$I drop constraint if exists %1$s_%2$s_profiles_fkey',
      target.table_name, target.column_name);
    execute format(
      'alter table public.%1$I add constraint %1$s_%2$s_profiles_fkey
         foreign key (%2$I) references public.profiles (id) on delete %3$s',
      target.table_name, target.column_name, target.on_delete);
  end loop;
end;
$$;

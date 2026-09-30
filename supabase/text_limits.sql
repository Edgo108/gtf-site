-- Gang Task Force — point B6 : longueurs maximales des champs texte.
-- GÉNÉRÉ depuis lib/limits.ts (TEXT_LIMITS) : garder les deux alignés.
-- À exécuter après les fichiers de création des tables concernées.
-- IDEMPOTENT. Dashboard Supabase → SQL Editor → New query.
--
-- Contraintes « NOT VALID » : elles s appliquent à toute nouvelle écriture
-- (y compris un appel direct à l API), sans échouer sur une éventuelle
-- fiche existante déjà plus longue. Le serveur vérifie les mêmes limites
-- en amont pour afficher un message clair.

-- investigations
alter table public.investigations drop constraint if exists investigations_titre_len;
alter table public.investigations add constraint investigations_titre_len check (char_length(titre) <= 150) not valid;
alter table public.investigations drop constraint if exists investigations_suspects_len;
alter table public.investigations add constraint investigations_suspects_len check (char_length(suspects) <= 2000) not valid;
alter table public.investigations drop constraint if exists investigations_preuves_len;
alter table public.investigations add constraint investigations_preuves_len check (char_length(preuves) <= 10000) not valid;
alter table public.investigations drop constraint if exists investigations_description_len;
alter table public.investigations add constraint investigations_description_len check (char_length(description) <= 10000) not valid;
alter table public.investigations drop constraint if exists investigations_agent_responsable_len;
alter table public.investigations add constraint investigations_agent_responsable_len check (char_length(agent_responsable) <= 120) not valid;
alter table public.investigations drop constraint if exists investigations_casier_numero_len;
alter table public.investigations add constraint investigations_casier_numero_len check (char_length(casier_numero) <= 50) not valid;
alter table public.investigations drop constraint if exists investigations_casier_code_acces_len;
alter table public.investigations add constraint investigations_casier_code_acces_len check (char_length(casier_code_acces) <= 50) not valid;

-- gangs
alter table public.gangs drop constraint if exists gangs_nom_len;
alter table public.gangs add constraint gangs_nom_len check (char_length(nom) <= 120) not valid;
alter table public.gangs drop constraint if exists gangs_territoire_len;
alter table public.gangs add constraint gangs_territoire_len check (char_length(territoire) <= 500) not valid;
alter table public.gangs drop constraint if exists gangs_activites_len;
alter table public.gangs add constraint gangs_activites_len check (char_length(activites) <= 5000) not valid;
alter table public.gangs drop constraint if exists gangs_notes_len;
alter table public.gangs add constraint gangs_notes_len check (char_length(notes) <= 10000) not valid;

-- gang_members
alter table public.gang_members drop constraint if exists gang_members_nom_len;
alter table public.gang_members add constraint gang_members_nom_len check (char_length(nom) <= 120) not valid;
alter table public.gang_members drop constraint if exists gang_members_role_len;
alter table public.gang_members add constraint gang_members_role_len check (char_length(role) <= 120) not valid;

-- wanted_notices
alter table public.wanted_notices drop constraint if exists wanted_notices_nom_suspect_len;
alter table public.wanted_notices add constraint wanted_notices_nom_suspect_len check (char_length(nom_suspect) <= 120) not valid;
alter table public.wanted_notices drop constraint if exists wanted_notices_description_len;
alter table public.wanted_notices add constraint wanted_notices_description_len check (char_length(description) <= 10000) not valid;

-- announcements
alter table public.announcements drop constraint if exists announcements_titre_len;
alter table public.announcements add constraint announcements_titre_len check (char_length(titre) <= 150) not valid;
alter table public.announcements drop constraint if exists announcements_message_len;
alter table public.announcements add constraint announcements_message_len check (char_length(message) <= 5000) not valid;

-- operations
alter table public.operations drop constraint if exists operations_titre_len;
alter table public.operations add constraint operations_titre_len check (char_length(titre) <= 150) not valid;
alter table public.operations drop constraint if exists operations_description_len;
alter table public.operations add constraint operations_description_len check (char_length(description) <= 10000) not valid;

-- patch_notes
alter table public.patch_notes drop constraint if exists patch_notes_titre_len;
alter table public.patch_notes add constraint patch_notes_titre_len check (char_length(titre) <= 150) not valid;
alter table public.patch_notes drop constraint if exists patch_notes_description_len;
alter table public.patch_notes add constraint patch_notes_description_len check (char_length(description) <= 5000) not valid;

-- rapports
alter table public.rapports drop constraint if exists rapports_nom_suspect_len;
alter table public.rapports add constraint rapports_nom_suspect_len check (char_length(nom_suspect) <= 120) not valid;
alter table public.rapports drop constraint if exists rapports_faits_reproches_len;
alter table public.rapports add constraint rapports_faits_reproches_len check (char_length(faits_reproches) <= 10000) not valid;
alter table public.rapports drop constraint if exists rapports_descriptif_situation_len;
alter table public.rapports add constraint rapports_descriptif_situation_len check (char_length(descriptif_situation) <= 20000) not valid;

-- plaintes
alter table public.plaintes drop constraint if exists plaintes_nom_victime_len;
alter table public.plaintes add constraint plaintes_nom_victime_len check (char_length(nom_victime) <= 120) not valid;
alter table public.plaintes drop constraint if exists plaintes_descriptif_plainte_len;
alter table public.plaintes add constraint plaintes_descriptif_plainte_len check (char_length(descriptif_plainte) <= 20000) not valid;

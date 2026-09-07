-- Gang Task Force — schéma d'authentification / profils
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null unique,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  statut text not null default 'actif' check (statut in ('actif', 'suspendu')),
  grade text not null default 'Agent',
  -- 3e dimension de permissions (rôle/unité). Détail des droits associés
  -- et policies RLS correspondantes : supabase/permissions_unite.sql.
  -- Tout compte (admin inclus) démarre en 'SASP', à réattribuer ensuite.
  unite text not null default 'SASP' check (unite in ('ID', 'GTF', 'SASP', 'DOJ')),
  doit_changer_mdp boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- On repart d'une base sans aucun privilège implicite, puis on accorde
-- explicitement le strict nécessaire.
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

-- Un utilisateur connecté peut lire des lignes de la table (restreint à
-- sa propre ligne par la policy ci-dessous), et modifier uniquement la
-- colonne doit_changer_mdp sur sa propre ligne (pour la remettre à false
-- après un changement de mot de passe forcé).
-- Toute autre opération (création, changement de pseudo/grade/statut/role,
-- suppression, lecture des autres profils) passe exclusivement par le
-- serveur applicatif (clé service_role), après vérification que
-- l'appelant est bien admin.
grant select on public.profiles to authenticated;
grant update (doit_changer_mdp) on public.profiles to authenticated;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Ni anon ni authenticated n'ont de privilège insert/delete sur cette
-- table : aucune policy insert/delete n'est donc nécessaire.

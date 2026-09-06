# Gang Task Force (GTF)

Site web d'une unité de police anti-gang fictive, dans le cadre d'un serveur GTA RP.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) (base de données + authentification)

## Structure

```
app/                  routes (App Router)
components/ui/        composants réutilisables (ex: Panel)
lib/supabase/         clients Supabase (browser, server, middleware/proxy)
tailwind.config.ts    thème "tactique" (couleurs, polices) des pages internes
proxy.ts              rafraîchit la session Supabase à chaque requête
```

## Thème tactique

Le thème sombre défini dans `tailwind.config.ts` (couleurs `gtf-*`, polices
`font-display` / `font-sans` / `font-mono`) habille les pages internes
(dashboard, profil, gestion des agents), une fois l'utilisateur connecté.
`app/page.tsx` est la page de connexion publique, avec son propre thème
clair (fond beige, logo en filigrane).

## Comptes & authentification

- Pas d'inscription publique : seul un administrateur crée des comptes
  agents, depuis **Gestion des agents** (`/admin/agents`).
- La connexion se fait par **pseudo** + mot de passe (pas d'email visible :
  un email interne `pseudo@gtf.local` est généré automatiquement en
  coulisses, voir `lib/auth/pseudo.ts`).
- À la création d'un agent, `doit_changer_mdp = true` : l'agent est
  automatiquement redirigé vers `/changer-mot-de-passe` à sa première
  connexion, sans pouvoir accéder au reste du site tant qu'il n'a pas
  changé son mot de passe (appliqué par `proxy.ts` / middleware, donc
  impossible à contourner côté client).
- Un compte suspendu est banni côté Supabase Auth (`auth.admin.updateUserById`
  avec `ban_duration`) : la connexion échoue immédiatement avec le message
  « Compte suspendu, contactez un administrateur ».
- Sécurité : Row Level Security est activé sur `profiles` — un agent ne
  peut lire/modifier que sa propre ligne (et uniquement la colonne
  `doit_changer_mdp`), au niveau de la base de données (pas seulement de
  l'interface). Voir `supabase/schema.sql` pour le détail des policies.
  Toutes les opérations admin (créer/modifier/suspendre/supprimer un
  agent) passent par des Server Actions utilisant la clé `service_role`,
  jamais exposée au navigateur.

### Mettre en place le schéma

1. Dans le dashboard Supabase : **SQL Editor → New query**.
2. Collez le contenu de `supabase/schema.sql` et exécutez-le. Cela crée la
   table `profiles`, active RLS, et pose les policies/permissions.
3. Faites de même avec `supabase/investigations.sql` (à exécuter après
   `schema.sql`) : crée les tables `investigations` et
   `investigation_history`, avec leurs policies RLS.
4. Faites de même avec `supabase/wanted_notices.sql` (à exécuter après
   les deux précédents) : crée la table `wanted_notices`, le bucket
   Storage public `wanted-photos` pour les photos, et leurs policies.
5. Faites de même avec `supabase/announcements.sql` (à exécuter après
   `schema.sql` et `investigations.sql`) : crée les tables
   `announcements` et `announcement_reads`, avec leurs policies RLS.
6. Faites de même avec `supabase/wanted_notice_views.sql` (à exécuter
   après `schema.sql` et `wanted_notices.sql`) : crée la table
   `wanted_notice_views` (pastille de compteur "nouveaux mandats").
7. Faites de même avec `supabase/gangs.sql` (à exécuter après
   `schema.sql` et `investigations.sql`) : crée les tables `gangs` et
   `gang_members`, avec leurs policies RLS.
8. Faites de même avec `supabase/zones.sql` (à exécuter après
   `schema.sql`, `investigations.sql` et `gangs.sql`) : crée les tables
   `sensitive_zones`, `zone_history` et `zone_locks`.

### Carte interactive : images à fournir

Déposez vos 3 images (mêmes dimensions, mêmes cadrage) dans :

```
public/map/atlas.png
public/map/satellite.jpg
public/map/road.jpg
```

Tant qu'elles n'y sont pas, la carte affiche un fond vide (404 sur
l'image) — le reste de l'interface (dessin, verrouillage, historique)
fonctionne indépendamment.

### Créer votre compte admin initial

1. **Authentication → Users → Add user** : créez votre utilisateur avec
   l'email **exact** `pseudo@gtf.local` (pseudo en minuscules, sans
   accents ni espaces — ex. pour le pseudo `Edgo`, l'email doit être
   `edgo@gtf.local`) et un mot de passe. Cochez **Auto Confirm User**.
   Cet email interne doit correspondre exactement à ce que calcule
   `pseudoToEmail()` (`lib/auth/pseudo.ts`), sinon la connexion échoue.
2. Copiez son **User UID** (visible dans la liste des utilisateurs).
3. Dans **SQL Editor**, exécutez (en remplaçant les valeurs) :

   ```sql
   insert into public.profiles (id, pseudo, role, statut, grade, doit_changer_mdp)
   values (
     'UUID_COPIE_A_L_ETAPE_2',
     'VotrePseudo',
     'admin',
     'actif',
     'Commandant',
     false
   );
   ```
4. Connectez-vous sur le site avec **votre pseudo** (pas l'email) et le mot
   de passe défini à l'étape 1.

## Configurer Supabase

1. Créez un compte gratuit sur [supabase.com](https://supabase.com) et cliquez
   sur **New project**.
2. Choisissez un nom, un mot de passe de base de données, et une région
   (idéalement proche de vous). Le plan gratuit suffit largement pour
   démarrer.
3. Une fois le projet créé, allez dans **Project Settings → API**
   (`https://supabase.com/dashboard/project/_/settings/api`).
4. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (bouton "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`
     — gardez-la strictement secrète, elle contourne toutes les
     restrictions de sécurité.
5. Copiez `.env.local.example` en `.env.local` et collez ces valeurs :

   ```bash
   cp .env.local.example .env.local
   ```

`.env.local` est ignoré par git — vos clés ne seront jamais commitées.

## Lancer le site en local

```bash
npm install
npm run dev
```

Le site est alors accessible sur [http://localhost:3000](http://localhost:3000).

Autres commandes utiles :

```bash
npm run build   # build de production
npm run start   # sert le build de production
npm run lint    # vérifie le code avec ESLint
```

## Déployer sur Vercel

1. Poussez le projet sur un dépôt GitHub (ou GitLab/Bitbucket).
2. Sur [vercel.com](https://vercel.com), cliquez sur **Add New → Project**
   et importez ce dépôt.
3. Vercel détecte automatiquement Next.js — aucune configuration de build
   n'est nécessaire.
4. Dans les paramètres du projet Vercel, section **Environment Variables**,
   ajoutez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et
   `SUPABASE_SERVICE_ROLE_KEY` (les mêmes valeurs que dans `.env.local`).
5. Cliquez sur **Deploy**. Les déploiements suivants se feront
   automatiquement à chaque push sur la branche principale.

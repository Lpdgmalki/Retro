# Rétro Sprint

Application web collaborative pour animer les **rétrospectives de sprint** en salle ou à distance : chacun ajoute ses retours, commente, vote, et l’équipe repart avec un **plan d’actions suivi**.

- 4 colonnes : **Points positifs** (vert), **Points négatifs** (rouge), **Idées d’amélioration** (bleu), **Actions à mettre en place** (violet)
- Lien de partage par rétrospective, accès invité par simple pseudo (sans compte)
- **Synchronisation temps réel** des cartes, commentaires, votes, statuts et actions (Supabase Realtime)
- Vote à quota configurable, vote confidentiel, votes multiples optionnels, classement en direct
- Synthèse automatique, tableau d’actions, export **PDF** et **CSV** (Excel)
- Interface en français, responsive (ordinateur, tablette, smartphone), mode présentation

---

## Back office et site vitrine

L’application comporte deux espaces :

| Espace | Adresse | Pour qui | Contenu |
| --- | --- | --- | --- |
| **Site vitrine** | `/` | Collaborateurs invités | Saisie de l’e-mail avec **suggestions issues de l’annuaire**, accueil personnalisé (« Bienvenue Mme Durand », poste, photo), rétrospectives en cours, historique personnel. Lien discret « Back office » en pied de page. |
| **Back office** | `/admin` | Administrateurs (e-mail + mot de passe) | Tableau de bord, création et gestion des rétrospectives, **annuaire des utilisateurs** (civilité, prénom, nom, e-mail, poste, photo, actif ; import/export CSV), suivi des actions, **paramètres** (nom de l’organisation, textes d’accueil, suggestions d’e-mails, invités hors annuaire, valeurs par défaut des rétros), gestion des administrateurs. |

Règles d’accès :
- **Seuls les administrateurs créent, animent et invitent** : boutons Inviter, Présenter, Synthèse et Paramètres réservés au back office ; le lien d’invitation n’est lisible que par les administrateurs.
- **Invitations** : nominatives depuis l’annuaire (l’invité arrive directement sur sa rétro après s’être identifié) ou par lien.
- **Cloisonnement** : un invité ne voit que les rétrospectives auxquelles il a été invité.
- **Rapport de fin** : dès la clôture par l’administrateur, les invités voient automatiquement un rapport mis en forme (chiffres clés, podium des idées, forces et points de vigilance, décisions, plan d’actions, contribution personnelle), téléchargeable en PDF.
- Les invités s’identifient avec un e-mail **présent et actif dans l’annuaire**, puis votent et commentent. Ils peuvent aussi proposer des cartes si l’option « Les participants peuvent proposer des cartes » est activée sur la rétro (réglable par rétro, valeur par défaut dans les paramètres).
- Option « Invités hors annuaire » (désactivée par défaut) : permet de rejoindre via un lien d’invitation avec un simple pseudo.
- **Premier administrateur** : ouvrez `/admin` → « Créer le compte administrateur ». Ce formulaire n’apparaît que tant qu’aucun administrateur n’existe. Les suivants créent leur compte sur la même page puis sont promus dans *Paramètres → Administrateurs*.

> Sécurité : l’identification par e-mail est volontairement simple (pas de mot de passe pour les invités). Toute personne connaissant l’e-mail d’un collaborateur peut se présenter sous son nom ; désactivez les suggestions dans les paramètres pour ne pas exposer l’annuaire, et réservez le site à votre réseau si nécessaire.

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture et choix techniques](#architecture-et-choix-techniques)
3. [Modèle de données et sécurité](#modèle-de-données-et-sécurité)
4. [Lancer en local](#lancer-en-local)
5. [Tests](#tests)
6. [Déployer en ligne](#déployer-en-ligne)
7. [Partager la première rétrospective](#partager-la-première-rétrospective)
8. [Ce qui fonctionne / ce qui demande une configuration externe](#état-du-projet)

---

## Fonctionnalités

### Rétrospectives
- Création : équipe ou projet (nouvelle ou existante), sprint, date, facilitateur, objectif/contexte, **date de clôture facultative** (au-delà, plus de contributions ni de commentaires).
- Statuts : **Brouillon → En cours → Vote en cours → Terminée** (retours en arrière possibles : rouvrir les contributions, rouvrir le vote).
  - *Brouillon* : seul le facilitateur prépare le tableau.
  - *En cours* : tout le monde ajoute des cartes et commente.
  - *Vote en cours* : contributions fermées, chacun répartit ses votes, les commentaires restent ouverts.
  - *Terminée* : lecture seule, suivi des actions.
- Paramètres modifiables à tout moment par le facilitateur ; suppression de la rétro.
- **Duplication** d’une rétrospective (équipe et paramètres de vote repris, numéro de sprint incrémenté).
- Historique consultable avec recherche, filtres (équipe, statut) et tris.

### Tableau collaboratif
- Cartes avec titre, description, auteur (ou **Anonyme**), date, compteur de votes, nombre de commentaires.
- Modifier / supprimer sa carte ; le facilitateur peut modérer, déplacer une carte vers une autre colonne et la **convertir en action**.
- Recherche, filtres (*mes cartes*, *mes votes*, *avec commentaires*), tri (récentes, anciennes, plus votées, plus commentées).
- Panneau latéral de discussion sans quitter le tableau ; onglets par colonne sur mobile.
- Présence en ligne des participants, indicateur « En direct ».
- Rappel des **actions des sprints précédents** de l’équipe avec barre de progression (statut modifiable sur place).

### Commentaires
- Ajouter, **répondre** (fils imbriqués), modifier et supprimer ses commentaires ; auteur et date toujours visibles, mention « modifié ».
- Un commentaire supprimé qui a des réponses est masqué (« Commentaire supprimé ») pour conserver la discussion.

### Votes
- Quota configurable par participant (1 à 50, 5 par défaut), compteur « Il vous reste X votes ».
- Un vote par idée par défaut ; votes multiples sur une même idée si le facilitateur l’active.
- Retrait / déplacement des votes tant que le vote est ouvert.
- Classement en temps réel, badges **Priorité #1-3** sur les idées les plus votées.
- **Vote confidentiel** : pendant le vote chacun ne voit que ses propres votes ; ni totaux ni votants ne sont visibles. À la clôture, seuls les **totaux agrégés** sont révélés (les votes individuels restent privés). Le facilitateur voit l’avancement (« 2/5 votes utilisés ») sans savoir pour quoi chacun a voté.
- Toutes les règles sont appliquées **côté base de données** (impossible à contourner depuis le navigateur), y compris en cas de clics simultanés.

### Synthèse et actions
- Nombre de points positifs / négatifs / idées / actions retenues, participants, commentaires, votes.
- Top 5 des idées les plus votées, principaux problèmes (points négatifs les plus votés/commentés), **décisions de l’équipe** (texte rédigé par le facilitateur).
- Tableau des actions : action, responsable, échéance, priorité (Haute/Moyenne/Basse), statut (À faire/En cours/Terminée), lien vers la carte d’origine. Retards signalés.
- Export **PDF** (mise en page dédiée à l’impression, via « Enregistrer au format PDF » du navigateur) et **CSV** compatible Excel (séparateur `;`, UTF-8 BOM, protection contre l’injection de formules).
- Page **Actions** transverse : toutes les actions de vos équipes, progression par équipe, filtres, export CSV.

### Mode présentation
Vue plein écran pour projeter en réunion : vue d’ensemble, une colonne à la fois en grand, classement. Navigation au clavier (← →, F pour plein écran).

---

## Architecture et choix techniques

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Frontend | **React 19 + TypeScript + Vite** | Typage strict, build rapide, SPA déployable sur n’importe quel hébergeur statique |
| UI | **Tailwind CSS v4**, icônes Lucide, police Inter auto-hébergée | Design sobre de type SaaS, composants accessibles maison (dialogues avec piège à focus, menus clavier, `aria-*`) |
| Backend | **Supabase** (PostgreSQL 17, PostgREST) | Base relationnelle robuste ; logique métier dans des fonctions SQL transactionnelles |
| Temps réel | **Supabase Realtime** (`postgres_changes` filtrés par RLS + canal privé de présence) | Vraie synchronisation multi-utilisateurs, sans serveur applicatif à maintenir |
| Auth | **Supabase Auth** : connexion anonyme (invité) + lien magique par e-mail | Chaque invité possède une vraie identité signée (JWT), persistée dans le navigateur ; il peut ensuite associer un e-mail pour retrouver ses rétros sur un autre appareil |
| Hébergement | Supabase Cloud + Vercel / Netlify / tout hébergeur statique | Fichiers `vercel.json`, `netlify.toml` et `public/_redirects` fournis |

Aucun serveur Node à opérer : le navigateur parle directement à Supabase avec la **clé publique (anon)** ; toute la sécurité repose sur la **Row Level Security** et des fonctions `SECURITY DEFINER` contrôlées.

```
src/
  components/
    board/      tableau, cartes, commentaires, votes, dialogues (partage, paramètres, participants)
    actions/    tableau et formulaire d’actions
    layout/     navigation, compte
    ui/         primitives accessibles (boutons, champs, modales, menus…)
  context/      authentification, notifications
  hooks/        useRetroBoard (chargement + temps réel + mutations), présence, listes
  lib/          client Supabase, types, constantes, formatage, CSV
  pages/        accueil, création, invitation, tableau, synthèse, présentation, historique, actions
supabase/
  config.toml   configuration locale (connexion anonyme activée)
  migrations/   schéma complet : tables, RLS, triggers, RPC, publication temps réel
scripts/
  test-backend.mjs   33 tests d’intégration (sécurité, règles de vote, temps réel)
  test-e2e.mjs       parcours complet à deux navigateurs (Playwright)
```

---

## Modèle de données et sécurité

```
teams ─┬─< team_members >── auth.users
       └─< retros ─┬─< participants (rôle : facilitator | participant)
                   ├─< cards ──── card_owners (propriétaire réel, privé)
                   │     ├─< comments (parent_id → réponses)
                   │     └─< votes
                   └─< action_items (source_card_id → carte d’origine)
```

**Contrôles d’accès (RLS)**
- Une rétrospective n’est lisible que par ses **participants** et les **membres de son équipe** (historique en lecture seule). Un utilisateur extérieur ne voit rien, même en s’abonnant au temps réel.
- On rejoint une rétro uniquement via son **jeton de partage** (128 bits aléatoires) → fonction `join_retro`.
- Les écritures sensibles passent par des fonctions SQL : `create_retro`, `create_card` (statut, anonymat), `cast_vote` / `remove_vote` (statut, quota, doublon, **verrou ligne** contre les votes concurrents).
- Insertion directe interdite sur `participants`, `cards`, `votes`, `card_owners`, `teams`.
- Seul le **facilitateur** change le statut, les paramètres, les rôles, crée/supprime les actions ; les membres de l’équipe peuvent faire avancer le statut d’une action.
- Chacun ne modifie que **ses** cartes et commentaires ; l’auteur d’un commentaire est imposé par la base (pas d’usurpation).
- Cartes anonymes : l’auteur n’est **jamais** transmis aux autres (colonne `author_id` vide, propriété stockée dans `card_owners` lisible uniquement par son propriétaire).
- Triggers de garde : champs immuables, au moins un facilitateur par rétro, cohérence carte ↔ action, révélation automatique des votes confidentiels à la clôture.
- Contraintes de validation (longueurs, quotas) en base **et** dans les formulaires.

---

## Lancer en local

### Prérequis
- Node.js ≥ 20
- Docker (pour Supabase local) — ou un projet Supabase Cloud (voir plus bas)

### Installation

```bash
npm install
npx supabase start          # démarre Postgres, Auth, Realtime… et applique la migration
```

> Si Docker Hub est plus accessible que le registre ECR de Supabase dans votre réseau :
> `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.
> Services inutiles désactivables : `-x studio,imgproxy,edge-runtime,logflare,vector,storage-api,postgres-meta,supavisor`.

La commande affiche l’URL de l’API et la clé `anon`. Créez `.env.local` :

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_ANON_KEY=<clé anon affichée par supabase start / supabase status>
```

```bash
npm run dev                 # http://localhost:5173
```

Pour simuler plusieurs participants, ouvrez le lien d’invitation dans une fenêtre de navigation privée ou un autre navigateur.

### Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | vérification TypeScript + build de production dans `dist/` |
| `npm run preview` | sert le build localement |
| `npm run typecheck` | vérification des types |
| `npm run db:start` / `db:stop` / `db:reset` | Supabase local (reset = réapplique les migrations) |
| `npm run db:test` | tests d’intégration du backend |
| `npm run test:e2e` | parcours E2E (nécessite `npm run dev` en parallèle) |

---

## Tests

```bash
npx supabase start
npm run db:test             # 40 tests : back office, annuaire, RLS, anonymat, quotas, concurrence, confidentialité, temps réel
npm run dev &               # puis, dans un autre terminal :
npm run test:e2e            # deux navigateurs (desktop + mobile) jouent une rétro complète
```

Le scénario E2E couvre : création, partage, adhésion sur mobile, ouverture, ajout de cartes (dont anonyme) reçues en direct, commentaires et réponses, vote avec quota, totaux en temps réel, clôture, synthèse, conversion en action, export CSV, mise à jour d’une action par un participant, mode présentation. Les captures sont enregistrées dans `test-results/`.

---

## Déployer en ligne

### 1. Base de données — Supabase Cloud
1. Créez un projet sur [supabase.com](https://supabase.com) (région UE recommandée).
2. Appliquez le schéma :
   ```bash
   npx supabase login
   npx supabase link --project-ref <votre-ref-projet>
   npx supabase db push
   ```
   *(ou copiez le contenu de `supabase/install.sql` dans l’éditeur SQL du tableau de bord et exécutez-le : il contient toutes les migrations ; régénérez-le avec `scripts/build-install-sql.sh` après modification d’une migration). Pour mettre à jour une base existante sans perdre de données, exécutez seulement la nouvelle migration (`supabase/migrations/20261025000000_backoffice.sql`).*
3. **Authentication → Sign In / Providers** : activez **Allow anonymous sign-ins** (indispensable pour l’accès invité). Activez aussi le fournisseur **Email** pour les liens magiques.
4. **Authentication → URL Configuration** : *Site URL* = l’URL de votre application (ex. `https://retro.mon-entreprise.fr`) et ajoutez-la dans *Redirect URLs*.
5. Recommandé en production : activer la **protection CAPTCHA** (Turnstile/hCaptcha) et ajuster les limites de connexions anonymes (*Rate Limits*), configurer un **SMTP** d’entreprise pour les e-mails.
6. Récupérez dans **Project Settings → API** l’URL du projet et la clé **anon / publishable** (jamais la clé `service_role`).

Le temps réel est activé par la migration (publication `supabase_realtime`) ; la présence utilise des canaux privés autorisés par RLS.

### 2. Frontend — Vercel (ou Netlify)
1. Importez le dépôt dans Vercel (framework détecté : Vite).
2. Variables d’environnement : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
3. Déployez. `vercel.json` redirige toutes les routes vers `index.html` (liens `/join/...` et `/r/...`).

Sur Netlify, `netlify.toml` est déjà prêt (build `npm run build`, dossier `dist`). Tout hébergeur statique convient s’il réécrit les routes vers `index.html` (`public/_redirects` fourni).

---

## Partager la première rétrospective

1. Ouvrez l’application, cliquez sur **Créer ma première rétrospective**.
2. Saisissez l’équipe, le sprint, le facilitateur, éventuellement l’objectif et la date de clôture, puis **Créer**.
3. La fenêtre **Inviter l’équipe** s’ouvre : **Copier** le lien (`https://…/join/<jeton>`) ou **l’envoyer par e-mail**, ou le coller dans Teams/Slack. Le bouton **Inviter** du tableau le réaffiche à tout moment.
4. Les collaborateurs ouvrent le lien, saisissent leur pseudo et arrivent sur le tableau.
5. Cliquez sur **Ouvrir les contributions**, puis **Lancer le vote**, puis **Clôturer**. Passez sur **Synthèse** pour convertir les idées gagnantes en actions et exporter le compte rendu.

> Astuce : pour retrouver vos rétrospectives sur un autre ordinateur, utilisez le menu du compte → **Sécuriser avec mon e-mail**.

---

## État du projet

**Fonctionne (testé de bout en bout sur Supabase local)**
- Création, partage, adhésion, statuts, paramètres, suppression, duplication, historique.
- Tableau 4 colonnes, cartes, anonymat, édition/suppression, déplacement, recherche/filtres/tris.
- Commentaires et réponses, édition/suppression, temps réel.
- Votes (quota, unique/multiple, retrait, confidentiel, classement), protégés en base et contre la concurrence.
- Synthèse, décisions, actions (création, conversion, édition, suivi), progression des sprints précédents.
- Exports PDF (impression) et CSV, mode présentation, responsive, présence en ligne, reconnexion automatique avec resynchronisation.

**Nécessite une configuration externe**
- Un projet **Supabase** (cloud ou local via Docker) avec la migration appliquée et **les connexions anonymes activées**.
- Un **hébergeur** pour le frontend (Vercel, Netlify…) avec les deux variables d’environnement.
- Pour les liens magiques en production : un **SMTP** configuré dans Supabase (le service d’e-mails intégré est limité).

**Limites connues**
- Les identités invitées sont liées au navigateur : sans e-mail associé, vider les données du site fait perdre l’accès (il suffit de rejoindre à nouveau via le lien, mais les anciennes cartes ne seront plus modifiables).
- L’export PDF passe par la boîte d’impression du navigateur (« Enregistrer au format PDF »).

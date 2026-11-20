# MYC Smart Metallization Costing

Application web de chiffrage métallisation — MYC Beauty Innovation Tunisia.
Frontend **React (Vite)** · Backend **Supabase** (PostgreSQL + Auth + Realtime).

## Démarrage

1. **Base de données** : Supabase → *SQL Editor* → *New query* → coller le contenu de
   `supabase/schema.sql` → *Run*. (Toutes les tables sont préfixées `mc_` : le projet
   Supabase est partagé avec une autre application, rien d'existant n'est modifié.)
2. **Pas de login** : à l'ouverture, chacun clique sur son profil dans la liste de l'équipe
   (Sami Ladjimi — directeur, Slah Dridi — ingénieur, Mohamed — admin) ou en ajoute un.
   Seuls les profils directeur/admin peuvent valider un devis.
3. **Lancer l'application** :
   ```bash
   cd web
   npm install
   npm run dev
   ```
   Ouvrir http://localhost:5173
4. **Tests du moteur** : `npm test` (vérifie que l'application retrouve les résultats Excel
   PUPA 0,492708 $ et BELOTTI 0,240178 $, et la grille D&G 25TN008).

## Assistant IA (Claude) — mise en service

L'assistant utilise **Claude Opus 5.5** via une Supabase Edge Function (`supabase/functions/mc-ai`).
La clé Anthropic reste côté serveur ; Claude choisit ses outils (simulation, objectif, sensibilité,
courbe, détail du calcul…) qui s'exécutent dans le navigateur avec le moteur validé : il n'invente aucun chiffre.

```bash
npx supabase login
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref ztabtbqtscjfvrautczj
npx supabase functions deploy mc-ai --no-verify-jwt --project-ref ztabtbqtscjfvrautczj
```

Sans la fonction déployée, l'assistant affiche une réponse « hors ligne » (règles fixes).
Le repli automatique de modèle en cas de refus (`fallbacks: "default"`) est activé.

## Traduction

Barre FR / EN / IT / ZH / AR (en-tête et écran d'entrée), via Google Traduction. L'arabe passe
la mise en page en droite-à-gauche. Le texte des pages est envoyé à Google pour être traduit.

## Modules

| Module | Rôle |
|---|---|
| Tableau de bord | KPI, courbe prix / quantité, composition du prix de revient, leviers qui pèsent le plus, éléments à traiter |
| Analyse what-if | 12 curseurs (vitesse, opérateurs, peinture, efficacité…) : courbe de l'effet, sensibilité ±10 %, calcul détaillé, scénario enregistrable |
| Objectifs & IA | On fixe une cible (prix, marge, capacité, heures…) ; l'assistant trouve les leviers pour l'atteindre et suit la progression |
| Pièces 3D | Les 19 pièces des classeurs Excel en 3D (formes et cotes des plans, photos Excel), dimensions réglables en direct, prix recalculé vs prix Excel, surface 3D réelle, conditions applicables (rebut, handling, couleur, délais, gabarit, peintures) |
| Activité | Chaque chiffrage, devis, essai et changement de paramètres est publié (j'aime, commentaires, temps réel) |
| Calculateur | Reproduit `FEUILLE CHIFFREAGE MYC TN` + `COST PAINT-VACCUM` ; mode **Excel** (identique) ou **corrigé** (proposé) |
| Simulateur | Grille `QUOTATION STANDARD FORMULA` (5K → 100K+, client connu / nouveau, couleur standard / spéciale), conversion CN → TN |
| Devis PDF | Workflow brouillon → soumis → **validé (directeur/admin seulement)** → envoyé ; impression PDF avec logo et conditions MYC |
| Échantillons | Suivi reçus / OK / non OK, détection des écarts, montant |
| Paramètres | Toutes les valeurs Excel, **versionnées** ; chaque calcul garde une copie de ses paramètres |
| Assistant IA | Explique le prix, détecte les anomalies, teste des optimisations — n'invente aucun prix |

## Anomalies Excel détectées (à valider avec Slah)

- `W7 = T7/N7*S7` : l'efficacité multiplie le coût au lieu de le diviser.
- Capacité PUPA : l'efficacité 0,9 est appliquée deux fois (`H16` et `K16`).
- `COST PAINT-VACCUM!E19 = … * 0` : le prix des pigments est exclu.
- Le rebut n'influence que la quantité à produire et les heures, pas le prix unitaire.
- RFQ D&G : « total for approved samples » calculé sur les quantités **reçues** ; 42 pièces
  ni OK ni non OK.
- PUPA : diagonale 166 mm mais rebut 12 % (la règle des conditions donne 15 % au-delà de 75 mm).

## Structure

```
supabase/schema.sql        tables mc_*, RLS, triggers, données initiales
web/src/lib/engine.js      moteur de calcul (formules Excel + mode corrigé)
web/src/lib/defaults.js    paramètres repris des classeurs
web/src/lib/engine.test.mjs tests de non-régression Excel
web/src/pages/*            écrans
```

## Déploiement (GitHub → Vercel)

1. Créer un dépôt **privé** sur GitHub (ex. `myc-smart-costing`), sans README.
2. Pousser le code :
   ```bash
   git remote add origin https://github.com/<votre-compte>/myc-smart-costing.git
   git push -u origin main
   ```
3. Sur vercel.com → **Add New… → Project** → importer le dépôt.
   - **Root Directory** : `web` · Framework : **Vite** (détecté) · Build : `npm run build` · Output : `dist`
   - **Environment Variables** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (valeurs de `web/.env`)
   - **Deploy**
4. Chaque `git push` sur `main` redéploie automatiquement.

`web/vercel.json` renvoie toutes les routes vers `index.html` (rechargement de `/pieces-3d`, `/devis/...` sans 404).
L'assistant IA reste servi par la fonction Supabase `mc-ai` (voir plus haut), pas par Vercel.

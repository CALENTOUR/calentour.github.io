# Installation de CalenTour

Durée : 20 minutes environ. Tout est gratuit (plan Firebase « Spark », GitHub Pages).

## 1. Créer le projet Firebase

1. Aller sur https://console.firebase.google.com, cliquer **Créer un projet**, nom : `calentour`. Google Analytics n'est pas nécessaire.
2. **Authentication** > **Commencer** > onglet **Sign-in method** > activer **Adresse e-mail/Mot de passe** (laisser « lien par e-mail » désactivé).
3. **Authentication** > **Paramètres** > **Domaines autorisés** > **Ajouter un domaine** : `calentour.github.io`.
4. **Firestore Database** > **Créer une base de données** > emplacement `eur3 (europe-west)` > démarrer en **mode production**.
5. **Paramètres du projet** (roue dentée) > **Vos applications** > icône **Web** `</>` > nom `CalenTour` (ne pas cocher Firebase Hosting). Copier l'objet `firebaseConfig` affiché.

## 2. Installer les règles de sécurité et les exemptions d'index

Les règles empêchent toute personne non invitée de lire ou d'écrire les données. Les exemptions d'index sont
obligatoires : sans elles, un secteur de plus de ~1 000 adresses dépasse la limite d'index de Firestore.

Depuis le Codespace :

```bash
npm install -g firebase-tools
firebase login --no-localhost
firebase use --add            # choisir le projet calentour
firebase deploy --only firestore
```

Sans la ligne de commande : copier le contenu de `firestore.rules` dans **Firestore** > **Règles** > **Publier**,
puis dans **Firestore** > **Index** > **Exemptions** ajouter deux exemptions sans aucun index :
collection `sectorAddresses` champ `addresses`, et collection `sectorVisits` (groupe de collections) champ `visits`.

## 3. Créer le premier administrateur

Les comptes ne peuvent être créés que sur invitation. La toute première invitation se crée à la main :

1. **Firestore** > **Démarrer une collection** : ID `invitations`.
2. ID du document : votre email **en minuscules** (ex. `dylan@exemple.fr`).
3. Champs : `name` (string) = votre nom, `role` (string) = `admin`.
4. Ouvrir l'application, cliquer **Première connexion**, saisir ce même email et un mot de passe.

Ensuite, les autres membres s'invitent depuis l'écran **Administration** de l'application.

## 4. Configurer l'application

En local (Codespace) : copier `.env.example` en `.env.local` et remplir les valeurs de `firebaseConfig` :

| Variable | Champ de firebaseConfig |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

`VITE_MAP_CENTER_LNG`, `VITE_MAP_CENTER_LAT` et `VITE_MAP_ZOOM` fixent le centre de la carte au premier lancement
(mettre les coordonnées de votre caserne).

Puis `npm run dev`.

Pour le site en ligne : dépôt GitHub > **Settings** > **Secrets and variables** > **Actions** :
- onglet **Secrets** : créer les 6 secrets `VITE_FIREBASE_…` ci-dessus ;
- onglet **Variables** (facultatif) : `VITE_MAP_CENTER_LNG`, `VITE_MAP_CENTER_LAT`, `VITE_MAP_ZOOM`.

La clé `apiKey` Firebase n'est pas un secret au sens strict (elle finit dans le code du site) : la protection des données
repose sur les règles Firestore de l'étape 2.

## 5. Activer GitHub Pages

Dépôt > **Settings** > **Pages** > **Source** : **GitHub Actions**.

Chaque push sur `main` lance `.github/workflows/deploy.yml` qui publie :
- l'application sur https://calentour.github.io/
- la démo sur https://calentour.github.io/demo/

## 6. Préparer la première tournée

1. **Administration** > **Communes** : ajouter vos communes.
2. **Campagnes** : créer la campagne de l'année (la première créée devient active).
3. **Secteurs** > **Nouveau secteur** : dessiner le contour sur la carte, choisir la commune et les membres.
4. Sur chaque secteur : **Importer OSM** récupère toutes les adresses numérotées d'OpenStreetMap.
   Compléter les maisons manquantes depuis la carte avec le bouton **＋**.
5. Inviter les membres dans **Administration**. Ils installent l'application depuis leur navigateur :
   - Android (Chrome) : menu ⋮ > **Installer l'application** ;
   - iPhone (Safari) : bouton Partager > **Sur l'écran d'accueil** ;
   - PC (Chrome / Edge) : icône d'installation dans la barre d'adresse.

## Hors ligne

- Il faut s'être connecté une première fois avec du réseau.
- Les zones de carte déjà affichées restent visibles sans réseau. Avant de partir, parcourir son secteur
  sur la carte (zooms 14 à 18) pour le garder en cache.
- Les passages saisis hors ligne sont gardés sur le téléphone (indicateur orange dans le menu)
  et envoyés automatiquement dès que le réseau revient.

## Limites du plan gratuit

| Limite Firebase Spark | Consommation CalenTour |
| --- | --- |
| 50 000 lectures / jour | ~100 lectures à l'ouverture de l'application (données regroupées par secteur), puis 1 lecture par passage saisi par appareil connecté |
| 20 000 écritures / jour | 1 écriture par passage |
| 1 Go stocké | quelques Mo pour 10 000 adresses et 10 campagnes |

Gardez chaque secteur sous ~2 500 adresses (limite de 1 Mo par document Firestore).

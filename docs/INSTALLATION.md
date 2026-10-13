# Installation de CalenTour

Durée : 20 minutes environ. Tout est gratuit (plan Firebase « Spark », GitHub Pages).

## 1. Créer le projet Firebase

1. Aller sur https://console.firebase.google.com, cliquer **Créer un projet**, nom : `calentour`. Google Analytics n'est pas nécessaire.
2. **Authentication** > **Commencer** > onglet **Sign-in method** > activer **Adresse e-mail/Mot de passe** (laisser « lien par e-mail » désactivé).
3. **Authentication** > **Paramètres** > **Domaines autorisés** > **Ajouter un domaine** : `calentour.github.io`.
4. **Firestore Database** > **Créer une base de données** > emplacement `eur3 (europe-west)` > démarrer en **mode production**.
5. **Paramètres du projet** (roue dentée) > **Vos applications** > icône **Web** `</>` > nom `CalenTour` (ne pas cocher Firebase Hosting). Copier l'objet `firebaseConfig` affiché.

## 2. Installer les règles de sécurité et les exemptions d'index

Les règles empêchent toute personne sans compte de lire ou d'écrire les données. Les exemptions d'index évitent
de dépasser la limite d'index de Firestore sur les gros documents (maisons d'une tournée, état d'une campagne).

Depuis le Codespace :

```bash
npm install -g firebase-tools
firebase login --no-localhost
firebase use --add            # choisir le projet calentour
firebase deploy --only firestore
```

Sans la ligne de commande : copier le contenu de `firestore.rules` dans **Firestore** > **Règles** > **Publier**,
puis dans **Firestore** > **Index** > **Exemptions** ajouter trois exemptions sans aucun index :
collection `tours` champs `houses` et `pieces`, groupe de collections `state` champ `h`.

## 3. Créer l'amicale et le premier administrateur

Ouvrir l'application : au tout premier lancement, elle propose de créer l'amicale (nom, identifiant et mot de passe
du premier administrateur). Ensuite, ce premier administrateur crée tous les autres accès depuis l'application.

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

## 6. Préparer les tournées

1. **Tournées** > **Choisir le fichier KML** : importer l'export de la carte Google My Maps
   (menu ⋮ > Télécharger le fichier KML > cocher « Exporter au format .KML »). Chaque trait devient une rue,
   chaque nom de trait (« 6 Aude / Logan ») une tournée et son binôme.
2. **Chercher les maisons** : les adresses officielles (Base Adresse Nationale) le long de chaque rue sont ajoutées.
3. Ouvrir chaque tournée pour corriger : ajouter une rue d'un clic, retirer un trait ou une maison, déclarer un immeuble
   et son nombre de logements, ranger les rues dans l'ordre de passage.
4. **Créer l'accès** de chaque binôme et imprimer sa carte d'accès.
5. Avant de partir, chaque binôme ouvre l'application avec du réseau et touche **Préparer le hors ligne**.

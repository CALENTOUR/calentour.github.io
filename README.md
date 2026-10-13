# CalenTour

Le suivi intelligent des tournées de calendriers.

Application web (PWA installable sur Android, iPhone et PC) pour les amicales de sapeurs-pompiers :
carte 3D des maisons avec leur statut, secteurs, campagnes annuelles, statistiques et exports.
Fonctionne hors ligne, synchronise au retour du réseau.

- Application : https://calentour.github.io/
- Démo publique (données fictives, aucun compte requis) : https://calentour.github.io/demo/

## Fonctionnalités

| Pour qui | Écran | Contenu |
| --- | --- | --- |
| Binôme | Ma tournée | Progression, montant collecté, une carte par rue de la tournée |
| Binôme | Rue | Carte 3D de la rue, maisons colorées par statut, saisie en 2 appuis, maison suivante, itinéraire |
| Binôme | Mes stats | Collecté, espèces, chèques, don moyen, % fait, à repasser, en direct |
| Admin | Tableau de bord | Totaux, taux de don, refus, repasses, dons par jour, classement des tournées, carte |
| Admin | Tournées | Import de la carte Google (KML), maisons officielles, ajout d'une rue d'un clic, immeubles, accès des binômes |
| Admin | Dons | Tous les passages, filtres, correction, export comptable Excel |
| Admin | Réglages | Campagne de l'année, classement visible ou non par les binômes, administrateurs |

Statuts : 🏠 À faire, 💶 A donné, 🔁 À repasser (absent ou « repassez »), ✋ Refus, 🚫 Habitation vide.
Aucun nom d'habitant n'est stocké.

## Stack

React 19, Vite 7, Firebase Authentication (identifiant + mot de passe créés par l'administrateur), Firestore avec cache persistant hors ligne,
MapLibre GL 5 avec le fond OpenStreetMap gratuit d'[OpenFreeMap](https://openfreemap.org) (aucune clé, aucun quota),
vite-plugin-pwa (service worker Workbox), ExcelJS. Adresses : Base Adresse Nationale. Hébergement GitHub Pages via GitHub Actions.

## Démarrer

```bash
npm install
npm run dev:demo   # démo locale, sans Firebase
npm run dev        # application réelle (nécessite .env.local, voir docs/INSTALLATION.md)
```

La mise en place de Firebase et du déploiement est décrite pas à pas dans [docs/INSTALLATION.md](docs/INSTALLATION.md),
l'architecture dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

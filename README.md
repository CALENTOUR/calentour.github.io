# CalenTour

Le suivi intelligent des tournées de calendriers.

Application web (PWA installable sur Android, iPhone et PC) pour les amicales de sapeurs-pompiers :
carte 3D des maisons avec leur statut, secteurs, campagnes annuelles, statistiques et exports.
Fonctionne hors ligne, synchronise au retour du réseau.

- Application : https://calentour.github.io/
- Démo publique (données fictives, aucun compte requis) : https://calentour.github.io/demo/

## Fonctionnalités

| Écran | Contenu |
| --- | --- |
| Carte 3D | OpenStreetMap vectoriel + bâtiments 3D, rotation, inclinaison, GPS, secteurs colorés avec % d'avancement, maisons colorées par statut, saisie d'un passage en un appui |
| Adresses | Liste filtrable (secteur, statut, recherche), saisie des passages, ajout et correction des adresses |
| Secteurs | Dessin des secteurs sur la carte, communes, affectation des membres, import automatique des adresses depuis OpenStreetMap |
| Statistiques | Dons, calendriers, refus, repasses, don moyen, moyens de paiement, comparaison N / N-1, par secteur, par commune, classement des membres |
| Campagnes | Une campagne par année, historique, campagne active |
| Administration | Invitations, rôles (Administrateur / Membre), désactivation, communes |
| Exports | Excel (adresses, secteurs, communes, membres) et PDF |

Statuts : ⚪ À faire, 🟢 Don réalisé, 🟠 Absent / Repasse, 🔴 Refus, ⚫ Vacant / Ruine / Tertiaire.
Aucun nom d'habitant n'est stocké : adresse, position GPS et commentaire uniquement.

## Stack

React 19, Vite 7, Firebase Authentication (email + mot de passe), Firestore avec cache persistant hors ligne,
MapLibre GL 5 avec le fond OpenStreetMap gratuit d'[OpenFreeMap](https://openfreemap.org) (aucune clé, aucun quota),
vite-plugin-pwa (service worker Workbox), ExcelJS, jsPDF. Hébergement GitHub Pages via GitHub Actions.

## Démarrer

```bash
npm install
npm run dev:demo   # démo locale, sans Firebase
npm run dev        # application réelle (nécessite .env.local, voir docs/INSTALLATION.md)
```

La mise en place de Firebase et du déploiement est décrite pas à pas dans [docs/INSTALLATION.md](docs/INSTALLATION.md),
l'architecture dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

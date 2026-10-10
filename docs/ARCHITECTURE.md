# Architecture

```
src/
  config/constants.js      statuts, couleurs, rôles, fond de carte
  lib/firebase.js          initialisation Firebase + cache Firestore persistant (hors ligne)
  lib/geo.js               point dans polygone, centre, emprise
  lib/osm.js               import d'adresses OpenStreetMap (Overpass) + géocodage inverse (Nominatim)
  lib/stats.js             agrégations : global, secteur, commune, membre
  lib/exports.js           Excel (ExcelJS) et PDF (jsPDF), chargés à la demande
  services/                toutes les écritures Firestore, une fonction par action métier
  context/AuthContext.jsx  utilisateur Firebase + profil (rôle, actif)
  context/DataContext.jsx  abonnements temps réel partagés par toutes les pages
  components/map/          MapLibre (3D, GPS, couches secteurs/adresses, éditeur de polygone)
  components/              fiche de passage, formulaire d'adresse, éléments d'interface
  pages/                   un fichier par entrée du menu
  demo/                    remplaçants locaux de Firebase pour la démo publique
```

## Modèle de données Firestore

Le plan gratuit limite les lectures à 50 000 par jour. Un document par maison coûterait
(nombre d'adresses × nombre de membres) lectures à chaque ouverture, soit plusieurs centaines de milliers
pour 50 membres et 3 000 adresses. Les adresses et les passages sont donc regroupés **par secteur** :

| Chemin | Contenu |
| --- | --- |
| `users/{uid}` | `name`, `email`, `role` (`admin` / `member`), `active` |
| `invitations/{email}` | `name`, `role` |
| `communes/{id}` | `name` |
| `sectors/{id}` | `name`, `color`, `polygon` [{lng, lat}], `communeId`, `memberIds` [] |
| `sectorAddresses/{sectorId}` | `addresses` : { idAdresse: { `label`, `lat`, `lng`, `comment` } } |
| `campaigns/{année}` | `year`, `active` |
| `campaigns/{année}/sectorVisits/{sectorId}` | `visits` : { idAdresse: Visite } |

Visite : `status`, `calendars`, `cash`, `cheque`, `card`, `transfer`, `total`, `comment`, `userId`, `date`.

Chaque saisie modifie un seul champ du document du secteur (`visits.<idAdresse>`) : deux membres
qui travaillent dans le même secteur, même hors ligne, ne s'écrasent pas.

Une adresse garde un seul état par campagne (le dernier passage). L'historique se lit d'une campagne à l'autre.

## Hors ligne

- Firestore `persistentLocalCache` (IndexedDB) : lecture des données sans réseau, écritures en file d'attente.
- Service worker Workbox : application précachée, tuiles OpenFreeMap en cache (60 jours, 5 000 tuiles).
- Si le fond de carte ne charge pas, un fond uni de secours s'affiche : secteurs et maisons restent utilisables.

## Rôles

| Action | Membre | Administrateur |
| --- | --- | --- |
| Voir carte, adresses, secteurs, stats, campagnes | oui | oui |
| Saisir un passage (campagne active) | oui | oui |
| Exporter Excel / PDF | oui | oui |
| Gérer adresses, secteurs, communes, campagnes | non | oui |
| Inviter, changer un rôle, désactiver un compte | non | oui |

Les droits sont appliqués côté serveur par `firestore.rules`, l'interface ne fait que masquer les boutons.

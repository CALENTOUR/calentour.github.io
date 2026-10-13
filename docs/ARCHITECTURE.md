# Architecture (v2)

```
src/
  config/constants.js        statuts, modes de paiement, couleurs, fond de carte
  lib/firebase.js            Firebase + cache Firestore persistant (hors ligne) + instance de création de comptes
  lib/kml.js                 lecture de l'export Google My Maps (traits = rues, noms = binômes)
  lib/addresses.js           maisons le long des rues (Base Adresse Nationale, géocodage inverse)
  lib/tourBuilder.js         rattachement des maisons aux rues, fusion des rues de même nom
  lib/geo.js                 distances, projection sur un tracé, tracés à plat pour Firestore
  lib/stats.js               statistiques par tournée, par rue, globales, par jour
  lib/exports.js             export comptable Excel (chargé à la demande)
  lib/offlineMap.js          téléchargement à l'avance du fond de carte d'une tournée
  services/                  écritures Firestore (tournées, passages, comptes)
  context/                   utilisateur connecté, abonnements temps réel
  components/map/            carte MapLibre 3D, pictogrammes maison / immeuble, clic sur une rue
  pages/member/              Ma tournée, vue d'une rue (carte + liste), Mes stats
  pages/admin/               Tableau de bord, Tournées, édition d'une tournée, Dons, Réglages
  demo/                      remplaçants locaux de Firebase pour la démo publique
```

## Modèle de données Firestore

| Chemin | Contenu |
| --- | --- |
| `settings/app` | `amicale`, `year` (campagne en cours), `rankingForMembers` |
| `users/{uid}` | `login`, `name`, `role` (`admin` / `member`), `tourId`, `active` |
| `tours/{id}` (au départ : `src/config/tours.json`, tracés de la carte Google, chargés automatiquement) | `number`, `name`, `members`, `color`, `pieces` [{ `id`, `name`, `lines` [{ `c`: [lng, lat, …], `r`? }] }], `houses` [{ `id`, `label`, `lng`, `lat`, `pieceId`, `along`, `units`? }] |
| `campaigns/{année}/state/{tourId}` | `h` : { cléHabitation: { `s`, `amount`, `mode`, `at`, `by` } } |
| `campaigns/{année}/passages/{id}` | journal de tous les passages (historique) |

Une tournée = une équipe (souvent un binôme, parfois plus ou moins). `r` est la rue complète le long de laquelle on fait glisser les extrémités d’un trait dans l’éditeur. Ses rues (`pieces`) sont les sous-onglets de « Ma tournée ». Une habitation est une maison,
ou un logement d'immeuble (clé `maison__logement`).

Statuts : `todo` À faire, `given` A donné, `again` À repasser, `refused` Refus, `empty` Habitation vide.
Modes : `cash` Espèces, `cheque` Chèque.

## Quota gratuit

Un binôme ne lit que 2 documents (sa tournée et son état). L'administrateur lit un document par tournée.
Avec 20 tournées et 45 pompiers, on reste très loin des 50 000 lectures par jour du plan gratuit.

## Hors ligne

- Firestore `persistentLocalCache` : lecture sans réseau, écritures en file d'attente (dernière saisie gagnante).
- Service worker Workbox : application précachée, tuiles OpenFreeMap en cache.
- « Préparer le hors ligne » télécharge à l'avance le fond de carte autour de la tournée.
- Sans fond de carte, rues et maisons restent affichées sur fond uni.

## Comptes

Les identifiants (`tournee7`) sont convertis en adresse technique `tournee7@calentour.app` pour Firebase Authentication.
L'administrateur crée les comptes depuis une seconde instance Firebase, sans être déconnecté.
Un mot de passe oublié se remplace en créant un nouvel accès (l'ancien est désactivé).

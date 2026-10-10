// Modèle de données Firestore.
//
// Le plan gratuit Firebase (Spark) autorise 50 000 lectures par jour. Pour tenir
// avec ~50 utilisateurs et plusieurs milliers d'adresses, les adresses et les
// visites sont regroupées par secteur : un document par secteur au lieu d'un
// document par maison. Ouvrir l'application coûte alors quelques dizaines de
// lectures au lieu de plusieurs milliers.
//
// users/{uid}                                  { name, email, role, active }
// invitations/{email}                          { name, role }
// communes/{id}                                { name }
// sectors/{id}                                 { name, color, polygon[{lng,lat}], communeId, memberIds[] }
// sectorAddresses/{sectorId}                   { addresses: { [addressId]: { label, lat, lng, comment } } }
// campaigns/{year}                             { year, active }
// campaigns/{year}/sectorVisits/{sectorId}     { visits: { [addressId]: Visit } }
//
// Visit = { status, calendars, cash, cheque, card, transfer, total, comment, userId, date }

export const COL = {
  users: 'users',
  invitations: 'invitations',
  communes: 'communes',
  sectors: 'sectors',
  sectorAddresses: 'sectorAddresses',
  campaigns: 'campaigns',
  sectorVisits: 'sectorVisits',
}

import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

// Tournée affichée : celle du binôme connecté, ou celle choisie par un admin
// (route /admin/tournees/:tourId/terrain/...).
export function useTourContext() {
  const { tourId } = useParams()
  const { profile } = useAuth()
  const { myTour, toursById, statesById, year, settings } = useData()
  const tour = tourId ? toursById[tourId] ?? null : myTour
  return {
    tour,
    state: tour ? statesById[tour.id] : null,
    year,
    settings,
    user: profile,
    base: tourId ? `/admin/tournees/${tourId}/terrain` : '/tournee',
  }
}

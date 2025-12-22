// mapChart.js
import { getAthleteColor } from './chartUtils.js';

let map;
let polylines = [];

function initMap() {
  if (map) return;

  map = L.map('map').setView([46.2276, 2.2137], 6);

  // Tuiles Stadia Alidade Dark (optimisées pour le dark mode)
  L.tileLayer('https://tiles.stadiamaps.com/styles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.com/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 20
  }).addTo(map);
}

function showMapChart(filteredData) {
  if (!map) initMap();
  if (!filteredData || filteredData.length === 0) {
    console.warn("Aucune donnée à afficher pour la carte.");
    return;
  }

  // Supprime les polylines existantes
  polylines.forEach(polyline => map.removeLayer(polyline));
  polylines = [];

  // Filtre les activités avec des polylines valides
  const activitiesWithPolylines = filteredData.filter(activity =>
    activity.tracemap &&
    activity.tracemap.polyline &&
    typeof activity.tracemap.polyline === 'string' &&
    activity.tracemap.polyline.trim() !== ""
  );

  if (activitiesWithPolylines.length === 0) {
    console.warn("Aucune activité avec une polyline valide.");
    return;
  }

  // Ajoute les nouvelles polylines
  activitiesWithPolylines.forEach(activity => {
    try {
      const decodedPoints = decodePolyline(activity.tracemap.polyline);

      // Vérifie que les points décodés sont valides
      if (!decodedPoints || decodedPoints.length === 0) {
        console.warn(`Polyline invalide pour l'activité ${activity.name || activity.activity_id}`);
        return;
      }

      // Vérifie que tous les points ont des coordonnées valides
      const validPoints = decodedPoints.filter(point =>
        !isNaN(point[0]) && !isNaN(point[1]) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180
      );

      if (validPoints.length === 0) {
        console.warn(`Aucun point valide pour l'activité ${activity.name || activity.activity_id}`);
        return;
      }

      // Utilise getAthleteColor pour obtenir la même couleur que dans les graphiques
      const color = getAthleteColor(activity.athlete_id);

      const polyline = L.polyline(validPoints, {
        color: color,
        weight: 4,
        opacity: 0.9,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      polyline.bindPopup(`
        <b>${activity.name || 'Activité'}</b><br>
        Athlète: ${activity.athlete_id}<br>
        Sport: ${activity.sport || 'Inconnu'}<br>
        Date: ${activity.date || 'Inconnue'}<br>
        Dénivelé: ${activity.elevation_gain_m || 0} m<br>
        Distance: ${(activity.distance_m / 1000).toFixed(2)} km
      `);

      polylines.push(polyline);
    } catch (e) {
      console.error(`Erreur lors du traitement de l'activité ${activity.name || activity.activity_id}:`, e);
    }
  });

  // Ajuste la vue de la carte
  if (polylines.length > 0) {
    try {
      const group = new L.FeatureGroup(polylines);
      map.fitBounds(group.getBounds().pad(0.5));
    } catch (e) {
      console.error("Erreur lors de l'ajustement de la vue de la carte:", e);
      map.setView([46.2276, 2.2137], 6); // Vue par défaut si erreur
    }
  } else {
    map.setView([46.2276, 2.2137], 6); // Vue par défaut si aucune polyline
  }
}

// Fonction pour décoder une polyline
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    console.error("Polyline non valide:", encoded);
    return [];
  }

  let points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    // Décode la latitude
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    // Réinitialise pour la longitude
    shift = 0;
    result = 0;

    // Décode la longitude
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    // Convertit en coordonnées réelles
    const latitude = lat * 1e-5;
    const longitude = lng * 1e-5;

    // Ajoute le point aux résultats
    points.push([latitude, longitude]);
  }

  return points;
}

export { initMap, showMapChart };

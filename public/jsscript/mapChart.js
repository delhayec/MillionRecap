// mapChart.js
import { getAthleteColor } from './chartUtils.js';

let map;
let polylines = [];

function initMap() {
  if (map) return;

  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error("L'élément de la carte n'existe pas dans le DOM.");
    return;
  }

  map = L.map('map').setView([46.2276, 2.2137], 6);

  // Tuiles CartoDB Dark (gratuit, pas de clé API)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }).addTo(map);
}

function generateLegend(activities) {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) {
    console.error("Le conteneur de légende n'existe pas dans le DOM.");
    return;
  }

  const uniqueAthletes = [...new Set(activities.map(activity => activity.athlete_id))];
  legendContainer.innerHTML = '<h3 style="color: #fff; margin-top: 0;">Légende</h3>';

  uniqueAthletes.forEach(athleteId => {
    const color = getAthleteColor(athleteId);
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color';
    colorBox.style.backgroundColor = color;

    const text = document.createElement('div');
    text.className = 'legend-text';
    text.textContent = `Athlète ${athleteId}`;

    legendItem.appendChild(colorBox);
    legendItem.appendChild(text);
    legendContainer.appendChild(legendItem);
  });
}

function showMapChart(filteredData) {
  if (!filteredData || filteredData.length === 0) {
    console.warn("Aucune donnée à afficher pour la carte.");
    return;
  }

  if (!map) initMap();

  polylines.forEach(polyline => map.removeLayer(polyline));
  polylines = [];

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

  generateLegend(activitiesWithPolylines);

  activitiesWithPolylines.forEach(activity => {
    try {
      const decodedPoints = decodePolyline(activity.tracemap.polyline);
      if (!decodedPoints || decodedPoints.length === 0) return;

      const validPoints = decodedPoints.filter(point =>
        !isNaN(point[0]) && !isNaN(point[1])
      );
      if (validPoints.length === 0) return;

      const color = getAthleteColor(activity.athlete_id);
      const polyline = L.polyline(validPoints, {
        color: color,
        weight: 4,
        opacity: 0.9
      }).addTo(map);

      polyline.bindPopup(`
        <b>${activity.name || 'Activité'}</b><br>
        Athlète: ${activity.athlete_id}<br>
        Sport: ${activity.sport || 'Inconnu'}
      `);
      polylines.push(polyline);
    } catch (e) {
      console.error(`Erreur pour l'activité ${activity.activity_id}:`, e);
    }
  });

  if (polylines.length > 0) {
    const group = new L.FeatureGroup(polylines);
    map.fitBounds(group.getBounds().pad(0.5));
  }
}

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];

  let points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat * 1e-5, lng * 1e-5]);
  }

  return points;
}

export { initMap, showMapChart };

// ==============================
// PALETTE DE COULEURS
// ==============================
const athleteColors = [
  '#FF6B6B', // Rouge corail
  '#4ECDC4', // Turquoise
  '#45B7D1', // Bleu ciel
  '#FFA07A', // Saumon
  '#98D8C8', // Menthe
  '#F7DC6F', // Jaune doré
  '#BB8FCE', // Violet pastel
  '#85C1E2', // Bleu clair
  '#F8B88B', // Pêche
  '#52B788', // Vert émeraude
  '#F06292', // Rose
  '#AED581', // Vert lime
  '#FFD54F'  // Jaune ambre
];

const sportColors = {
  'Run': '#B7705C',
  'Bike': '#F4C430',
  'Hike': '#52B788',
  'Ski mountaineering': '#45B7D1'
};

// Mapping des sports bruts vers les catégories simplifiées
const sportMapping = {
  'Run': 'Run',
  'TrailRun': 'Run',
  'Ride': 'Bike',
  'MountainBike': 'Bike',
  'Hike': 'Hike',
  'Walk': 'Hike',
  'BackcountrySki': 'Ski mountaineering',
  'Alpinism': 'Ski mountaineering'
};

const athleteColorMap = {};

export function getAthleteColor(athleteId) {
  if (!athleteColorMap[athleteId]) {
    const index = Object.keys(athleteColorMap).length;
    athleteColorMap[athleteId] = athleteColors[index % athleteColors.length];
  }
  return athleteColorMap[athleteId];
}

export function getSportColor(sport) {
  const mappedSport = sportMapping[sport] || sport;
  return sportColors[mappedSport] || '#888888'; // Gris par défaut
}

export function mapSportName(sport) {
  return sportMapping[sport] || sport;
}

// ==============================
// GESTION DES DATES
// ==============================
export function generateAllDays(year) {
  const allDays = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDays.push(new Date(d).toISOString().split('T')[0]);
  }
  return allDays;
}

export function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function formatDate(date, options) {
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'long' });
  const year = date.getFullYear();
  let dayStr = day.toString();
  if (day === 1) dayStr = "1er";
  return `${dayStr} ${month} ${year}`;
}

export function getOrdinalSuffix(num) {
  if (num === 1) return 'er';
  return 'e';
}

// Formater les grands nombres (10 000 → 10,0k)
export function formatElevation(value) {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${value.toFixed(0)}`;
}

// ==============================
// CHARGEMENT DES DONNÉES
// ==============================
export async function loadData() {
  // Liste des chemins possibles (ordre de priorité)
  const possiblePaths = [
    '/data/activities_2025.json',        // Git (production)
    '/public/data/activities_2025.json', // PyCharm (local)
    'data/activities_2025.json',         // Chemin relatif
    './data/activities_2025.json'        // Chemin relatif avec ./
  ];

  // Essayer chaque chemin jusqu'à ce qu'un fonctionne
  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        console.log(`Données chargées depuis: ${path}`, data);
        return data;
      }
    } catch (error) {
      // Continuer avec le prochain chemin
      continue;
    }
  }

  // Si aucun chemin ne fonctionne
  throw new Error('Impossible de charger le fichier JSON. Chemins testés: ' + possiblePaths.join(', '));
}

// ==============================
// DÉCODAGE POLYLINE
// ==============================
export function decodePolyline(encoded) {
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

// ==============================
// STATISTIQUES
// ==============================
export function updateStats(filteredData) {
  if (!filteredData || filteredData.length === 0) {
    document.getElementById('totalElevation').textContent = '0 m';
    document.getElementById('totalActivities').textContent = '0';
    document.getElementById('totalDistance').textContent = '0 km';
    document.getElementById('totalTime').textContent = '0 h';
    document.getElementById('bestDay').textContent = '-';
    document.getElementById('bestWeek').textContent = '-';
    return;
  }

  const totalElevation = filteredData.reduce((sum, activity) => sum + (activity.elevation_gain_m || 0), 0);
  const totalActivities = filteredData.length;
  const totalDistance = (filteredData.reduce((sum, activity) => sum + (activity.distance_m || 0), 0) / 1000).toFixed(2);
  const totalTime = Math.round(filteredData.reduce((sum, activity) => sum + (activity.moving_time_s || 0), 0) / 3600);

  document.getElementById('totalElevation').textContent = `${totalElevation} m`;
  document.getElementById('totalActivities').textContent = totalActivities;
  document.getElementById('totalDistance').textContent = `${totalDistance} km`;
  document.getElementById('totalTime').textContent = `${totalTime} h`;

  const bestDay = findBestDay(filteredData);
  document.getElementById('bestDay').textContent = bestDay ?
    `${bestDay.date} (${bestDay.elevation} m)` : '-';

  const bestWeek = findBestWeek(filteredData);
  document.getElementById('bestWeek').textContent = bestWeek ?
    `${bestWeek.period} (${bestWeek.elevation} m)` : '-';
}

function findBestDay(data) {
  if (!data || data.length === 0) return null;

  const dailyElevation = {};
  data.forEach(activity => {
    if (!activity.date) return;
    const date = activity.date.split('T')[0];
    dailyElevation[date] = (dailyElevation[date] || 0) + (activity.elevation_gain_m || 0);
  });

  let bestDate = null;
  let bestElevation = 0;
  for (const date in dailyElevation) {
    if (dailyElevation[date] > bestElevation) {
      bestElevation = dailyElevation[date];
      bestDate = date;
    }
  }

  if (!bestDate) return null;

  const dateObj = new Date(bestDate);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = formatDate(dateObj, options);

  return { date: formattedDate, elevation: bestElevation };
}

function findBestWeek(data) {
  if (!data || data.length === 0) return null;

  const weeklyElevation = {};
  const weeklyDates = {};

  data.forEach(activity => {
    if (!activity.date) return;

    const date = new Date(activity.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-${week}`;

    weeklyElevation[weekKey] = (weeklyElevation[weekKey] || 0) + (activity.elevation_gain_m || 0);

    if (!weeklyDates[weekKey]) {
      weeklyDates[weekKey] = { min: date, max: date };
    } else {
      if (date < weeklyDates[weekKey].min) weeklyDates[weekKey].min = date;
      if (date > weeklyDates[weekKey].max) weeklyDates[weekKey].max = date;
    }
  });

  let bestWeekKey = null;
  let bestElevation = 0;
  for (const weekKey in weeklyElevation) {
    if (weeklyElevation[weekKey] > bestElevation) {
      bestElevation = weeklyElevation[weekKey];
      bestWeekKey = weekKey;
    }
  }

  if (!bestWeekKey) return null;

  const startDate = weeklyDates[bestWeekKey].min;
  const endDate = weeklyDates[bestWeekKey].max;

  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedStartDate = formatDate(startDate, options);
  const formattedEndDate = formatDate(endDate, options);

  return {
    period: `${formattedStartDate} - ${formattedEndDate}`,
    elevation: bestElevation
  };
}
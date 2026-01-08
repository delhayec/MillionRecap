// ==============================
// PALETTE DE COULEURS — REFONTE 2025
// ==============================
const athleteColors = [
  '#f97316', // Orange vif (accent principal)
  '#22d3ee', // Cyan électrique
  '#a855f7', // Violet
  '#10b981', // Émeraude
  '#f43f5e', // Rose rouge
  '#eab308', // Jaune doré
  '#3b82f6', // Bleu vif
  '#ec4899', // Magenta
  '#14b8a6', // Teal
  '#f59e0b', // Ambre
  '#8b5cf6', // Indigo
  '#06b6d4', // Cyan clair
  '#84cc16'  // Lime
];

const sportColors = {
  'Run': '#f97316',           // Orange
  'Bike': '#eab308',          // Jaune doré
  'Hike': '#10b981',          // Émeraude
  'Ski mountaineering': '#22d3ee' // Cyan
};

// Mapping des IDs vers les noms d'athlètes
const athleteNames = {
  '3953180': 'Clement D',
  '6635902': 'Bapt I',
  '3762537': 'Bapt M',
  '68391361': 'Elo F',
  '5231535': 'Franck P',
  '87904944': 'Guillaume B',
  '1841009': 'Mana S',
  '106477520': 'Matt X',
  '119310419': 'Max 2Peuf',
  '19523416': 'Morguy D',
  '110979265': 'Pef B',
  '84388438': 'Remi S',
  '25332977': 'Thomas G'
};

// Mapping inverse : nom -> ID
const athleteIds = Object.fromEntries(
  Object.entries(athleteNames).map(([id, name]) => [name, id])
);

export function getAthleteName(athleteId) {
  return athleteNames[String(athleteId)] || `Athlète ${athleteId}`;
}

export function getAthleteIdFromName(name) {
  return athleteIds[name] || name.replace('Athlète ', '');
}

// Mapping des sports bruts vers les catégories simplifiées
const sportMapping = {
  'Run': 'Run',
  'TrailRun': 'Run',
  'Ride': 'Bike',
  'MountainBikeRide': 'Bike',
  'Hike': 'Hike',
  'Walk': 'Hike',
  'Snowshoe': 'Hike',
  'RockClimbing': 'Hike',
  'BackcountrySki': 'Ski mountaineering',
  'NordicSki': 'Ski mountaineering'
};

// Sports à exclure (assistés, virtuels, sans dénivelé pertinent)
const excludedSports = [
  'AlpineSki',
  'Snowboard',
  'EBikeRide',
  'EMountainBikeRide',
  'VirtualRide',
  'VirtualRun',
  'Sail',
  'Kitesurf',
  'Swim',
  'Yoga',
  'WeightTraining',
  'Rowing',
  'StandUpPaddling',
  'Crossfit',
  'HighIntensityIntervalTraining',
  'Workout',
  'IceSkate',
  'Surfing'
];

export function isExcludedSport(sport) {
  return excludedSports.includes(sport);
}

export function filterValidActivities(data) {
  return data.filter(activity => !isExcludedSport(activity.sport_type));
}

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
  return sportColors[mappedSport] || '#888888';
}

export function mapSportName(sport) {
  return sportMapping[sport] || sport;
}

// ==============================
// GESTION DES DATES
// ==============================
export function generateAllDays(year) {
  const allDays = [];

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      allDays.push(`${year}-${monthStr}-${dayStr}`);
    }
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
// CHARGEMENT DES DONNÉES AVEC CACHE
// ==============================

// Clé pour le cache localStorage
const CACHE_KEY = 'recapmillion_activities_cache';
const CACHE_VERSION_KEY = 'recapmillion_cache_version';
const CURRENT_CACHE_VERSION = '1.0'; // Incrémenter pour forcer le rechargement

export async function loadData() {
  // Vérifier si le cache existe et est valide
  const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  const cachedData = localStorage.getItem(CACHE_KEY);

  if (cachedVersion === CURRENT_CACHE_VERSION && cachedData) {
    try {
      const data = JSON.parse(cachedData);

      // Gérer différents formats de données
      let activities;
      if (Array.isArray(data)) {
        activities = data;
      } else if (data.activities && Array.isArray(data.activities)) {
        activities = data.activities;
      } else {
        throw new Error('Format de données invalide dans le cache');
      }

      console.log('✅ Données chargées depuis le cache localStorage');
      console.log(`📦 ${activities.length} activités en cache`);
      return activities;
    } catch (error) {
      console.warn('⚠️ Cache corrompu, rechargement depuis le serveur...', error);
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_VERSION_KEY);
    }
  }

  // Sinon, charger depuis le serveur
  console.log('🔄 Chargement des données depuis le serveur...');

  const possiblePaths = [
    '/data/all_activities_2025.json',
    '/public/data/all_activities_2025.json',
    'data/all_activities_2025.json',
    './data/all_activities_2025.json'
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const rawData = await response.json();

        // Gérer différents formats de données
        let data;
        if (Array.isArray(rawData)) {
          data = rawData;
        } else if (rawData.activities && Array.isArray(rawData.activities)) {
          data = rawData.activities;
        } else {
          console.error('Format de données JSON invalide');
          continue;
        }

        console.log(`✅ Données chargées depuis: ${path}`);
        console.log(`📦 ${data.length} activités`);

        // Sauvegarder dans le cache (toujours sauvegarder le tableau)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
          console.log('💾 Données mises en cache');
        } catch (storageError) {
          console.warn('⚠️ Impossible de sauvegarder dans le cache:', storageError.message);
          // Si localStorage est plein, on continue sans cache
        }

        return data;
      }
    } catch (error) {
      console.error(`Erreur lors du chargement de ${path}:`, error);
      continue;
    }
  }

  throw new Error('Impossible de charger le fichier JSON. Chemins testés: ' + possiblePaths.join(', '));
}

// Fonction pour charger les données de groupe avec cache
export async function loadGroupActivitiesWithCache() {
  const GROUPS_CACHE_KEY = 'recapmillion_groups_cache';

  // Vérifier le cache
  const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  const cachedGroups = localStorage.getItem(GROUPS_CACHE_KEY);

  if (cachedVersion === CURRENT_CACHE_VERSION && cachedGroups) {
    try {
      const data = JSON.parse(cachedGroups);
      console.log('✅ Données de groupe chargées depuis le cache');
      return data;
    } catch (error) {
      localStorage.removeItem(GROUPS_CACHE_KEY);
    }
  }

  // Charger depuis le serveur
  try {
    const response = await fetch('data/activities_with_groups.json');
    const data = await response.json();
    const groups = data.group_activities || [];

    // Sauvegarder dans le cache
    try {
      localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(groups));
      console.log('💾 Données de groupe mises en cache');
    } catch (storageError) {
      console.warn('⚠️ Impossible de sauvegarder les groupes dans le cache');
    }

    return groups;
  } catch (e) {
    console.warn('Fichier activities_with_groups.json non trouvé');
    return null;
  }
}

// Fonction pour vider le cache (utile pour le développement)
export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_VERSION_KEY);
  localStorage.removeItem('recapmillion_groups_cache');
  console.log('🗑️ Cache vidé');
}

// Fonction pour obtenir des infos sur le cache
export function getCacheInfo() {
  const hasCache = localStorage.getItem(CACHE_KEY) !== null;
  const version = localStorage.getItem(CACHE_VERSION_KEY);

  if (!hasCache) {
    return { cached: false };
  }

  try {
    const rawData = JSON.parse(localStorage.getItem(CACHE_KEY));
    const size = new Blob([localStorage.getItem(CACHE_KEY)]).size;
    const sizeKB = (size / 1024).toFixed(2);

    // Gérer différents formats
    let activities = Array.isArray(rawData) ? rawData : (rawData.activities || []);

    return {
      cached: true,
      version: version,
      activities: activities.length,
      sizeKB: sizeKB,
      upToDate: version === CURRENT_CACHE_VERSION
    };
  } catch (error) {
    return { cached: false, error: true };
  }
}

// Exposer la fonction clearCache dans la console pour le développement
if (typeof window !== 'undefined') {
  window.clearRecapCache = clearCache;
  window.getCacheInfo = getCacheInfo;
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
let statsAnimated = false;

export function updateStats(filteredData) {
  const TARGET = 1000000;

  if (!filteredData || filteredData.length === 0) {
    document.getElementById('totalElevation').textContent = '0';
    document.getElementById('totalActivities').textContent = '0';
    document.getElementById('totalDistance').textContent = '0';
    document.getElementById('totalTime').textContent = '0';
    document.getElementById('bestDay').textContent = '-';
    document.getElementById('bestWeek').textContent = '-';
    updateProgressBar(0, TARGET);
    return;
  }

  const totalElevation = filteredData.reduce((sum, activity) => sum + (activity.total_elevation_gain || 0), 0);
  const totalActivities = filteredData.length;
  const totalDistance = Math.round(filteredData.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000);
  const totalTime = Math.round(filteredData.reduce((sum, activity) => sum + (activity.moving_time || 0), 0) / 3600);

  // Stocker les valeurs pour l'animation
  window.statsValues = { totalElevation, totalActivities, totalDistance, totalTime, TARGET };

  const bestDay = findBestDay(filteredData);
  document.getElementById('bestDay').textContent = bestDay ?
    `${bestDay.date} (${bestDay.elevation.toLocaleString('fr-FR')} m)` : '-';

  const bestWeek = findBestWeek(filteredData);
  document.getElementById('bestWeek').textContent = bestWeek ?
    `${bestWeek.period} (${bestWeek.elevation.toLocaleString('fr-FR')} m)` : '-';

  // Observer pour déclencher l'animation quand visible
  const statsSection = document.getElementById('statsSection');
  if (statsSection && !statsAnimated) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !statsAnimated) {
          statsAnimated = true;
          triggerStatsAnimation();
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    observer.observe(statsSection);
  } else if (statsAnimated) {
    // Si déjà animé une fois, mettre à jour directement
    document.getElementById('totalElevation').textContent = totalElevation.toLocaleString('fr-FR');
    document.getElementById('totalActivities').textContent = totalActivities.toLocaleString('fr-FR');
    document.getElementById('totalDistance').textContent = totalDistance.toLocaleString('fr-FR');
    document.getElementById('totalTime').textContent = totalTime.toLocaleString('fr-FR');
    updateProgressBar(totalElevation, TARGET);
  }
}

function triggerStatsAnimation() {
  const { totalElevation, totalActivities, totalDistance, totalTime, TARGET } = window.statsValues;

  animateValue('totalElevation', totalElevation);
  animateValue('totalActivities', totalActivities);
  animateValue('totalDistance', totalDistance);
  animateValue('totalTime', totalTime);
  updateProgressBar(totalElevation, TARGET);
}

function animateValue(elementId, endValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const duration = 2000;
  const startTime = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out-expo)
    const easeOutExpo = 1 - Math.pow(2, -10 * progress);
    const current = Math.floor(startValue + (endValue - startValue) * easeOutExpo);

    element.textContent = current.toLocaleString('fr-FR');

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function updateProgressBar(current, target) {
  const progressBar = document.getElementById('progressBar');
  if (!progressBar) return;

  const percentage = Math.min((current / target) * 100, 100);

  // Reset pour animation
  progressBar.style.transition = 'none';
  progressBar.style.width = '0%';

  // Déclencher l'animation après un court délai
  setTimeout(() => {
    progressBar.style.transition = 'width 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
    progressBar.style.width = percentage + '%';

    // Célébration si objectif atteint !
    if (current >= target) {
      setTimeout(() => {
        progressBar.classList.add('goal-reached');
        createConfetti();
      }, 2500);
    }
  }, 100);
}

function createConfetti() {
  const container = document.getElementById('statsSection');
  if (!container) return;

  const colors = ['#f97316', '#22d3ee', '#a855f7', '#10b981', '#eab308'];

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.cssText = `
      position: absolute;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: 0;
      opacity: 1;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      animation: confetti-fall ${2 + Math.random() * 2}s ease-out forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 4000);
  }
}

// Reset l'état d'animation quand on change de filtre
export function resetStatsAnimation() {
  statsAnimated = false;
}

function findBestDay(data) {
  if (!data || data.length === 0) return null;

  const dailyElevation = {};
  data.forEach(activity => {
    if (!activity.start_date) return;
    const date = activity.start_date.split('T')[0];
    dailyElevation[date] = (dailyElevation[date] || 0) + (activity.total_elevation_gain || 0);
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
    if (!activity.start_date) return;

    const date = new Date(activity.start_date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-${week}`;

    weeklyElevation[weekKey] = (weeklyElevation[weekKey] || 0) + (activity.total_elevation_gain || 0);

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
// ==============================
// NORMALISATION DES ACTIVITÉS MULTI-JOURS
// ==============================
export function normalizeMultiDayActivities(data) {
  const normalizedData = [];
  
  data.forEach(activity => {
    const startDate = new Date(activity.start_date);
    const endDate = new Date(startDate.getTime() + (activity.elapsed_time || activity.moving_time || 0) * 1000);
    
    // Calculer le nombre de jours
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const daysDiff = Math.ceil((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculer le ratio entre temps écoulé et temps de déplacement
    const elapsedTime = activity.elapsed_time || 0;
    const movingTime = activity.moving_time || 0;
    const restRatio = movingTime > 0 ? (elapsedTime - movingTime) / movingTime : 0;
    
    // Conditions pour lisser :
    // 1. Activité de plusieurs jours
    // 2. ET ratio repos/effort > 0.4 (beaucoup de temps de repos = bivouac/trek)
    // Si le ratio est faible, c'est un ultratrail en continu, on ne lisse pas
    const shouldSmooth = daysDiff > 1 && restRatio > 0.4;
    
    if (!shouldSmooth) {
      // Activité normale ou ultratrail en continu
      normalizedData.push(activity);
    } else {
      // Activité multi-jours avec bivouacs : diviser en plusieurs jours
      const elevationPerDay = (activity.total_elevation_gain || 0) / daysDiff;
      const distancePerDay = (activity.distance || 0) / daysDiff;
      const timePerDay = (activity.moving_time || 0) / daysDiff;
      
      for (let i = 0; i < daysDiff; i++) {
        const dayDate = new Date(startDay.getTime() + i * 24 * 60 * 60 * 1000);
        const isoDate = dayDate.toISOString();
        
        normalizedData.push({
          ...activity,
          activity_id: `${activity.activity_id}_day${i + 1}`,
          start_date: isoDate,
          start_date_local: isoDate,
          total_elevation_gain: elevationPerDay,
          distance: distancePerDay,
          moving_time: timePerDay,
          _isPartOfMultiDay: true,
          _originalActivityId: activity.activity_id,
          _dayNumber: i + 1,
          _totalDays: daysDiff
        });
      }
    }
  });
  
  return normalizedData;
}

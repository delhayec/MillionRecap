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
// CHARGEMENT DES DONNÉES
// ==============================
export async function loadData() {
  const possiblePaths = [
    '/data/activities_2025.json',
    '/public/data/activities_2025.json',
    'data/activities_2025.json',
    './data/activities_2025.json'
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        console.log(`Données chargées depuis: ${path}`, data);
        return data;
      }
    } catch (error) {
      continue;
    }
  }

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

  const totalElevation = filteredData.reduce((sum, activity) => sum + (activity.elevation_gain_m || 0), 0);
  const totalActivities = filteredData.length;
  const totalDistance = Math.round(filteredData.reduce((sum, activity) => sum + (activity.distance_m || 0), 0) / 1000);
  const totalTime = Math.round(filteredData.reduce((sum, activity) => sum + (activity.moving_time_s || 0), 0) / 3600);

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

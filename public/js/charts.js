import { getAthleteColor, getSportColor, mapSportName, generateAllDays, getOrdinalSuffix, decodePolyline, formatElevation, getAthleteName, getAthleteIdFromName } from './utils.js';

// ==============================
// CONFIGURATION CHART.JS — REFONTE 2025
// ==============================
const chartColors = {
  background: '#1a1a24',
  text: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textMuted: 'rgba(255, 255, 255, 0.3)',
  grid: 'rgba(255, 255, 255, 0.06)',
  accent: '#f97316',
  accentSecondary: '#22d3ee'
};

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    title: {
      display: true,
      color: chartColors.text,
      font: { 
        size: 16, 
        weight: '600', 
        family: "'Syne', sans-serif" 
      },
      padding: { bottom: 24 }
    },
    legend: {
      labels: {
        color: chartColors.textSecondary,
        font: { size: 12, family: "'Inter', sans-serif" },
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16
      }
    },
    tooltip: {
      enabled: false
    }
  },
  scales: {
    x: {
      grid: { color: chartColors.grid },
      ticks: { 
        color: chartColors.textSecondary, 
        font: { size: 10, family: "'Space Mono', monospace" } 
      }
    }
  }
};

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw: (chart) => {
    if (chart.tooltip?._active?.length) {
      const ctx = chart.ctx;
      const activePoint = chart.tooltip._active[0];
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
      ctx.stroke();
      ctx.restore();
    }
  }
};

// ==============================
// GRAPHIQUE TOUS LES ATHLÈTES
// ==============================
export function showAllAthletesChart(data, selectedSport) {
  const year = data.length > 0 ? new Date(data[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);
  const TARGET = 1000000;

  const filteredData = selectedSport
    ? data.filter(item => item.sport === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];
  const athleteDailyData = {};
  const dailySports = {};

  athletes.forEach(athlete => {
    athleteDailyData[athlete] = allDays.map((day, index) => {
      const dayActivities = filteredData.filter(item =>
        item.athlete_id === athlete && item.date.startsWith(day)
      );

      if (!dailySports[index]) dailySports[index] = {};
      const mappedSports = [...new Set(dayActivities.map(act => mapSportName(act.sport)))].join(', ');
      dailySports[index][athlete] = mappedSports || 'Aucun';

      return dayActivities.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0);
    });
  });

  const totalDailyElevation = allDays.map((day, index) => {
    return athletes.reduce((sum, athlete) => sum + athleteDailyData[athlete][index], 0);
  });

  let cumulative = 0;
  const cumulativeElevation = totalDailyElevation.map(value => {
    cumulative += value;
    return cumulative;
  });

  const targetLine = allDays.map((day, index) => {
    return (TARGET / 365) * (index + 1);
  });

  const barDatasets = athletes.map(athlete => ({
    type: 'bar',
    label: `${getAthleteName(athlete)}`,
    data: athleteDailyData[athlete],
    backgroundColor: getAthleteColor(athlete),
    borderRadius: 2,
    stack: 'stack0',
    yAxisID: 'y'
  }));

  const lineDataset = {
    type: 'line',
    label: 'Dénivelé cumulé total',
    data: cumulativeElevation,
    borderColor: chartColors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 3,
    fill: true,
    pointRadius: 0,
    tension: 0.4,
    yAxisID: 'y1'
  };

  const targetDataset = {
    type: 'line',
    label: 'Objectif 1 Million',
    data: targetLine,
    borderColor: chartColors.textMuted,
    borderWidth: 2,
    borderDash: [8, 4],
    fill: false,
    pointRadius: 0,
    yAxisID: 'y1'
  };

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  window.deniveleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDays,
      datasets: [...barDatasets, lineDataset, targetDataset]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: {
          ...baseChartOptions.plugins.title,
          text: `Progression ${year} — ${selectedSport || 'Tous sports'}`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          titleColor: chartColors.text,
          bodyColor: chartColors.textSecondary,
          borderColor: chartColors.grid,
          borderWidth: 1,
          padding: 16,
          cornerRadius: 12,
          displayColors: true,
          titleFont: { family: "'Syne', sans-serif", weight: '600', size: 14 },
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
          callbacks: {
            title: function(tooltipItems) {
              const date = tooltipItems[0].label;
              const dateObj = new Date(date);
              return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            },
            afterTitle: function(tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              const cumul = cumulativeElevation[index];
              const objectif = targetLine[index];
              const difference = cumul - objectif;
              const status = difference >= 0 ? '↑ Avance' : '↓ Retard';
              return `\nCumulé: ${formatElevation(cumul)} m\n${status}: ${formatElevation(Math.abs(difference))} m`;
            },
            label: function(context) {
              if (context.dataset.type === 'bar') {
                const athleteId = getAthleteIdFromName(context.dataset.label);
                const dayIndex = context.dataIndex;
                const sport = dailySports[dayIndex]?.[athleteId] || 'Aucun';
                return [
                  `${context.dataset.label}: ${formatElevation(context.parsed.y)} m`,
                  `Sport: ${sport}`
                ];
              }
              return null;
            }
          }
        }
      },
      scales: {
        x: {
          ...baseChartOptions.scales.x,
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          position: 'right',
          stacked: true,
          title: {
            display: true,
            text: 'Dénivelé journalier (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: { color: chartColors.grid },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: {
            color: chartColors.grid,
            drawOnChartArea: false
          },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

// ==============================
// GRAPHIQUE INDIVIDUEL
// ==============================
export function showIndividualChart(data, athleteId, selectedSport) {
  const year = data.length > 0 ? new Date(data[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  let filteredData = data.filter(item => item.athlete_id == athleteId);
  if (selectedSport) {
    filteredData = filteredData.filter(item => item.sport === selectedSport);
  }

  const dailyElevation = [];
  const dailySportColors = [];
  const dailySportNames = [];

  allDays.forEach(day => {
    const dayActivities = filteredData.filter(item => item.date.startsWith(day));
    const totalElevation = dayActivities.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0);
    dailyElevation.push(totalElevation);

    if (dayActivities.length > 0) {
      const sportElevation = {};
      dayActivities.forEach(act => {
        const mappedSport = mapSportName(act.sport);
        sportElevation[mappedSport] = (sportElevation[mappedSport] || 0) + (act.elevation_gain_m || 0);
      });
      const mainSport = Object.keys(sportElevation).reduce((a, b) =>
        sportElevation[a] > sportElevation[b] ? a : b
      );
      dailySportColors.push(getSportColor(mainSport));

      const mappedSports = [...new Set(dayActivities.map(act => mapSportName(act.sport)))].join(', ');
      dailySportNames.push(mappedSports);
    } else {
      dailySportColors.push(getAthleteColor(athleteId));
      dailySportNames.push('Aucun');
    }
  });

  let cumulative = 0;
  const cumulativeElevation = dailyElevation.map(value => {
    cumulative += value;
    return cumulative;
  });

  const totalElevation = cumulativeElevation[cumulativeElevation.length - 1] || 0;
  const targetLine = allDays.map((day, index) => {
    return (totalElevation / 365) * (index + 1);
  });

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  window.deniveleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDays,
      datasets: [
        {
          type: 'bar',
          label: 'Dénivelé journalier',
          data: dailyElevation,
          backgroundColor: dailySportColors,
          borderRadius: 2,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Dénivelé cumulé',
          data: cumulativeElevation,
          borderColor: chartColors.text,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: 3,
          fill: true,
          pointRadius: 0,
          tension: 0.4,
          yAxisID: 'y1'
        },
        {
          type: 'line',
          label: `Objectif ${formatElevation(totalElevation)} m`,
          data: targetLine,
          borderColor: chartColors.accent,
          borderWidth: 2,
          borderDash: [8, 4],
          fill: false,
          pointRadius: 0,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: {
          ...baseChartOptions.plugins.title,
          text: `${getAthleteName(athleteId)} — ${selectedSport || 'Tous sports'}`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          titleColor: chartColors.text,
          bodyColor: chartColors.textSecondary,
          borderColor: chartColors.grid,
          borderWidth: 1,
          padding: 16,
          cornerRadius: 12,
          displayColors: true,
          callbacks: {
            title: function(tooltipItems) {
              const date = tooltipItems[0].label;
              const dateObj = new Date(date);
              return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            },
            afterTitle: function(tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              const cumul = cumulativeElevation[index];
              const objectif = targetLine[index];
              const difference = cumul - objectif;
              const status = difference >= 0 ? '↑ Avance' : '↓ Retard';
              return `\nCumulé: ${formatElevation(cumul)} m\n${status}: ${formatElevation(Math.abs(difference))} m`;
            },
            label: function(context) {
              if (context.dataset.type === 'bar') {
                const dayIndex = context.dataIndex;
                const sport = dailySportNames[dayIndex];
                return [
                  `${context.dataset.label}: ${formatElevation(context.parsed.y)} m`,
                  `Sport: ${sport}`
                ];
              }
              return null;
            }
          }
        }
      },
      scales: {
        x: {
          ...baseChartOptions.scales.x,
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Dénivelé journalier (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: { color: chartColors.grid },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: {
            color: chartColors.grid,
            drawOnChartArea: false
          },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

// ==============================
// GRAPHIQUE DE CLASSEMENT
// ==============================
export function showRankingChart(data, selectedSport) {
  const year = data.length > 0 ? new Date(data[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  const filteredData = selectedSport
    ? data.filter(item => item.sport === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];
  const athleteDataMap = {};

  athletes.forEach(athlete => {
    const athleteData = filteredData.filter(item => item.athlete_id === athlete);
    const allDaysWithData = allDays.map(day => {
      const dayActivities = athleteData.filter(item => item.date.startsWith(day));
      return dayActivities.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0);
    });

    let cumulativeElevation = 0;
    const cumulativeElevations = allDaysWithData.map(value => {
      cumulativeElevation += value;
      return cumulativeElevation;
    });

    athleteDataMap[athlete] = cumulativeElevations;
  });

  const datasets = athletes.map(athlete => ({
    type: 'line',
    label: `${getAthleteName(athlete)}`,
    data: athleteDataMap[athlete],
    borderColor: getAthleteColor(athlete),
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidth: 3,
    fill: false,
    pointRadius: 0,
    tension: 0.4
  }));

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  const getRankingForDay = (dayIndex) => {
    const dayRanking = athletes.map(athlete => ({
      athleteId: athlete,
      elevation: athleteDataMap[athlete][dayIndex]
    }));

    dayRanking.sort((a, b) => b.elevation - a.elevation);

    const rankingMap = {};
    dayRanking.forEach((entry, index) => {
      rankingMap[entry.athleteId] = index + 1;
    });

    return rankingMap;
  };

  window.deniveleChart = new Chart(ctx, {
    type: 'line',
    data: { labels: allDays, datasets },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: {
          ...baseChartOptions.plugins.title,
          text: `Classement ${year} — ${selectedSport || 'Tous sports'}`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          titleColor: chartColors.text,
          bodyColor: chartColors.textSecondary,
          borderColor: chartColors.grid,
          borderWidth: 1,
          padding: 16,
          cornerRadius: 12,
          displayColors: true,
          callbacks: {
            title: function(tooltipItems) {
              const date = tooltipItems[0].label;
              const dateObj = new Date(date);
              return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            },
            label: function(context) {
              const dataset = context.dataset;
              const dayIndex = context.dataIndex;
              const athleteId = getAthleteIdFromName(dataset.label);
              const ranking = getRankingForDay(dayIndex)[athleteId];

              return [
                `${dataset.label}: ${formatElevation(context.parsed.y)} m`,
                `Classement: ${ranking}${getOrdinalSuffix(ranking)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          ...baseChartOptions.scales.x,
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: { color: chartColors.grid },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

// ==============================
// CARTE
// ==============================
let map;
let polylines = [];

export function initMap() {
  if (map) {
    // Si la carte existe déjà, forcer le recalcul de taille
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return;
  }

  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  map = L.map('map', {
    center: [46.2276, 2.2137],
    zoom: 6
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // Forcer le recalcul de la taille après initialisation
  setTimeout(() => {
    map.invalidateSize();
  }, 200);
}

function generateLegend(activities, colorMode = 'athlete') {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) return;

  legendContainer.innerHTML = '<h3>Légende</h3>';

  if (colorMode === 'sport') {
    const sports = [...new Set(activities.map(activity => mapSportName(activity.sport)))];

    sports.forEach(sport => {
      const color = getSportColor(sport);
      const count = activities.filter(a => mapSportName(a.sport) === sport).length;

      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.title = `${count} activité${count > 1 ? 's' : ''}`;

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = color;

      const text = document.createElement('div');
      text.className = 'legend-text';
      text.textContent = `${sport} (${count})`;

      legendItem.appendChild(colorBox);
      legendItem.appendChild(text);
      legendContainer.appendChild(legendItem);
    });
  } else {
    const uniqueAthletes = [...new Set(activities.map(activity => activity.athlete_id))];

    uniqueAthletes.forEach(athleteId => {
      const color = getAthleteColor(athleteId);
      const count = activities.filter(a => a.athlete_id === athleteId).length;

      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.title = `${count} activité${count > 1 ? 's' : ''}`;

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = color;

      const text = document.createElement('div');
      text.className = 'legend-text';
      text.textContent = `${getAthleteName(athleteId)} (${count})`;

      legendItem.appendChild(colorBox);
      legendItem.appendChild(text);
      legendContainer.appendChild(legendItem);
    });
  }
}

function calculateCountryStats(activities) {
  const countryStats = {};

  activities.forEach(activity => {
    const country = activity.country;
    if (!country) return;

    if (!countryStats[country]) {
      countryStats[country] = {
        name: country,
        count: 0,
        elevation: 0,
        distance: 0,
        athletes: new Set()
      };
    }

    countryStats[country].count++;
    countryStats[country].elevation += activity.elevation_gain_m || 0;
    countryStats[country].distance += activity.distance_m || 0;
    countryStats[country].athletes.add(activity.athlete_id);
  });

  return Object.values(countryStats).sort((a, b) => b.elevation - a.elevation);
}

function generateCountryStats(activities) {
  const container = document.getElementById('countryStatsContainer');
  if (!container) return;

  const stats = calculateCountryStats(activities);
  
  container.innerHTML = '<h3>Pays</h3>';

  stats.forEach((country, index) => {
    const item = document.createElement('div');
    item.className = 'country-item';
    
    item.innerHTML = `
      <div class="country-name">
        <span class="country-badge">${index + 1}</span>
        ${country.name}
      </div>
      <div class="country-stats-line">↑ ${formatElevation(country.elevation)} m</div>
      <div class="country-stats-line">→ ${(country.distance / 1000).toFixed(0)} km</div>
      <div class="country-stats-line">◉ ${country.count} activités</div>
    `;
    
    container.appendChild(item);
  });

  const summary = document.createElement('div');
  summary.className = 'country-summary';
  summary.textContent = `${stats.length} pays visités`;
  container.appendChild(summary);
}

export function showMapChart(data, athleteId) {
  if (!map) initMap();

  // Forcer le recalcul de taille
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);

  polylines.forEach(p => map.removeLayer(p));
  polylines = [];

  const colorMode = athleteId ? 'sport' : 'athlete';
  generateLegend(data, colorMode);
  generateCountryStats(data);

  data.forEach(activity => {
    if (!activity.tracemap || !activity.tracemap.summary_polyline) return;

    const points = decodePolyline(activity.tracemap.summary_polyline);
    if (points.length === 0) return;

    const color = athleteId 
      ? getSportColor(mapSportName(activity.sport))
      : getAthleteColor(activity.athlete_id);

    const polyline = L.polyline(points, {
      color: color,
      weight: 2.5,
      opacity: 0.8
    }).addTo(map);

    const date = new Date(activity.date).toLocaleDateString('fr-FR');
    const popup = `
      <strong>${activity.name}</strong><br>
      ${date}<br>
      ${mapSportName(activity.sport)}<br>
      ↑ ${activity.elevation_gain_m} m
    `;
    polyline.bindPopup(popup);
    polylines.push(polyline);
  });

  if (polylines.length > 0) {
    const group = L.featureGroup(polylines);
    map.fitBounds(group.getBounds(), { padding: [30, 30] });
    
    // Recalculer après fitBounds
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }
}

// ==============================
// TABLEAU DE CLASSEMENT
// ==============================
export function showRankingTable(data) {
  const tbody = document.getElementById('rankingTableBody');
  if (!tbody) return;

  const athleteStats = {};

  data.forEach(activity => {
    const id = activity.athlete_id;
    if (!athleteStats[id]) {
      athleteStats[id] = {
        athlete_id: id,
        total_elevation: 0,
        activity_count: 0,
        total_distance: 0,
        total_time: 0,
        active_days: new Set(),
        best_activity: null,
        elevation_by_sport: {},
        activities_without_elevation: 0
      };
    }

    athleteStats[id].total_elevation += activity.elevation_gain_m || 0;
    athleteStats[id].activity_count++;
    athleteStats[id].total_distance += activity.distance_m || 0;
    athleteStats[id].total_time += activity.moving_time_s || 0;
    
    // Jours actifs
    const day = activity.date.split('T')[0];
    athleteStats[id].active_days.add(day);
    
    // Meilleure activité
    if (!athleteStats[id].best_activity || (activity.elevation_gain_m || 0) > athleteStats[id].best_activity.elevation) {
      athleteStats[id].best_activity = {
        id: activity.id,
        elevation: activity.elevation_gain_m || 0,
        date: activity.date,
        name: activity.name
      };
    }
    
    // Elevation par sport
    const sport = mapSportName(activity.sport);
    athleteStats[id].elevation_by_sport[sport] = (athleteStats[id].elevation_by_sport[sport] || 0) + (activity.elevation_gain_m || 0);
    
    // Activités sans dénivelé
    if (!activity.elevation_gain_m || activity.elevation_gain_m === 0) {
      athleteStats[id].activities_without_elevation++;
    }
  });

  const stats = Object.values(athleteStats).map(s => ({
    ...s,
    active_days_count: s.active_days.size,
    elevation_per_distance: s.total_distance > 0 ? (s.total_elevation / (s.total_distance / 1000)).toFixed(1) : 0,
    elevation_per_time: s.total_time > 0 ? (s.total_elevation / (s.total_time / 3600)).toFixed(1) : 0,
    elevation_per_activity: s.activity_count > 0 ? (s.total_elevation / s.activity_count).toFixed(0) : 0
  }));

  stats.sort((a, b) => b.total_elevation - a.total_elevation);

  tbody.innerHTML = '';

  stats.forEach(s => {
    const row = document.createElement('tr');
    const recordDate = s.best_activity ? new Date(s.best_activity.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-';
    const stravaLink = s.best_activity ? `https://www.strava.com/activities/${s.best_activity.id}` : '#';
    
    row.innerHTML = `
      <td style="color: ${getAthleteColor(s.athlete_id)}">${getAthleteName(s.athlete_id)}</td>
      <td>${s.total_elevation.toLocaleString('fr-FR')}</td>
      <td>${s.activity_count}</td>
      <td>${(s.total_distance / 1000).toFixed(0)}</td>
      <td>${Math.round(s.total_time / 3600)}</td>
      <td>${s.elevation_per_distance}</td>
      <td>${s.elevation_per_time}</td>
      <td>${s.elevation_per_activity}</td>
      <td>
        ${s.best_activity ? `
          <a href="${stravaLink}" target="_blank" class="record-link" title="${s.best_activity.name}">
            <span class="record-elevation">↑ ${formatElevation(s.best_activity.elevation)} m</span>
            <span class="record-date">${recordDate}</span>
            <span class="record-strava">Voir sur Strava →</span>
          </a>
        ` : '-'}
      </td>
    `;
    tbody.appendChild(row);
  });

  // Générer les achievements
  generateAchievements(stats);

  // Tri des colonnes
  document.querySelectorAll('#rankingTable th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      
      const isAsc = th.classList.contains('sorted-asc');
      
      document.querySelectorAll('#rankingTable th').forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      
      stats.sort((a, b) => isAsc ? a[key] - b[key] : b[key] - a[key]);
      th.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
      
      tbody.innerHTML = '';
      stats.forEach(s => {
        const row = document.createElement('tr');
        const recordDate = s.best_activity ? new Date(s.best_activity.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-';
        const stravaLink = s.best_activity ? `https://www.strava.com/activities/${s.best_activity.id}` : '#';
        
        row.innerHTML = `
          <td style="color: ${getAthleteColor(s.athlete_id)}">${getAthleteName(s.athlete_id)}</td>
          <td>${s.total_elevation.toLocaleString('fr-FR')}</td>
          <td>${s.activity_count}</td>
          <td>${(s.total_distance / 1000).toFixed(0)}</td>
          <td>${Math.round(s.total_time / 3600)}</td>
          <td>${s.elevation_per_distance}</td>
          <td>${s.elevation_per_time}</td>
          <td>${s.elevation_per_activity}</td>
          <td>
            ${s.best_activity ? `
              <a href="${stravaLink}" target="_blank" class="record-link" title="${s.best_activity.name}">
                <span class="record-elevation">↑ ${formatElevation(s.best_activity.elevation)} m</span>
                <span class="record-date">${recordDate}</span>
                <span class="record-strava">Voir sur Strava →</span>
              </a>
            ` : '-'}
          </td>
        `;
        tbody.appendChild(row);
      });
    });
  });
}

function generateAchievements(stats) {
  const grid = document.getElementById('achievementsGrid');
  if (!grid) return;

  const achievements = [
    {
      id: 'king',
      emoji: '👑',
      name: 'Roi de la Montagne',
      desc: 'Le plus de dénivelé total',
      type: 'legendary',
      getValue: s => s.total_elevation,
      format: v => `${formatElevation(v)} m`
    },
    {
      id: 'regular',
      emoji: '📅',
      name: 'Régulier',
      desc: 'Le plus de jours actifs',
      type: 'normal',
      getValue: s => s.active_days_count,
      format: v => `${v} jours`
    },
    {
      id: 'efficient',
      emoji: '⚡',
      name: 'Efficace',
      desc: 'Le plus de D+ par sortie',
      type: 'normal',
      getValue: s => parseFloat(s.elevation_per_activity),
      format: v => `${formatElevation(v)} m/sortie`
    },
    {
      id: 'steep',
      emoji: '🧗',
      name: 'Accro à la Pente',
      desc: 'Le plus de D+ par km',
      type: 'normal',
      getValue: s => parseFloat(s.elevation_per_distance),
      format: v => `${v} m/km`
    },
    {
      id: 'cyclist',
      emoji: '🚴',
      name: 'Roi de la Pédale',
      desc: 'Le plus de D+ en vélo',
      type: 'normal',
      getValue: s => s.elevation_by_sport['Bike'] || 0,
      format: v => `${formatElevation(v)} m`
    },
    {
      id: 'runner',
      emoji: '🏃',
      name: 'Crapahute',
      desc: 'Le plus de D+ en trail/run',
      type: 'normal',
      getValue: s => (s.elevation_by_sport['Run'] || 0) + (s.elevation_by_sport['Trail'] || 0),
      format: v => `${formatElevation(v)} m`
    },
    {
      id: 'skier',
      emoji: '⛷️',
      name: 'Collant Pipette',
      desc: 'Le plus de D+ en ski',
      type: 'normal',
      getValue: s => (s.elevation_by_sport['Ski mountaineering'] || 0) + (s.elevation_by_sport['Ski'] || 0),
      format: v => `${formatElevation(v)} m`
    },
    {
      id: 'hiker',
      emoji: '🥾',
      name: 'Randonneur',
      desc: 'Le plus de D+ en rando',
      type: 'normal',
      getValue: s => s.elevation_by_sport['Hike'] || 0,
      format: v => `${formatElevation(v)} m`
    },
    {
      id: 'flat',
      emoji: '🤷',
      name: 'A pas compris',
      desc: 'Le plus d\'activités sans D+',
      type: 'fun',
      getValue: s => s.activities_without_elevation,
      format: v => `${v} activités`
    },
    {
      id: 'speedster',
      emoji: '🚀',
      name: 'Turbo',
      desc: 'Le plus de D+ par heure',
      type: 'normal',
      getValue: s => parseFloat(s.elevation_per_time),
      format: v => `${formatElevation(v)} m/h`
    },
    {
      id: 'marathon',
      emoji: '🏅',
      name: 'Marathonien',
      desc: 'Le plus d\'activités',
      type: 'normal',
      getValue: s => s.activity_count,
      format: v => `${v} activités`
    },
    {
      id: 'endurance',
      emoji: '⏱️',
      name: 'Endurant',
      desc: 'Le plus de temps d\'effort',
      type: 'normal',
      getValue: s => s.total_time,
      format: v => `${Math.round(v / 3600)}h`
    }
  ];

  grid.innerHTML = achievements.map(achievement => {
    // Trouver le gagnant
    const validStats = stats.filter(s => achievement.getValue(s) > 0);
    if (validStats.length === 0) return '';
    
    const winner = validStats.reduce((best, s) => 
      achievement.getValue(s) > achievement.getValue(best) ? s : best
    );
    
    const value = achievement.getValue(winner);
    
    return `
      <div class="achievement-card">
        <div class="achievement-badge ${achievement.type}">${achievement.emoji}</div>
        <div class="achievement-info">
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">${achievement.desc}</div>
          <div class="achievement-winner">
            <div class="achievement-winner-color" style="background: ${getAthleteColor(winner.athlete_id)}"></div>
            <span class="achievement-winner-name">${getAthleteName(winner.athlete_id)}</span>
            <span class="achievement-winner-value">${achievement.format(value)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==============================
// DIAGRAMME SANKEY
// ==============================
export function showSankeyDiagram(data) {
  const chartDom = document.getElementById('sankeyChart');
  if (!chartDom) return;

  if (window.sankeyChart && typeof window.sankeyChart.dispose === 'function') {
    window.sankeyChart.dispose();
  }

  window.sankeyChart = echarts.init(chartDom);

  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  const athletes = [...new Set(data.map(d => d.athlete_id))];
  const sports = [...new Set(data.map(d => mapSportName(d.sport)))];

  // Calculer le total global
  const totalGlobal = data.reduce((sum, d) => sum + (d.elevation_gain_m || 0), 0);

  // Calculer les totaux par athlète
  const athleteTotals = {};
  athletes.forEach(a => {
    athleteTotals[a] = data.filter(d => d.athlete_id === a)
      .reduce((sum, d) => sum + (d.elevation_gain_m || 0), 0);
  });

  // Calculer les totaux par sport
  const sportTotals = {};
  sports.forEach(s => {
    sportTotals[s] = data.filter(d => mapSportName(d.sport) === s)
      .reduce((sum, d) => sum + (d.elevation_gain_m || 0), 0);
  });

  athletes.forEach(a => {
    const name = `${getAthleteName(a)}`;
    if (!nodeSet.has(name)) {
      nodes.push({ 
        name, 
        itemStyle: { color: getAthleteColor(a) },
        total: athleteTotals[a],
        percentage: ((athleteTotals[a] / totalGlobal) * 100).toFixed(1)
      });
      nodeSet.add(name);
    }
  });

  sports.forEach(s => {
    if (!nodeSet.has(s)) {
      nodes.push({ 
        name: s, 
        itemStyle: { color: getSportColor(s) },
        total: sportTotals[s],
        percentage: ((sportTotals[s] / totalGlobal) * 100).toFixed(1)
      });
      nodeSet.add(s);
    }
  });

  const linkMap = {};
  data.forEach(activity => {
    const source = `${getAthleteName(activity.athlete_id)}`;
    const target = mapSportName(activity.sport);
    const key = `${source}->${target}`;

    if (!linkMap[key]) {
      linkMap[key] = { source, target, value: 0 };
    }
    linkMap[key].value += activity.elevation_gain_m || 0;
  });

  Object.values(linkMap).forEach(link => links.push(link));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      formatter: params => {
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}<br/>↑ ${formatElevation(params.data.value)} m`;
        }
        // Node tooltip
        const node = nodes.find(n => n.name === params.name);
        if (node) {
          return `<strong>${params.name}</strong><br/>↑ ${formatElevation(node.total)} m<br/>${node.percentage}% du total`;
        }
        return params.name;
      }
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      nodeAlign: 'left',
      data: nodes,
      links: links,
      label: {
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
        fontSize: 12
      },
      lineStyle: {
        color: 'gradient',
        curveness: 0.5,
        opacity: 0.4
      },
      itemStyle: {
        borderWidth: 0
      }
    }]
  };

  window.sankeyChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.sankeyChart) window.sankeyChart.resize();
  });
}

// ==============================
// HEATMAP CALENDRIER
// ==============================
export function showCalendarHeatmap(data, athleteId, selectedSport) {
  const chartDom = document.getElementById('calendarHeatmap');
  if (!chartDom) return;

  if (window.calendarChart && typeof window.calendarChart.dispose === 'function') {
    window.calendarChart.dispose();
  }

  window.calendarChart = echarts.init(chartDom);

  let filteredData = data;
  if (athleteId && athleteId !== "classement") {
    filteredData = filteredData.filter(d => d.athlete_id == athleteId);
  }
  if (selectedSport) {
    filteredData = filteredData.filter(d => d.sport === selectedSport);
  }

  const year = filteredData.length > 0 ? new Date(filteredData[0].date).getFullYear() : 2025;

  const dailyElevation = {};
  filteredData.forEach(activity => {
    const date = activity.date.split('T')[0];
    dailyElevation[date] = (dailyElevation[date] || 0) + (activity.elevation_gain_m || 0);
  });

  const calendarData = Object.entries(dailyElevation).map(([date, value]) => [date, value]);

  const maxValue = Math.max(...calendarData.map(d => d[1]), 1);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      formatter: params => {
        const date = new Date(params.data[0]).toLocaleDateString('fr-FR', { 
          weekday: 'long', day: 'numeric', month: 'long' 
        });
        return `${date}<br/>↑ ${formatElevation(params.data[1])} m`;
      }
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxValue,
      inRange: {
        color: ['#1a1a24', '#f97316']
      }
    },
    calendar: {
      top: 20,
      left: 50,
      right: 20,
      bottom: 10,
      cellSize: ['auto', 15],
      range: year,
      itemStyle: {
        borderWidth: 2,
        borderColor: '#0a0a0f'
      },
      yearLabel: { show: false },
      monthLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontFamily: "'Space Mono', monospace",
        fontSize: 10
      },
      dayLabel: {
        firstDay: 1,
        color: 'rgba(255, 255, 255, 0.3)',
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        nameMap: ['D', 'L', 'M', 'M', 'J', 'V', 'S']
      },
      splitLine: { show: false }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calendarData
    }]
  };

  window.calendarChart.setOption(option);

  // Générer les barres de performance avec animation au scroll
  setupPerformanceBarsAnimation(filteredData, year);

  window.addEventListener('resize', () => {
    if (window.calendarChart) window.calendarChart.resize();
  });
}

function setupPerformanceBarsAnimation(data, year) {
  const performanceBars = document.querySelector('.performance-bars');
  if (!performanceBars) return;

  // Stocker les données pour l'animation
  window.perfBarsData = { data, year };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Déclencher l'animation des barres
        setTimeout(() => {
          generateWeeklyBars(data, year, true);
          generateMonthlyBars(data, year, true);
        }, 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(performanceBars);
  
  // Générer les barres sans animation d'abord (hauteur 0)
  generateWeeklyBars(data, year, false);
  generateMonthlyBars(data, year, false);
}

function generateWeeklyBars(data, year, animate = true) {
  const container = document.getElementById('weeklyBars');
  if (!container) return;

  const TARGET = 1000000;
  const weeklyTarget = TARGET / 52; // ~19 231 m par semaine

  // Calculer le dénivelé par semaine
  const weeklyData = {};
  data.forEach(activity => {
    const date = new Date(activity.date);
    if (date.getFullYear() !== year) return;
    
    const weekNum = getWeekNumber(date);
    const weekKey = `S${weekNum}`;
    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + (activity.elevation_gain_m || 0);
  });

  // Créer toutes les semaines de l'année
  const allWeeks = [];
  for (let i = 1; i <= 52; i++) {
    allWeeks.push({ week: `S${i}`, value: weeklyData[`S${i}`] || 0 });
  }

  const maxValue = Math.max(...allWeeks.map(w => w.value), weeklyTarget * 1.2);
  const objectiveHeight = (weeklyTarget / maxValue) * 100;

  // Générer les barres
  let barsHTML = allWeeks.map((w, index) => {
    const height = (w.value / maxValue) * 100;
    const displayLabel = w.week.replace('S', '');
    const showLabel = parseInt(displayLabel) % 4 === 1;
    const diff = w.value - weeklyTarget;
    const diffSign = diff >= 0 ? '+' : '';
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const initialHeight = animate ? Math.max(height, 2) : 0;
    const delay = animate ? index * 15 : 0;
    
    return `
      <div class="perf-bar" style="height: ${initialHeight}%; transition: height 0.5s ease-out ${delay}ms;">
        <div class="perf-bar-tooltip">
          <strong>${w.week}</strong><br>
          ↑ ${formatElevation(w.value)} m<br>
          <span class="diff-${diffClass}">${diffSign}${formatElevation(diff)} m</span>
        </div>
        ${showLabel ? `<span class="perf-bar-label">${displayLabel}</span>` : ''}
      </div>
    `;
  }).join('');

  // Ajouter la ligne d'objectif
  const objectiveLine = `
    <div class="objective-line" style="bottom: ${objectiveHeight}%">
      <span class="objective-label">Obj. ${formatElevation(weeklyTarget)} m/sem</span>
    </div>
  `;

  container.innerHTML = barsHTML + objectiveLine;
}

function generateMonthlyBars(data, year, animate = true) {
  const container = document.getElementById('monthlyBars');
  if (!container) return;

  const TARGET = 1000000;
  const monthlyTarget = TARGET / 12; // ~83 333 m par mois
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  
  // Calculer le dénivelé par mois
  const monthlyData = new Array(12).fill(0);
  data.forEach(activity => {
    const date = new Date(activity.date);
    if (date.getFullYear() !== year) return;
    monthlyData[date.getMonth()] += (activity.elevation_gain_m || 0);
  });

  const maxValue = Math.max(...monthlyData, monthlyTarget * 1.2);
  const objectiveHeight = (monthlyTarget / maxValue) * 100;

  // Générer les barres
  let barsHTML = monthlyData.map((value, index) => {
    const height = (value / maxValue) * 100;
    const diff = value - monthlyTarget;
    const diffSign = diff >= 0 ? '+' : '';
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const initialHeight = animate ? Math.max(height, 2) : 0;
    const delay = animate ? index * 50 : 0;
    
    return `
      <div class="perf-bar" style="height: ${initialHeight}%; transition: height 0.6s ease-out ${delay}ms;">
        <div class="perf-bar-tooltip">
          <strong>${monthNames[index]}</strong><br>
          ↑ ${formatElevation(value)} m<br>
          <span class="diff-${diffClass}">${diffSign}${formatElevation(diff)} m</span>
        </div>
        <span class="perf-bar-label">${monthNames[index]}</span>
      </div>
    `;
  }).join('');

  // Ajouter la ligne d'objectif
  const objectiveLine = `
    <div class="objective-line" style="bottom: ${objectiveHeight}%">
      <span class="objective-label">Obj. ${formatElevation(monthlyTarget)} m/mois</span>
    </div>
  `;

  container.innerHTML = barsHTML + objectiveLine;
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ==============================
// RIDGELINE CHART
// ==============================
function calculateHourlyDistribution(data, groupBy = 'sport') {
  const distributions = {};

  data.forEach(activity => {
    const date = new Date(activity.date);
    const hour = date.getHours() + date.getMinutes() / 60;
    const duration = (activity.moving_time_s || 0) / 3600;

    let key;
    if (groupBy === 'athlete') {
      key = `${getAthleteName(activity.athlete_id)}`;
    } else {
      key = mapSportName(activity.sport);
    }

    if (!distributions[key]) {
      distributions[key] = [];
    }

    for (let i = 0; i < duration; i += 0.25) {
      const currentHour = (hour + i) % 24;
      distributions[key].push(currentHour);
    }
  });

  return distributions;
}

export function showRidgelineBySport(data, athleteId, selectedSport = null) {
  const chartDom = document.getElementById('ridgelineChart');
  if (!chartDom) return;

  if (window.ridgelineChart && typeof window.ridgelineChart.dispose === 'function') {
    window.ridgelineChart.dispose();
  }

  window.ridgelineChart = echarts.init(chartDom);

  let filteredData = data;
  if (athleteId) {
    filteredData = filteredData.filter(activity => activity.athlete_id == athleteId);
  }
  if (selectedSport) {
    filteredData = filteredData.filter(activity => activity.sport === selectedSport);
  }

  const distributions = calculateHourlyDistribution(filteredData, 'sport');
  const sports = Object.keys(distributions);

  if (sports.length === 0) return;

  const sportVolumes = {};
  sports.forEach(sport => {
    sportVolumes[sport] = distributions[sport].length * 0.25;
  });

  const sortedSports = sports.sort((a, b) => sportVolumes[a] - sportVolumes[b]);

  const series = [];
  const xAxisData = [];
  for (let h = 0; h < 24; h += 0.25) {
    xAxisData.push(h);
  }

  const rawDataBySport = {};
  const allHoursData = {};
  let maxHours = 0;

  sortedSports.forEach((sport) => {
    const hoursData = xAxisData.map((hour) => {
      const hourStart = hour;
      const hourEnd = hour + 0.25;
      const activitiesInSlot = distributions[sport].filter(h => h >= hourStart && h < hourEnd);
      return activitiesInSlot.length * 0.25;
    });

    allHoursData[sport] = hoursData;
    rawDataBySport[sport] = hoursData;

    const sportMax = Math.max(...hoursData);
    if (sportMax > maxHours) maxHours = sportMax;
  });

  const GAP_FACTOR = 0.15;

  sortedSports.forEach((sport, index) => {
    const hoursData = allHoursData[sport];
    const normalizedData = hoursData.map(h => h + (index * (maxHours * GAP_FACTOR)));

    series.push({
      name: sport,
      type: 'line',
      data: normalizedData,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: 2,
        color: getSportColor(sport)
      },
      areaStyle: {
        origin: index * (maxHours * GAP_FACTOR),
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: getSportColor(sport) + 'CC' },
            { offset: 1, color: getSportColor(sport) + '20' }
          ]
        }
      },
      emphasis: { focus: 'series' },
      itemStyle: { color: getSportColor(sport) }
    });
  });

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: athleteId ? `Rythmes — ${getAthleteName(athleteId)}` : 'Rythmes par sport',
      textStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: "'Syne', sans-serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(249, 115, 22, 0.5)', width: 1 }
      },
      formatter: function(params) {
        const hour = params[0].axisValue;
        const hourInt = Math.floor(hour);
        const minutes = Math.round((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        let result = `<strong>${timeStr}</strong><br/>`;
        const dataIndex = params[0].dataIndex;

        params.forEach(param => {
          const sportName = param.seriesName;
          const hours = rawDataBySport[sportName][dataIndex];
          if (hours > 0) {
            const minutesInt = Math.round(hours * 60);
            result += `${param.marker}${sportName}: ${minutesInt}min<br/>`;
          }
        });

        return result;
      }
    },
    legend: {
      data: sortedSports,
      textStyle: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, fontFamily: "'Inter', sans-serif" },
      top: 40,
      left: 'center'
    },
    grid: {
      left: '3%',
      right: '4%',
      top: 90,
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      boundaryGap: false,
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        formatter: value => Math.floor(value) % 2 === 0 && value % 1 === 0 ? Math.floor(value) + 'h' : ''
      },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.04)' } }
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: series
  };

  window.ridgelineChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.ridgelineChart) window.ridgelineChart.resize();
  });
}

export function showRidgelineByAthlete(data, selectedSport = null) {
  const chartDom = document.getElementById('ridgelineChart');
  if (!chartDom) return;

  if (window.ridgelineChart && typeof window.ridgelineChart.dispose === 'function') {
    window.ridgelineChart.dispose();
  }

  window.ridgelineChart = echarts.init(chartDom);

  let filteredData = data;
  if (selectedSport) {
    filteredData = filteredData.filter(activity => activity.sport === selectedSport);
  }

  const distributions = calculateHourlyDistribution(filteredData, 'athlete');
  const athletes = Object.keys(distributions);

  if (athletes.length === 0) return;

  const athleteVolumes = {};
  athletes.forEach(athlete => {
    athleteVolumes[athlete] = distributions[athlete].length * 0.25;
  });

  const sortedAthletes = athletes.sort((a, b) => athleteVolumes[a] - athleteVolumes[b]);

  const series = [];
  const xAxisData = [];
  for (let h = 0; h < 24; h += 0.25) {
    xAxisData.push(h);
  }

  const rawDataByAthlete = {};
  const allHoursData = {};
  let maxHours = 0;

  sortedAthletes.forEach((athlete) => {
    const hoursData = xAxisData.map((hour) => {
      const hourStart = hour;
      const hourEnd = hour + 0.25;
      const activitiesInSlot = distributions[athlete].filter(h => h >= hourStart && h < hourEnd);
      return activitiesInSlot.length * 0.25;
    });

    allHoursData[athlete] = hoursData;
    rawDataByAthlete[athlete] = hoursData;

    const athleteMax = Math.max(...hoursData);
    if (athleteMax > maxHours) maxHours = athleteMax;
  });

  const GAP_FACTOR = 0.15;

  sortedAthletes.forEach((athlete, index) => {
    const athleteId = getAthleteIdFromName(athlete);
    const hoursData = allHoursData[athlete];
    const normalizedData = hoursData.map(h => h + (index * (maxHours * GAP_FACTOR)));

    series.push({
      name: athlete,
      type: 'line',
      data: normalizedData,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: 2,
        color: getAthleteColor(athleteId)
      },
      areaStyle: {
        origin: index * (maxHours * GAP_FACTOR),
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: getAthleteColor(athleteId) + 'CC' },
            { offset: 1, color: getAthleteColor(athleteId) + '20' }
          ]
        }
      },
      emphasis: { focus: 'series' },
      itemStyle: { color: getAthleteColor(athleteId) }
    });
  });

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: `Rythmes par athlète${selectedSport ? ' — ' + selectedSport : ''}`,
      textStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: "'Syne', sans-serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(249, 115, 22, 0.5)', width: 1 }
      },
      formatter: function(params) {
        const hour = params[0].axisValue;
        const hourInt = Math.floor(hour);
        const minutes = Math.round((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        let result = `<strong>${timeStr}</strong><br/>`;
        const dataIndex = params[0].dataIndex;

        params.forEach(param => {
          const athleteName = param.seriesName;
          const hours = rawDataByAthlete[athleteName][dataIndex];
          if (hours > 0) {
            const minutesInt = Math.round(hours * 60);
            result += `${param.marker}${athleteName}: ${minutesInt}min<br/>`;
          }
        });

        return result;
      }
    },
    legend: {
      data: sortedAthletes,
      textStyle: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, fontFamily: "'Inter', sans-serif" },
      top: 40,
      left: 'center',
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '4%',
      top: sortedAthletes.length > 5 ? 100 : 90,
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      boundaryGap: false,
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        formatter: value => Math.floor(value) % 2 === 0 && value % 1 === 0 ? Math.floor(value) + 'h' : ''
      },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.04)' } }
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: series
  };

  window.ridgelineChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.ridgelineChart) window.ridgelineChart.resize();
  });
}

// ==============================
// PIE CHART SPORTS
// ==============================
export function showSportPieChart(data) {
  const chartDom = document.getElementById('sportPieChart');
  if (!chartDom) return;

  if (window.sportPieChart && typeof window.sportPieChart.dispose === 'function') {
    window.sportPieChart.dispose();
  }

  window.sportPieChart = echarts.init(chartDom);

  const sportData = {};
  data.forEach(activity => {
    const sport = mapSportName(activity.sport);
    sportData[sport] = (sportData[sport] || 0) + (activity.elevation_gain_m || 0);
  });

  const pieData = Object.entries(sportData)
    .map(([name, value]) => ({
      name,
      value,
      itemStyle: { color: getSportColor(name) }
    }))
    .sort((a, b) => b.value - a.value);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: 12 },
      formatter: params => `${params.name}<br/>↑ ${formatElevation(params.value)} m (${params.percent.toFixed(1)}%)`
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#1a1a24',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontFamily: "'Inter', sans-serif"
      },
      labelLine: {
        show: true,
        length: 10,
        length2: 10,
        lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(249, 115, 22, 0.5)'
        },
        label: { fontWeight: 'bold' }
      },
      data: pieData,
      animationType: 'expansion',
      animationDuration: 1500,
      animationEasing: 'cubicOut'
    }]
  };

  window.sportPieChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.sportPieChart) window.sportPieChart.resize();
  });
}

// ==============================
// MINI RANKING SLIDER
// ==============================
export function showMiniRanking(data) {
  const slider = document.getElementById('miniRankingSlider');
  const dotsContainer = document.getElementById('rankingDots');
  const prevBtn = document.getElementById('rankingPrev');
  const nextBtn = document.getElementById('rankingNext');
  
  if (!slider) return;

  // Calculer les stats par athlète
  const athleteStats = {};
  data.forEach(activity => {
    const id = activity.athlete_id;
    if (!athleteStats[id]) {
      athleteStats[id] = { athlete_id: id, total_elevation: 0 };
    }
    athleteStats[id].total_elevation += activity.elevation_gain_m || 0;
  });

  const stats = Object.values(athleteStats).sort((a, b) => b.total_elevation - a.total_elevation);
  const maxElevation = stats[0]?.total_elevation || 1;

  // Générer les items
  slider.innerHTML = stats.map((s, index) => {
    const percentage = (s.total_elevation / maxElevation) * 100;
    const positionClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    
    return `
      <div class="mini-rank-item">
        <div class="mini-rank-position ${positionClass}">${index + 1}</div>
        <div class="mini-rank-info">
          <div class="mini-rank-name" style="color: ${getAthleteColor(s.athlete_id)}">${getAthleteName(s.athlete_id)}</div>
          <div class="mini-rank-value">${formatElevation(s.total_elevation)} m</div>
        </div>
        <div class="mini-rank-bar">
          <div class="mini-rank-bar-fill" style="width: ${percentage}%; background: ${getAthleteColor(s.athlete_id)}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Pagination par groupe de 4
  const itemsPerPage = 4;
  const totalPages = Math.ceil(stats.length / itemsPerPage);
  let currentPage = 0;

  // Générer les dots
  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from({ length: totalPages }, (_, i) => 
      `<div class="ranking-dot ${i === 0 ? 'active' : ''}" data-page="${i}"></div>`
    ).join('');

    dotsContainer.querySelectorAll('.ranking-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        currentPage = parseInt(dot.dataset.page);
        updateSlider();
      });
    });
  }

  function updateSlider() {
    const itemWidth = 188; // min-width + gap
    slider.scrollTo({ left: currentPage * itemsPerPage * itemWidth, behavior: 'smooth' });
    
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.ranking-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentPage);
      });
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentPage = Math.max(0, currentPage - 1);
      updateSlider();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
      updateSlider();
    });
  }
}

// ==============================
// SOCIAL GRAPH - SORTIES EN GROUPE
// ==============================

// Fonction pour calculer la distance entre deux points GPS (Haversine)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fonction pour comparer deux polylines et déterminer leur similarité
function comparePolylines(poly1, poly2, corridorWidth = 100) {
  if (!poly1 || !poly2 || poly1.length < 2 || poly2.length < 2) return 0;
  
  // Échantillonner les polylines pour accélérer la comparaison
  const sampleRate = Math.max(1, Math.floor(Math.min(poly1.length, poly2.length) / 50));
  const sampled1 = poly1.filter((_, i) => i % sampleRate === 0);
  const sampled2 = poly2.filter((_, i) => i % sampleRate === 0);
  
  let matchCount = 0;
  
  for (const point1 of sampled1) {
    for (const point2 of sampled2) {
      const distance = haversineDistance(point1[0], point1[1], point2[0], point2[1]);
      if (distance <= corridorWidth) {
        matchCount++;
        break;
      }
    }
  }
  
  return matchCount / sampled1.length;
}

// Fonction pour détecter les sorties communes
function detectGroupActivities(data) {
  const groupActivities = [];
  const processedPairs = new Set();
  
  // Grouper les activités par date (même jour)
  const activitiesByDate = {};
  data.forEach(activity => {
    const date = activity.date.split('T')[0];
    if (!activitiesByDate[date]) activitiesByDate[date] = [];
    activitiesByDate[date].push(activity);
  });
  
  // Pour chaque jour, chercher les activités similaires
  Object.values(activitiesByDate).forEach(dayActivities => {
    if (dayActivities.length < 2) return;
    
    for (let i = 0; i < dayActivities.length; i++) {
      for (let j = i + 1; j < dayActivities.length; j++) {
        const a1 = dayActivities[i];
        const a2 = dayActivities[j];
        
        // Éviter les doublons
        const pairKey = [a1.id, a2.id].sort().join('-');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        // Même athlète = pas une sortie de groupe
        if (a1.athlete_id === a2.athlete_id) continue;
        
        // Vérifier les critères de correspondance
        const isMatch = checkActivityMatch(a1, a2);
        
        if (isMatch) {
          groupActivities.push({
            athletes: [a1.athlete_id, a2.athlete_id],
            activities: [a1, a2],
            date: a1.date.split('T')[0],
            sport: a1.sport,
            elevation: Math.round((a1.elevation_gain_m + a2.elevation_gain_m) / 2),
            duration: Math.round((a1.moving_time_s + a2.moving_time_s) / 2)
          });
        }
      }
    }
  });
  
  return groupActivities;
}

// Vérifier si deux activités correspondent à une sortie commune
function checkActivityMatch(a1, a2) {
  // 1. Vérifier l'heure de départ (moins de 30 minutes d'écart)
  const time1 = new Date(a1.date).getTime();
  const time2 = new Date(a2.date).getTime();
  const timeDiff = Math.abs(time1 - time2) / (1000 * 60); // en minutes
  
  if (timeDiff > 30) return false;
  
  // 2. Vérifier la durée (moins d'1h d'écart)
  const duration1 = a1.moving_time_s || 0;
  const duration2 = a2.moving_time_s || 0;
  const durationDiff = Math.abs(duration1 - duration2) / 3600; // en heures
  
  if (durationDiff > 1) return false;
  
  // 3. Vérifier le type de sport (doit être similaire)
  const sport1 = mapSportName(a1.sport);
  const sport2 = mapSportName(a2.sport);
  if (sport1 !== sport2) return false;
  
  // 4. Vérifier les polylines si disponibles
  if (a1.tracemap?.summary_polyline && a2.tracemap?.summary_polyline) {
    const poly1 = decodePolyline(a1.tracemap.summary_polyline);
    const poly2 = decodePolyline(a2.tracemap.summary_polyline);
    
    const similarity = comparePolylines(poly1, poly2, 100);
    if (similarity < 0.75) return false;
  } else {
    // Sans polyline, vérifier la distance et le dénivelé
    const distDiff = Math.abs((a1.distance_m || 0) - (a2.distance_m || 0));
    const elevDiff = Math.abs((a1.elevation_gain_m || 0) - (a2.elevation_gain_m || 0));
    
    // Tolérance : 10% de différence max
    const avgDist = ((a1.distance_m || 0) + (a2.distance_m || 0)) / 2;
    const avgElev = ((a1.elevation_gain_m || 0) + (a2.elevation_gain_m || 0)) / 2;
    
    if (avgDist > 0 && distDiff / avgDist > 0.1) return false;
    if (avgElev > 0 && elevDiff / avgElev > 0.1) return false;
  }
  
  return true;
}

// Fonction principale pour afficher le graphe social
export function showSocialGraph(data) {
  const container = document.getElementById('socialGraph');
  if (!container) return;
  
  // Nettoyer le conteneur
  container.innerHTML = '';
  
  // Détecter les sorties en groupe
  const groupActivities = detectGroupActivities(data);
  
  // Calculer les stats par athlète
  const athleteStats = {};
  data.forEach(activity => {
    const id = activity.athlete_id;
    if (!athleteStats[id]) {
      athleteStats[id] = { 
        id, 
        name: getAthleteName(id),
        totalElevation: 0,
        groupCount: 0
      };
    }
    athleteStats[id].totalElevation += activity.elevation_gain_m || 0;
  });
  
  // Compter les sorties de groupe par athlète
  groupActivities.forEach(group => {
    group.athletes.forEach(athleteId => {
      if (athleteStats[athleteId]) {
        athleteStats[athleteId].groupCount++;
      }
    });
  });
  
  // Créer les nodes
  const nodes = Object.values(athleteStats).map(athlete => ({
    id: athlete.id,
    name: athlete.name,
    totalElevation: athlete.totalElevation,
    groupCount: athlete.groupCount,
    radius: Math.max(20, Math.min(50, Math.sqrt(athlete.totalElevation) / 10))
  }));
  
  // Créer les links avec offset pour éviter la superposition
  const linksByPair = {};
  groupActivities.forEach((group, index) => {
    const pairKey = group.athletes.sort().join('-');
    if (!linksByPair[pairKey]) {
      linksByPair[pairKey] = [];
    }
    linksByPair[pairKey].push({
      source: group.athletes[0],
      target: group.athletes[1],
      date: group.date,
      sport: mapSportName(group.sport),
      elevation: group.elevation,
      duration: group.duration,
      index: linksByPair[pairKey].length
    });
  });
  
  // Aplatir les links avec offset
  const links = [];
  Object.values(linksByPair).forEach(pairLinks => {
    const count = pairLinks.length;
    pairLinks.forEach((link, i) => {
      link.offset = count > 1 ? (i - (count - 1) / 2) * 15 : 0;
      link.totalInPair = count;
      links.push(link);
    });
  });
  
  // Dimensions
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 550;
  
  // Créer le SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);
  
  // Créer le tooltip
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'social-tooltip');
  
  // Définir les gradients pour les liens
  const defs = svg.append('defs');
  
  // Simulation de force
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(150)
      .strength(link => 0.3 + (link.totalInPair * 0.1))
    )
    .force('charge', d3.forceManyBody()
      .strength(d => -300 - d.groupCount * 50)
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => d.radius + 20)
    );
  
  // Fonction pour générer un chemin courbe avec offset
  function linkArc(d) {
    const dx = d.target.x - d.source.x;
    const dy = d.target.y - d.source.y;
    const dr = Math.sqrt(dx * dx + dy * dy);
    
    // Calculer le point de contrôle pour la courbe
    const midX = (d.source.x + d.target.x) / 2;
    const midY = (d.source.y + d.target.y) / 2;
    
    // Perpendiculaire pour l'offset
    const perpX = -dy / dr * d.offset;
    const perpY = dx / dr * d.offset;
    
    const ctrlX = midX + perpX;
    const ctrlY = midY + perpY;
    
    return `M${d.source.x},${d.source.y} Q${ctrlX},${ctrlY} ${d.target.x},${d.target.y}`;
  }
  
  // Dessiner les liens
  const link = svg.append('g')
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'social-link')
    .attr('stroke', d => getSportColor(d.sport))
    .attr('stroke-width', d => Math.max(2, Math.min(8, d.elevation / 300)))
    .attr('opacity', 0.6)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 1).attr('stroke-width', d => Math.max(3, Math.min(10, d.elevation / 300 + 2)));
      
      const date = new Date(d.date).toLocaleDateString('fr-FR', { 
        weekday: 'long', day: 'numeric', month: 'long' 
      });
      const sourceName = getAthleteName(d.source.id || d.source);
      const targetName = getAthleteName(d.target.id || d.target);
      const duration = Math.round(d.duration / 60);
      
      tooltip.html(`
        <div class="social-tooltip-title">
          <span class="social-tooltip-sport" style="background: ${getSportColor(d.sport)}"></span>
          ${sourceName} & ${targetName}
        </div>
        <div class="social-tooltip-details">
          ${date}<br>
          ${d.sport}<br>
          <span class="social-tooltip-elevation">↑ ${formatElevation(d.elevation)} m</span> · ${duration} min
        </div>
      `)
      .style('left', (event.offsetX + 15) + 'px')
      .style('top', (event.offsetY - 15) + 'px')
      .classed('visible', true);
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.6).attr('stroke-width', d => Math.max(2, Math.min(8, d.elevation / 300)));
      tooltip.classed('visible', false);
    });
  
  // Dessiner les nodes
  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'social-node')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    );
  
  // Cercles des nodes
  node.append('circle')
    .attr('r', d => d.radius)
    //.attr('fill', d => getAthleteColor(d.id))
      .attr('fill', "#222230FF")
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('opacity', 0.9);
  
  // Labels des nodes
  node.append('text')
    .attr('class', 'social-node-label')
    .attr('dy', d => d.radius + 15)
    .text(d => d.name);
  
  // Tooltip pour les nodes
  node.on('mouseover', function(event, d) {
    tooltip.html(`
      <div class="social-tooltip-title">
        <span class="social-tooltip-sport" style="background: ${getAthleteColor(d.id)}"></span>
        ${d.name}
      </div>
      <div class="social-tooltip-details">
        <span class="social-tooltip-elevation">↑ ${formatElevation(d.totalElevation)} m</span> total<br>
        ${d.groupCount} sortie${d.groupCount > 1 ? 's' : ''} en groupe
      </div>
    `)
    .style('left', (event.offsetX + 15) + 'px')
    .style('top', (event.offsetY - 15) + 'px')
    .classed('visible', true);
  })
  .on('mouseout', function() {
    tooltip.classed('visible', false);
  });
  
  // Mise à jour de la simulation
  simulation.on('tick', () => {
    link.attr('d', linkArc);
    
    node.attr('transform', d => {
      d.x = Math.max(d.radius, Math.min(width - d.radius, d.x));
      d.y = Math.max(d.radius, Math.min(height - d.radius, d.y));
      return `translate(${d.x},${d.y})`;
    });
  });
  
  // Fonctions de drag
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  
  // Générer la légende et les stats
  generateSocialLegend(links);
  generateSocialStats(nodes, links, groupActivities);
  
  // Resize handler
  window.addEventListener('resize', () => {
    const newWidth = container.clientWidth || 800;
    const newHeight = container.clientHeight || 550;
    svg.attr('width', newWidth).attr('height', newHeight);
    simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
    simulation.alpha(0.3).restart();
  });
}

function generateSocialLegend(links) {
  const legendContainer = document.getElementById('socialLegendItems');
  if (!legendContainer) return;
  
  const sports = [...new Set(links.map(l => l.sport))];
  
  legendContainer.innerHTML = sports.map(sport => `
    <div class="social-legend-item">
      <div class="social-legend-color" style="background: ${getSportColor(sport)}"></div>
      <span>${sport}</span>
    </div>
  `).join('');
}

function generateSocialStats(nodes, links, groupActivities) {
  const statsContainer = document.getElementById('socialStats');
  if (!statsContainer) return;
  
  const totalGroupRides = groupActivities.length;
  const totalGroupElevation = groupActivities.reduce((sum, g) => sum + g.elevation, 0);
  
  // Trouver le duo le plus actif
  const pairCount = {};
  groupActivities.forEach(g => {
    const key = g.athletes.sort().map(id => getAthleteName(id)).join(' & ');
    pairCount[key] = (pairCount[key] || 0) + 1;
  });
  
  const topDuo = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0];
  
  // Athlète le plus social
  const socialScore = {};
  nodes.forEach(n => socialScore[n.name] = n.groupCount);
  const mostSocial = Object.entries(socialScore).sort((a, b) => b[1] - a[1])[0];
  
  statsContainer.innerHTML = `
    <h4>Statistiques</h4>
    <div class="social-stat-item">
      <span>Sorties en groupe</span>
      <span class="social-stat-value">${totalGroupRides}</span>
    </div>
    <div class="social-stat-item">
      <span>D+ en groupe</span>
      <span class="social-stat-value">${formatElevation(totalGroupElevation)} m</span>
    </div>
    ${topDuo ? `
    <div class="social-stat-item">
      <span>Duo le + actif</span>
      <span class="social-stat-value" style="font-size: 0.65rem">${topDuo[0]}</span>
    </div>
    ` : ''}
    ${mostSocial && mostSocial[1] > 0 ? `
    <div class="social-stat-item">
      <span>Le + social</span>
      <span class="social-stat-value">${mostSocial[0]}</span>
    </div>
    ` : ''}
  `;
}

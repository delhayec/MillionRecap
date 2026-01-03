import { getAthleteColor, getSportColor, mapSportName, generateAllDays, getOrdinalSuffix, decodePolyline, formatElevation } from './utils.js';

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
    label: `Athlète ${athlete}`,
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
                const athleteId = parseInt(context.dataset.label.replace('Athlète ', ''));
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
          text: `Athlète ${athleteId} — ${selectedSport || 'Tous sports'}`
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
    label: `Athlète ${athlete}`,
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
              const athleteId = parseInt(dataset.label.replace('Athlète ', ''));
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
      text.textContent = `Athlète ${athleteId} (${count})`;

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
        total_time: 0
      };
    }

    athleteStats[id].total_elevation += activity.elevation_gain_m || 0;
    athleteStats[id].activity_count++;
    athleteStats[id].total_distance += activity.distance_m || 0;
    athleteStats[id].total_time += activity.moving_time_s || 0;
  });

  const stats = Object.values(athleteStats).map(s => ({
    ...s,
    elevation_per_distance: s.total_distance > 0 ? (s.total_elevation / (s.total_distance / 1000)).toFixed(1) : 0,
    elevation_per_time: s.total_time > 0 ? (s.total_elevation / (s.total_time / 3600)).toFixed(1) : 0,
    elevation_per_activity: s.activity_count > 0 ? (s.total_elevation / s.activity_count).toFixed(0) : 0
  }));

  stats.sort((a, b) => b.total_elevation - a.total_elevation);

  tbody.innerHTML = '';

  stats.forEach(s => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="color: ${getAthleteColor(s.athlete_id)}">Athlète ${s.athlete_id}</td>
      <td>${s.total_elevation.toLocaleString('fr-FR')}</td>
      <td>${s.activity_count}</td>
      <td>${(s.total_distance / 1000).toFixed(0)}</td>
      <td>${Math.round(s.total_time / 3600)}</td>
      <td>${s.elevation_per_distance}</td>
      <td>${s.elevation_per_time}</td>
      <td>${s.elevation_per_activity}</td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll('#rankingTable th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const isAsc = th.classList.contains('sorted-asc');
      
      document.querySelectorAll('#rankingTable th').forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      
      stats.sort((a, b) => isAsc ? a[key] - b[key] : b[key] - a[key]);
      th.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
      
      tbody.innerHTML = '';
      stats.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="color: ${getAthleteColor(s.athlete_id)}">Athlète ${s.athlete_id}</td>
          <td>${s.total_elevation.toLocaleString('fr-FR')}</td>
          <td>${s.activity_count}</td>
          <td>${(s.total_distance / 1000).toFixed(0)}</td>
          <td>${Math.round(s.total_time / 3600)}</td>
          <td>${s.elevation_per_distance}</td>
          <td>${s.elevation_per_time}</td>
          <td>${s.elevation_per_activity}</td>
        `;
        tbody.appendChild(row);
      });
    });
  });
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

  athletes.forEach(a => {
    const name = `Athlète ${a}`;
    if (!nodeSet.has(name)) {
      nodes.push({ name, itemStyle: { color: getAthleteColor(a) } });
      nodeSet.add(name);
    }
  });

  sports.forEach(s => {
    if (!nodeSet.has(s)) {
      nodes.push({ name: s, itemStyle: { color: getSportColor(s) } });
      nodeSet.add(s);
    }
  });

  const linkMap = {};
  data.forEach(activity => {
    const source = `Athlète ${activity.athlete_id}`;
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
      key = `Athlète ${activity.athlete_id}`;
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
      text: athleteId ? `Rythmes — Athlète ${athleteId}` : 'Rythmes par sport',
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
  const athletes = Object.keys(distributions).sort((a, b) => {
    const numA = parseInt(a.replace('Athlète ', ''));
    const numB = parseInt(b.replace('Athlète ', ''));
    return numA - numB;
  });

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
    const athleteId = parseInt(athlete.replace('Athlète ', ''));
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

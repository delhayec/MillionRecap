import { getAthleteColor, getSportColor, mapSportName, generateAllDays, getOrdinalSuffix, decodePolyline, formatElevation } from './utils.js';

// ==============================
// CONFIGURATION CHART.JS
// ==============================
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
      color: '#FFFFFF',
      font: { size: 16, weight: 'bold', family: "'Times New Roman', serif" }
    },
    legend: {
      labels: {
        color: '#FFFFFF',
        font: { size: 12 },
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      enabled: false
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.08)' },
      ticks: { color: '#FFFFFF', font: { size: 10 } }
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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
    stack: 'stack0',
    yAxisID: 'y'
  }));

  const lineDataset = {
    type: 'line',
    label: 'Dénivelé cumulé total',
    data: cumulativeElevation,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 3,
    fill: false,
    pointRadius: 0,
    tension: 0.3,
    yAxisID: 'y1'
  };

  const targetDataset = {
    type: 'line',
    label: 'Objectif 1 Million',
    data: targetLine,
    borderColor: '#FF6B6B',
    borderWidth: 2,
    borderDash: [5, 5],
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
          text: `Dénivelé ${year} - Tous les athlètes (Sport: ${selectedSport || 'Tous'})`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          padding: 12,
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
              const status = difference >= 0 ? 'Avance' : 'Retard';
              return `\nDénivelé cumulé: ${formatElevation(cumul)} m\n${status}: ${formatElevation(Math.abs(difference))} m`;
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
        x: baseChartOptions.scales.x,
        y: {
          type: 'linear',
          position: 'right',
          stacked: true,
          title: {
            display: true,
            text: 'Dénivelé journalier (m)',
            color: '#FFFFFF'
          },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#FFFFFF' }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: '#FFFFFF'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
            drawOnChartArea: false
          },
          ticks: { color: '#FFFFFF' }
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

  const totalElevation = cumulativeElevation[cumulativeElevation.length - 1];
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
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Dénivelé cumulé',
          data: cumulativeElevation,
          borderColor: '#FFFFFF',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 3,
          fill: false,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          type: 'line',
          label: `Objectif ${formatElevation(totalElevation)} m`,
          data: targetLine,
          borderColor: '#FF6B6B',
          borderWidth: 2,
          borderDash: [5, 5],
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
          text: `Dénivelé ${year} - Athlète ${athleteId} (Sport: ${selectedSport || 'Tous'})`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          padding: 12,
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
              const status = difference >= 0 ? 'Avance' : 'Retard';
              return `\nDénivelé cumulé: ${formatElevation(cumul)} m\n${status}: ${formatElevation(Math.abs(difference))} m`;
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
        x: baseChartOptions.scales.x,
        y: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Dénivelé journalier (m)',
            color: '#FFFFFF'
          },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#FFFFFF' }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: '#FFFFFF'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
            drawOnChartArea: false
          },
          ticks: { color: '#FFFFFF' }
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
      const dayData = athleteData.find(item => item.date.startsWith(day));
      return dayData ? dayData.elevation_gain_m : 0;
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
    tension: 0.3
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
          text: `Classement ${year} (Sport: ${selectedSport || 'Tous'})`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          padding: 12,
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
        x: baseChartOptions.scales.x,
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: '#FFFFFF'
          },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#FFFFFF' }
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
  if (map) return;

  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  map = L.map('map').setView([46.2276, 2.2137], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }).addTo(map);
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

  Object.values(countryStats).forEach(stat => {
    stat.athleteCount = stat.athletes.size;
    delete stat.athletes;
  });

  return countryStats;
}

function showCountryRanking(activities) {
  const statsContainer = document.getElementById('countryStatsContainer');
  if (!statsContainer) return;

  const stats = calculateCountryStats(activities);
  const countries = Object.values(stats).sort((a, b) => b.count - a.count);

  let html = '';

  countries.forEach((country, index) => {
    const rank = index + 1;
    const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

    html += `
      <div class="country-item" data-country="${country.name}">
        <div class="country-name">
          ${rankEmoji} ${country.name}
        </div>
        <div class="country-stats-line">
          <span class="country-badge">${country.count}</span>
          activité${country.count > 1 ? 's' : ''}
        </div>
        <div class="country-stats-line">
          👥 ${country.athleteCount} athlète${country.athleteCount > 1 ? 's' : ''}
        </div>
        <div class="country-stats-line">
          ⛰️ ${formatElevation(country.elevation)} m
        </div>
        <div class="country-stats-line">
          📏 ${(country.distance / 1000).toFixed(0)} km
        </div>
      </div>
    `;
  });

  const totalCountries = countries.length;
  const totalWithCountry = activities.filter(a => a.country).length;
  const totalActivities = activities.length;

  html += `
    <div class="country-summary">
      <div style="margin-bottom: 8px;">
        <strong>${totalCountries}</strong> pays visité${totalCountries > 1 ? 's' : ''}
      </div>
      <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6);">
        ${totalWithCountry} / ${totalActivities} activités localisées
      </div>
    </div>
  `;

  statsContainer.innerHTML = html;

  document.querySelectorAll('.country-item').forEach(item => {
    item.addEventListener('click', function() {
      const countryName = this.getAttribute('data-country');

      document.querySelectorAll('.country-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');

      const filteredActivities = activities.filter(a => a.country === countryName);
      showMapChart(filteredActivities, null);
    });
  });
}

export function showMapChart(filteredData, selectedAthleteId = null) {
  if (!filteredData || filteredData.length === 0) return;

  if (!map) initMap();

  polylines.forEach(polyline => map.removeLayer(polyline));
  polylines = [];

  const activitiesWithPolylines = filteredData.filter(activity =>
    activity.tracemap &&
    activity.tracemap.polyline &&
    typeof activity.tracemap.polyline === 'string' &&
    activity.tracemap.polyline.trim() !== ""
  );

  if (activitiesWithPolylines.length === 0) return;

  const colorMode = selectedAthleteId ? 'sport' : 'athlete';

  generateLegend(activitiesWithPolylines, colorMode);
  showCountryRanking(filteredData);

  activitiesWithPolylines.forEach(activity => {
    try {
      const decodedPoints = decodePolyline(activity.tracemap.polyline);
      if (!decodedPoints || decodedPoints.length === 0) return;

      const validPoints = decodedPoints.filter(point =>
        !isNaN(point[0]) && !isNaN(point[1])
      );
      if (validPoints.length === 0) return;

      let color;
      if (colorMode === 'sport') {
        const mappedSport = mapSportName(activity.sport);
        color = getSportColor(mappedSport);
      } else {
        color = getAthleteColor(activity.athlete_id);
      }

      const polyline = L.polyline(validPoints, {
        color: color,
        weight: 4,
        opacity: 0.9
      }).addTo(map);

      const mappedSport = mapSportName(activity.sport);
      const countryInfo = activity.country ? `<br>Pays: ${activity.country}` : '';

      polyline.bindPopup(`
        <b>${activity.name || 'Activité'}</b><br>
        Athlète: ${activity.athlete_id}<br>
        Sport: ${mappedSport}${countryInfo}
      `);

      polylines.push(polyline);
    } catch (e) {
      console.error(`Erreur activité ${activity.activity_id}:`, e);
    }
  });

  if (polylines.length > 0) {
    const group = new L.FeatureGroup(polylines);
    map.fitBounds(group.getBounds().pad(0.5));
  }
}

// ==============================
// TABLEAU DE CLASSEMENT
// ==============================
export function showRankingTable(data) {
  document.getElementById('rankingTableContainer').style.display = 'block';

  const athletesStats = {};
  data.forEach(activity => {
    const athleteId = activity.athlete_id;
    if (!athletesStats[athleteId]) {
      athletesStats[athleteId] = {
        athlete_id: athleteId,
        total_elevation: 0,
        activity_count: 0,
        total_distance: 0,
        total_time: 0,
        name: `Athlète ${athleteId}`
      };
    }
    athletesStats[athleteId].total_elevation += activity.elevation_gain_m || 0;
    athletesStats[athleteId].activity_count += 1;
    athletesStats[athleteId].total_distance += activity.distance_m || 0;
    athletesStats[athleteId].total_time += activity.moving_time_s || 0;
  });

  const athletesArray = Object.values(athletesStats).map(stat => ({
    ...stat,
    total_distance_km: (stat.total_distance / 1000).toFixed(2),
    total_time_h: (stat.total_time / 3600).toFixed(2),
    elevation_per_distance: stat.total_distance > 0 ? (stat.total_elevation / (stat.total_distance / 1000)).toFixed(2) : 0,
    elevation_per_time: stat.total_time > 0 ? (stat.total_elevation / (stat.total_time / 3600)).toFixed(2) : 0,
    elevation_per_activity: (stat.total_elevation / stat.activity_count).toFixed(2)
  }));

  athletesArray.sort((a, b) => b.total_elevation - a.total_elevation);

  const tableBody = document.getElementById('rankingTableBody');
  tableBody.innerHTML = '';
  athletesArray.forEach(athlete => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${athlete.name}</td>
      <td>${athlete.total_elevation.toFixed(0)}</td>
      <td>${athlete.activity_count}</td>
      <td>${athlete.total_distance_km}</td>
      <td>${athlete.total_time_h}</td>
      <td>${athlete.elevation_per_distance}</td>
      <td>${athlete.elevation_per_time}</td>
      <td>${athlete.elevation_per_activity}</td>
    `;
    tableBody.appendChild(row);
  });

  setupSorting(athletesArray);
}

function setupSorting(athletesArray) {
  const headers = document.querySelectorAll('#rankingTable th[data-sort]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const sortKey = header.getAttribute('data-sort');
      const currentSort = header.getAttribute('data-order') || 'none';

      headers.forEach(h => {
        h.removeAttribute('data-order');
        h.classList.remove('sorted-asc', 'sorted-desc');
      });

      let newOrder = 'asc';
      if (currentSort === 'asc') newOrder = 'desc';
      else if (currentSort === 'desc') newOrder = 'none';

      if (newOrder !== 'none') {
        header.setAttribute('data-order', newOrder);
        header.classList.add(`sorted-${newOrder}`);

        athletesArray.sort((a, b) => {
          if (sortKey.startsWith('elevation_per')) {
            const valA = parseFloat(a[sortKey]);
            const valB = parseFloat(b[sortKey]);
            return newOrder === 'asc' ? valA - valB : valB - valA;
          }
          return newOrder === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
        });

        const tableBody = document.getElementById('rankingTableBody');
        tableBody.innerHTML = '';
        athletesArray.forEach(athlete => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${athlete.name}</td>
            <td>${athlete.total_elevation.toFixed(0)}</td>
            <td>${athlete.activity_count}</td>
            <td>${athlete.total_distance_km}</td>
            <td>${athlete.total_time_h}</td>
            <td>${athlete.elevation_per_distance}</td>
            <td>${athlete.elevation_per_time}</td>
            <td>${athlete.elevation_per_activity}</td>
          `;
          tableBody.appendChild(row);
        });
      }
    });
  });
}

// ==============================
// DIAGRAMME DE SANKEY
// ==============================
export function showSankeyDiagram(data) {
  const chartDom = document.getElementById('sankeyChart');
  if (!chartDom) return;

  if (window.sankeyChart && typeof window.sankeyChart.dispose === 'function') {
    window.sankeyChart.dispose();
  }

  window.sankeyChart = echarts.init(chartDom);

  const athleteSportElevation = {};
  const athleteTotalElevation = {};
  const sportTotalElevation = {};
  const athletes = new Set();
  const sports = new Set();

  data.forEach(activity => {
    const athleteId = activity.athlete_id;
    const mappedSport = mapSportName(activity.sport);
    const elevation = activity.elevation_gain_m || 0;

    athletes.add(athleteId);
    sports.add(mappedSport);

    const key = `${athleteId}_${mappedSport}`;
    athleteSportElevation[key] = (athleteSportElevation[key] || 0) + elevation;
    athleteTotalElevation[athleteId] = (athleteTotalElevation[athleteId] || 0) + elevation;
    sportTotalElevation[mappedSport] = (sportTotalElevation[mappedSport] || 0) + elevation;
  });

  const nodes = [];

  Array.from(athletes).sort((a, b) => a - b).forEach(athleteId => {
    nodes.push({
      name: `Athlète ${athleteId}`,
      itemStyle: { color: getAthleteColor(athleteId) }
    });
  });

  Array.from(sports).sort().forEach(sport => {
    nodes.push({
      name: sport,
      itemStyle: { color: getSportColor(sport) }
    });
  });

  const links = [];
  const totalElevation = data.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0);

  Object.keys(athleteSportElevation).forEach(key => {
    const [athleteId, sport] = key.split('_');
    const value = athleteSportElevation[key];
    const percentageOfTotal = ((value / totalElevation) * 100).toFixed(1);
    const percentageOfAthlete = ((value / athleteTotalElevation[athleteId]) * 100).toFixed(1);
    const percentageOfSport = ((value / sportTotalElevation[sport]) * 100).toFixed(1);

    links.push({
      source: `Athlète ${athleteId}`,
      target: sport,
      value: value,
      percentageOfTotal: percentageOfTotal,
      percentageOfAthlete: percentageOfAthlete,
      percentageOfSport: percentageOfSport
    });
  });

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: 'Répartition du dénivelé par athlète et sport',
      textStyle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: "'Times New Roman', serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: { color: '#FFFFFF' },
      confine: true,
      position: function(point, params, dom, rect, size) {
        window.lastTooltipX = point[0];
        return [point[0] + 10, point[1] - 10];
      },
      formatter: function(params) {
        if (params.dataType === 'edge') {
          const value = params.value;
          const data = params.data;

          let mouseX = window.lastTooltipX ||
                       params.event?.offsetX ||
                       params.event?.event?.offsetX ||
                       params.event?.event?.clientX || 0;

          const chartDom = document.getElementById('sankeyChart');
          const chartRect = chartDom.getBoundingClientRect();
          const chartWidth = chartRect.width;
          const chartCenterX = chartWidth / 2;

          if (params.event?.event?.clientX) {
            mouseX = params.event.event.clientX - chartRect.left;
          }

          const isLeftSide = mouseX < chartCenterX;

          if (isLeftSide) {
            return `<b>${data.source} → ${data.target}</b><br/>Dénivelé: ${formatElevation(value)} m<br/>Part de l'athlète: ${data.percentageOfAthlete}%`;
          } else {
            return `<b>${data.source} → ${data.target}</b><br/>Dénivelé: ${formatElevation(value)} m<br/>Contribution au sport: ${data.percentageOfSport}%`;
          }
        } else if (params.dataType === 'node') {
          return `<b>${params.name}</b>`;
        }
        return '';
      }
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: {
        focus: 'adjacency',
        lineStyle: { opacity: 0.8 }
      },
      data: nodes,
      links: links,
      lineStyle: {
        color: 'gradient',
        curveness: 0.5,
        opacity: 0.3
      },
      label: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: "'Times New Roman', serif"
      },
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '10%'
    }]
  };

  window.sankeyChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.sankeyChart) {
      window.sankeyChart.resize();
    }
  });
}

// ==============================
// CALENDRIER HEATMAP
// ==============================
export function showCalendarHeatmap(data, athleteId = null, selectedSport = null) {
  const chartDom = document.getElementById('calendarHeatmap');
  if (!chartDom) return;

  if (window.heatmapChart) {
    window.heatmapChart.dispose();
  }

  window.heatmapChart = echarts.init(chartDom);

  let filteredData = data;

  if (athleteId && athleteId !== "classement") {
    filteredData = filteredData.filter(activity => activity.athlete_id == athleteId);
  }

  if (selectedSport) {
    filteredData = filteredData.filter(activity => activity.sport === selectedSport);
  }

  const year = filteredData.length > 0 ? new Date(filteredData[0].date).getFullYear() : 2025;

  const allDays = generateAllDays(year);
  const dailyData = {};
  const dailyActivityCount = {};

  allDays.forEach(day => {
    dailyData[day] = 0;
    dailyActivityCount[day] = 0;
  });

  filteredData.forEach(activity => {
    const date = activity.date.split('T')[0];
    if (dailyData.hasOwnProperty(date)) {
      dailyData[date] += (activity.elevation_gain_m || 0);
      dailyActivityCount[date] += 1;
    }
  });

  const elevationValues = Object.values(dailyData).filter(val => val > 0);
  const maxElevation = elevationValues.length > 0 ? Math.max(...elevationValues) : 1000;

  const heatmapDataForChart = allDays.map(day => [day, dailyData[day]]);

  let titleText = 'Activité de l\'année';
  if (athleteId && athleteId !== "classement") {
    titleText = `Activité de l'année - Athlète ${athleteId}`;
  }
  if (selectedSport) {
    titleText += ` (${selectedSport})`;
  }

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: titleText,
      textStyle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: "'Times New Roman', serif"
      },
      left: 'center',
      top: 0
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: { color: '#FFFFFF' },
      formatter: function(params) {
        const date = new Date(params.value[0]);
        const elevation = params.value[1];
        const activityCount = dailyActivityCount[params.value[0]];

        const formattedDate = date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        if (activityCount === 0) {
          return `<b>${formattedDate}</b><br/>Aucune activité`;
        } else if (activityCount === 1) {
          return `<b>${formattedDate}</b><br/>Dénivelé: ${formatElevation(elevation)} m<br/>1 activité`;
        } else {
          return `<b>${formattedDate}</b><br/>Dénivelé: ${formatElevation(elevation)} m<br/>${activityCount} activités`;
        }
      }
    },
    visualMap: {
      min: 0,
      max: maxElevation,
      type: 'piecewise',
      orient: 'horizontal',
      left: 'center',
      top: 25,
      pieces: [
        { min: 0, max: 0, label: 'Aucun', color: '#1a1a28' },
        { min: 1, max: 500, label: 'Faible', color: '#4a3d6a' },
        { min: 500, max: 1500, label: 'Moyen', color: '#7860a8' },
        { min: 1500, max: 3000, label: 'Bon', color: '#9A5FE0' },
        { min: 3000, label: 'Excellent', color: '#c084fc' }
      ],
      textStyle: {
        color: '#FFFFFF',
        fontSize: 11
      }
    },
    calendar: {
      top: 80,
      left: 30,
      right: 30,
      cellSize: ['auto', 13],
      range: `${year}`,
      itemStyle: {
        borderWidth: 2,
        borderColor: '#0a0817'
      },
      yearLabel: { show: false },
      dayLabel: {
        nameMap: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
        color: '#FFFFFF',
        fontSize: 11
      },
      monthLabel: {
        nameMap: 'fr',
        color: '#FFFFFF',
        fontSize: 12
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#0a0817',
          width: 2
        }
      }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: heatmapDataForChart
    }]
  };

  window.heatmapChart.setOption(option);

  setTimeout(() => {
    if (window.heatmapChart) {
      window.heatmapChart.resize();
    }
  }, 100);

  window.addEventListener('resize', () => {
    if (window.heatmapChart) {
      window.heatmapChart.resize();
    }
  });
}

// ==============================
// GRAPHIQUE RIDGELINE
// ==============================

function calculateHourlyDistribution(activities, groupBy = 'sport') {
  const distributions = {};

  activities.forEach(activity => {
    const startDate = new Date(activity.date);
    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const durationHours = (activity.moving_time_s || 0) / 3600;

    const groupKey = groupBy === 'sport'
      ? mapSportName(activity.sport)
      : `Athlète ${activity.athlete_id}`;

    if (!distributions[groupKey]) {
      distributions[groupKey] = [];
    }

    const samples = Math.max(1, Math.ceil(durationHours * 4));
    for (let i = 0; i < samples; i++) {
      const hour = (startHour + (i / samples) * durationHours) % 24;
      distributions[groupKey].push(hour);
    }
  });

  return distributions;
}

export function showRidgelineBySport(data, athleteId = null, selectedSport = null) {
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
  const sports = Object.keys(distributions).sort();

  if (sports.length === 0) return;

  const sportVolumes = {};
  sports.forEach(sport => {
    const totalHours = distributions[sport].length * 0.25;
    sportVolumes[sport] = totalHours;
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

  const GAP_FACTOR = 0.1;

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
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: getSportColor(sport) + 'AA' },
            { offset: 1, color: getSportColor(sport) + '40' }
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
      text: athleteId
        ? `Répartition horaire - Athlète ${athleteId}${selectedSport ? ' (' + selectedSport + ')' : ''}`
        : `Répartition horaire par sport${selectedSport ? ' (' + selectedSport + ')' : ''}`,
      textStyle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: "'Times New Roman', serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: { color: '#FFFFFF' },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.5)',
          width: 1
        }
      },
      formatter: function(params) {
        const hour = params[0].axisValue;
        const hourInt = Math.floor(hour);
        const minutes = Math.round((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const endMinutes = (minutes + 15) % 60;
        const endHour = minutes + 15 >= 60 ? (hourInt + 1) % 24 : hourInt;
        const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        let result = `<b>${timeStr} - ${endTimeStr}</b><br/>`;

        const dataIndex = params[0].dataIndex;
        let totalHours = 0;

        params.forEach(param => {
          const sportName = param.seriesName;
          const hours = rawDataBySport[sportName][dataIndex];
          totalHours += hours;

          if (hours > 0) {
            const hoursInt = Math.floor(hours);
            const minutesInt = Math.round((hours - hoursInt) * 60);
            const timeDisplay = hoursInt > 0
              ? `${hoursInt}h${minutesInt.toString().padStart(2, '0')}`
              : `${minutesInt}min`;
            result += `${param.marker}${sportName}: ${timeDisplay}<br/>`;
          }
        });

        if (totalHours > 0) {
          const totalHoursInt = Math.floor(totalHours);
          const totalMinutesInt = Math.round((totalHours - totalHoursInt) * 60);
          const totalDisplay = totalHoursInt > 0
            ? `${totalHoursInt}h${totalMinutesInt.toString().padStart(2, '0')}`
            : `${totalMinutesInt}min`;
          result += `<br/><b>Total: ${totalDisplay}</b>`;
        }

        return result;
      }
    },
    legend: {
      data: sortedSports,
      textStyle: {
        color: '#FFFFFF',
        fontSize: 12
      },
      top: 40,
      left: 'center'
    },
    grid: {
      left: '3%',
      right: '12%',
      top: sortedSports.length > 1 ? 80 : 60,
      bottom: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      boundaryGap: false,
      axisLabel: {
        color: '#FFFFFF',
        fontSize: 11,
        formatter: function(value) {
          const hour = Math.floor(value);
          if (value % 1 === 0) {
            return hour + 'h';
          }
          return '';
        }
      },
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }
      },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(255, 255, 255, 0.08)' }
      }
    },
    yAxis: {
      type: 'value',
      show: true,
      position: 'right',
      min: 0,
      max: maxHours + (sortedSports.length - 1) * (maxHours * 0.25),
      axisLabel: {
        color: '#FFFFFF',
        fontSize: 11,
        formatter: function(value) {
          for (let i = 0; i < sortedSports.length; i++) {
            const baseline = i * (maxHours * 0.25);
            if (Math.abs(value - baseline) < (maxHours * 0.05)) {
              return sortedSports[i];
            }
          }
          return '';
        }
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.05)',
          type: 'dashed'
        }
      }
    },
    series: series
  };

  window.ridgelineChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.ridgelineChart) {
      window.ridgelineChart.resize();
    }
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
    const totalHours = distributions[athlete].length * 0.25;
    athleteVolumes[athlete] = totalHours;
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

  const GAP_FACTOR = 0.1;

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
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: getAthleteColor(athleteId) + 'AA' },
            { offset: 1, color: getAthleteColor(athleteId) + '40' }
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
      text: `Répartition horaire par athlète${selectedSport ? ' (' + selectedSport + ')' : ''}`,
      textStyle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: "'Times New Roman', serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: { color: '#FFFFFF' },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.5)',
          width: 1
        }
      },
      formatter: function(params) {
        const hour = params[0].axisValue;
        const hourInt = Math.floor(hour);
        const minutes = Math.round((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const endMinutes = (minutes + 15) % 60;
        const endHour = minutes + 15 >= 60 ? (hourInt + 1) % 24 : hourInt;
        const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        let result = `<b>${timeStr} - ${endTimeStr}</b><br/>`;

        const dataIndex = params[0].dataIndex;
        let totalHours = 0;

        params.forEach(param => {
          const athleteName = param.seriesName;
          const hours = rawDataByAthlete[athleteName][dataIndex];
          totalHours += hours;

          if (hours > 0) {
            const hoursInt = Math.floor(hours);
            const minutesInt = Math.round((hours - hoursInt) * 60);
            const timeDisplay = hoursInt > 0
              ? `${hoursInt}h${minutesInt.toString().padStart(2, '0')}`
              : `${minutesInt}min`;
            result += `${param.marker}${athleteName}: ${timeDisplay}<br/>`;
          }
        });

        if (totalHours > 0) {
          const totalHoursInt = Math.floor(totalHours);
          const totalMinutesInt = Math.round((totalHours - totalHoursInt) * 60);
          const totalDisplay = totalHoursInt > 0
            ? `${totalHoursInt}h${totalMinutesInt.toString().padStart(2, '0')}`
            : `${totalMinutesInt}min`;
          result += `<br/><b>Total: ${totalDisplay}</b>`;
        }

        return result;
      }
    },
    legend: {
      data: sortedAthletes,
      textStyle: {
        color: '#FFFFFF',
        fontSize: 12
      },
      top: 40,
      left: 'center',
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '12%',
      top: sortedAthletes.length > 5 ? 100 : 80,
      bottom: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      boundaryGap: false,
      axisLabel: {
        color: '#FFFFFF',
        fontSize: 11,
        formatter: function(value) {
          const hour = Math.floor(value);
          if (value % 1 === 0) {
            return hour + 'h';
          }
          return '';
        }
      },
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }
      },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(255, 255, 255, 0.08)' }
      }
    },
    yAxis: {
      type: 'value',
      show: true,
      position: 'right',
      min: 0,
      max: maxHours + (sortedAthletes.length - 1) * (maxHours * 0.25),
      axisLabel: {
        color: '#FFFFFF',
        fontSize: 11,
        formatter: function(value) {
          for (let i = 0; i < sortedAthletes.length; i++) {
            const baseline = i * (maxHours * 0.25);
            if (Math.abs(value - baseline) < (maxHours * 0.05)) {
              return sortedAthletes[i];
            }
          }
          return '';
        }
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.05)',
          type: 'dashed'
        }
      }
    },
    series: series
  };

  window.ridgelineChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.ridgelineChart) {
      window.ridgelineChart.resize();
    }
  });
}
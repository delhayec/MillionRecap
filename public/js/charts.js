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

// ==============================
// PLUGIN TOOLTIP PERSONNALISÉ AVEC LIGNE VERTICALE
// ==============================
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
          grid: {
            color: 'rgba(255, 255, 255, 0.08)'
          },
          ticks: {
            color: '#FFFFFF'
          }
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
          ticks: {
            color: '#FFFFFF'
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
          grid: {
            color: 'rgba(255, 255, 255, 0.08)'
          },
          ticks: {
            color: '#FFFFFF'
          }
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
          ticks: {
            color: '#FFFFFF'
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
          grid: {
            color: 'rgba(255, 255, 255, 0.08)'
          },
          ticks: {
            color: '#FFFFFF'
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
  if (map) return;

  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error("L'élément de la carte n'existe pas dans le DOM.");
    return;
  }

  map = L.map('map').setView([46.2276, 2.2137], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }).addTo(map);
}

function generateLegend(activities, colorMode = 'athlete') {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) {
    console.error("Le conteneur de légende n'existe pas dans le DOM.");
    return;
  }

  legendContainer.innerHTML = '<h3 style="color: #fff; margin-top: 0;">Légende</h3>';

  if (colorMode === 'sport') {
    const sports = [...new Set(activities.map(activity => mapSportName(activity.sport)))];

    sports.forEach(sport => {
      const color = getSportColor(sport);
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = color;

      const text = document.createElement('div');
      text.className = 'legend-text';
      text.textContent = sport;

      legendItem.appendChild(colorBox);
      legendItem.appendChild(text);
      legendContainer.appendChild(legendItem);
    });
  } else {
    const uniqueAthletes = [...new Set(activities.map(activity => activity.athlete_id))];

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
}

export function showMapChart(filteredData, selectedAthleteId = null) {
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

  const colorMode = selectedAthleteId ? 'sport' : 'athlete';
  generateLegend(activitiesWithPolylines, colorMode);

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
      polyline.bindPopup(`
        <b>${activity.name || 'Activité'}</b><br>
        Athlète: ${activity.athlete_id}<br>
        Sport: ${mappedSport}
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
  if (!chartDom) {
    console.error("L'élément sankeyChart n'existe pas");
    return;
  }

  // Détruire l'instance précédente si elle existe
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

    // Total par athlète
    athleteTotalElevation[athleteId] = (athleteTotalElevation[athleteId] || 0) + elevation;

    // Total par sport
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
      textStyle: {
        color: '#FFFFFF'
      },
      confine: true,
      position: function(point, params, dom, rect, size) {
        // Stocker la position pour l'utiliser dans le formatter
        window.lastTooltipX = point[0];
        return [point[0] + 10, point[1] - 10];
      },
      formatter: function(params) {
        if (params.dataType === 'edge') {
          const value = params.value;
          const data = params.data;

          // Utiliser la position stockée ou essayer plusieurs méthodes
          let mouseX = window.lastTooltipX ||
                       params.event?.offsetX ||
                       params.event?.event?.offsetX ||
                       params.event?.event?.clientX || 0;

          const chartDom = document.getElementById('sankeyChart');
          const chartRect = chartDom.getBoundingClientRect();
          const chartWidth = chartRect.width;
          const chartCenterX = chartWidth / 2;

          // Si on utilise clientX, il faut soustraire la position du graphique
          if (params.event?.event?.clientX) {
            mouseX = params.event.event.clientX - chartRect.left;
          }

          const isLeftSide = mouseX < chartCenterX;

          // Debug
          console.log('MouseX:', mouseX, 'ChartCenterX:', chartCenterX, 'IsLeftSide:', isLeftSide);

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
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            opacity: 0.8
          }
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
      }
    ]
  };

  window.sankeyChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.sankeyChart) {
      window.sankeyChart.resize();
    }
  });
}
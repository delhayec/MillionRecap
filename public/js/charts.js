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
      enabled: false // Désactivé car on utilise des tooltips personnalisés
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
  const TARGET = 1000000; // Objectif 1 million de mètres

  const filteredData = selectedSport
    ? data.filter(item => item.sport === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];

  // Calcul du dénivelé par jour et par athlète + stockage des sports
  const athleteDailyData = {};
  const dailySports = {}; // Stocke les sports par jour et athlète

  athletes.forEach(athlete => {
    athleteDailyData[athlete] = allDays.map((day, index) => {
      const dayActivities = filteredData.filter(item =>
        item.athlete_id === athlete && item.date.startsWith(day)
      );

      // Stocker les sports pratiqués ce jour-là (mappés)
      if (!dailySports[index]) dailySports[index] = {};
      const mappedSports = [...new Set(dayActivities.map(act => mapSportName(act.sport)))].join(', ');
      dailySports[index][athlete] = mappedSports || 'Aucun';

      return dayActivities.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0);
    });
  });

  // Calcul du dénivelé total par jour (somme de tous les athlètes)
  const totalDailyElevation = allDays.map((day, index) => {
    return athletes.reduce((sum, athlete) => sum + athleteDailyData[athlete][index], 0);
  });

  // Calcul du dénivelé cumulé total
  let cumulative = 0;
  const cumulativeElevation = totalDailyElevation.map(value => {
    cumulative += value;
    return cumulative;
  });

  // Ligne d'objectif
  const targetLine = allDays.map((day, index) => {
    return (TARGET / 365) * (index + 1);
  });

  // Datasets pour le bar plot empilé
  const barDatasets = athletes.map(athlete => ({
    type: 'bar',
    label: `Athlète ${athlete}`,
    data: athleteDailyData[athlete],
    backgroundColor: getAthleteColor(athlete),
    stack: 'stack0',
    yAxisID: 'y'
  }));

  // Dataset pour la ligne cumulée
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

  // Dataset pour l'objectif
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

  // Calcul du dénivelé par jour avec les sports
  const dailyElevation = [];
  const dailySportColors = [];
  const dailySportNames = [];

  allDays.forEach(day => {
    const dayActivities = filteredData.filter(item => item.date.startsWith(day));
    const totalElevation = dayActivities.reduce((sum, act) => sum + (act.elevation_gain_m || 0), 0);
    dailyElevation.push(totalElevation);

    // Déterminer le sport principal du jour (celui avec le plus de dénivelé)
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

      // Liste des sports mappés
      const mappedSports = [...new Set(dayActivities.map(act => mapSportName(act.sport)))].join(', ');
      dailySportNames.push(mappedSports);
    } else {
      dailySportColors.push(getAthleteColor(athleteId));
      dailySportNames.push('Aucun');
    }
  });

  // Calcul du dénivelé cumulé
  let cumulative = 0;
  const cumulativeElevation = dailyElevation.map(value => {
    cumulative += value;
    return cumulative;
  });

  // Objectif = dénivelé total de l'athlète
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
          backgroundColor: dailySportColors, // Couleur par sport
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
          label: `Objectif ${totalElevation.toFixed(0)} m`,
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

  // Calcul des données cumulées par athlète
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

  // Création des datasets
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

  // Fonction pour calculer le classement à un jour donné
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

export function showMapChart(filteredData) {
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
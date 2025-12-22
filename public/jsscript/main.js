// Variables globales
let allData = [];
let deniveleChart = null;
const athleteColors = {};  // Mapping des couleurs par athlète

// Palette de couleurs
const modernColors = [
  '#938bb7',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#00619a'
];

// 1. Charger les données
async function loadData() {
  const response = await fetch('data/activities_2025.json');
  const data = await response.json();
  console.log("Données chargées :", data);
  return data;
}

// 2. Obtenir une couleur persistante par athlète
function getAthleteColor(athleteId) {
  if (!athleteColors[athleteId]) {
    athleteColors[athleteId] = modernColors[Object.keys(athleteColors).length % modernColors.length];
  }
  return athleteColors[athleteId];
}

// 3. Générer tous les jours de l'année
function generateAllDays(year) {
  const allDays = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDays.push(new Date(d).toISOString().split('T')[0]);
  }
  return allDays;
}

// 4. Remplir les menus déroulants
function fillAthleteSelect(data) {
  const athleteSelect = document.getElementById('athleteSelect');
  // Ajoute l'option "Classement"
  const optionClassement = document.createElement('option');
  optionClassement.value = "classement";
  optionClassement.textContent = "Classement";
  athleteSelect.appendChild(optionClassement);

  // Ajoute les athlètes uniques
  const athletes = [...new Set(data.map(item => item.athlete_id))];
  athletes.forEach(athlete => {
    const option = document.createElement('option');
    option.value = athlete;
    option.textContent = `Athlète ${athlete}`;
    athleteSelect.appendChild(option);
  });

  // Remplir le menu des sports
  const sportSelect = document.getElementById('sportSelect');
  const sports = [...new Set(data.map(item => item.sport))];
  sports.forEach(sport => {
    const option = document.createElement('option');
    option.value = sport;
    option.textContent = sport;
    sportSelect.appendChild(option);
  });

  // Écouteurs d'événements
  athleteSelect.addEventListener('change', updateChart);
  sportSelect.addEventListener('change', updateChart);
}

// 5. Filtrer les données selon les sélections
function getFilteredData() {
  const athleteSelect = document.getElementById('athleteSelect');
  const sportSelect = document.getElementById('sportSelect');
  const selectedAthlete = athleteSelect.value;
  const selectedSport = sportSelect.value;

  if (!selectedAthlete || selectedAthlete === "") {
    return allData.filter(item => !selectedSport || item.sport === selectedSport);
  } else {
    return allData.filter(item =>
      item.athlete_id == selectedAthlete &&
      (!selectedSport || item.sport === selectedSport)
    );
  }
}

// 6. Options de style modernes (réutilisables)
const modernChartOptions = {
  responsive: true,
  plugins: {
    title: {
      display: true,
      color: '#FFFFFF',
      font: {
        size: 16,
        weight: 'bold',
        family: 'Times New Roman',
      }
    },
    legend: {
      labels: {
        color: '#FFFFFF',
        font: {
          size: 12
        },
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      padding: 12,
      bodyFont: {
        size: 12
      },
      titleFont: {
        size: 14,
        weight: 'bold'
      },
      displayColors: false,
      boxPadding: 4
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.08)',
        tickColor: 'rgba(255, 255, 255, 0.2)'
      },
      ticks: {
        color: '#FFFFFF',
        font: {
          size: 10
        }
      }
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.08)'
      },
      ticks: {
        color: '#FFFFFF',
        font: {
          size: 10
        }
      },
      title: {
        display: true,
        color: '#FFFFFF',
        font: {
          size: 12,
          weight: 'bold'
        }
      }
    },
    y1: {
      grid: {
        color: 'rgba(255, 255, 255, 0.08)',
        drawOnChartArea: false
      },
      ticks: {
        color: '#FFFFFF',
        font: {
          size: 10
        }
      },
      title: {
        display: true,
        color: '#FFFFFF',
        font: {
          size: 12,
          weight: 'bold'
        }
      }
    }
  }
};

// Fonction pour calculer et afficher les statistiques globales
function updateStats(filteredData) {
  // Calculer les statistiques
  const totalElevation = filteredData.reduce((sum, activity) => sum + (activity.elevation_gain_m || 0), 0);
  const totalActivities = filteredData.length;
  const totalDistance = (filteredData.reduce((sum, activity) => sum + (activity.distance_m || 0), 0) / 1000).toFixed(2); // Convertir en km
  const totalTime = Math.round(filteredData.reduce((sum, activity) => sum + (activity.moving_time_s || 0), 0) / 3600); // Convertir en heures

  // Mettre à jour le DOM
  document.getElementById('totalElevation').textContent = `${totalElevation} m`;
  document.getElementById('totalActivities').textContent = totalActivities;
  document.getElementById('totalDistance').textContent = `${totalDistance} km`;
  document.getElementById('totalTime').textContent = `${totalTime} h`;
}

// Fonction pour calculer le meilleur jour et la meilleure semaine
function updateBestPeriods(filteredData) {
  if (filteredData.length === 0) {
    document.getElementById('bestDay').textContent = 'N/A';
    document.getElementById('bestWeek').textContent = 'N/A';
    return;
  }

  const year = new Date(filteredData[0].date).getFullYear();
  const allDays = generateAllDays(year);

  // Grouper par jour
  const dailyTotals = allDays.map(day => {
    const dayActivities = filteredData.filter(item => item.date.startsWith(day));
    const total = dayActivities.reduce((sum, activity) => sum + activity.elevation_gain_m, 0);
    return { day, total };
  });

  // Trouver le meilleur jour
  const bestDay = dailyTotals.reduce((best, current) =>
    current.total > best.total ? current : best
  );

  // Calculer les totaux par semaine
  const weeklyTotals = [];
  for (let i = 0; i < dailyTotals.length; i += 7) {
    const weekDays = dailyTotals.slice(i, i + 7);
    const weekTotal = weekDays.reduce((sum, day) => sum + day.total, 0);
    const startDay = weekDays[0].day;
    const endDay = weekDays[weekDays.length - 1].day;
    weeklyTotals.push({ startDay, endDay, total: weekTotal });
  }

  // Trouver la meilleure semaine
  const bestWeek = weeklyTotals.reduce((best, current) =>
    current.total > best.total ? current : best
  );

  // Formater les dates
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  // Afficher les résultats
  document.getElementById('bestDay').textContent =
    `${formatDate(bestDay.day)} : ${bestDay.total} m`;

  document.getElementById('bestWeek').textContent =
    `${formatDate(bestWeek.startDay)} - ${formatDate(bestWeek.endDay)} : ${bestWeek.total} m`;
}


// 7. Fonction unifiée pour afficher les graphiques
function showChart(filteredData, selectedSport, isRanking = false) {
  const year = filteredData.length > 0 ? new Date(filteredData[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  updateStats(filteredData);
  updateBestPeriods(filteredData);

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];
  let datasets = [];
  let chartType = 'bar';
  let scalesConfig = {};

  if (isRanking) {
    // Mode classement : courbes cumulées par athlète
    datasets = athletes.map(athlete => {
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

      return {
        type: 'line',
        label: `Athlète ${athlete}`,
        data: cumulativeElevations,
        borderColor: getAthleteColor(athlete),
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderWidth: 3,
        yAxisID: 'y',
        fill: false,
        pointRadius: 0,
        tension: 0.3
      };
    });

    chartType = 'line';
    scalesConfig = {
      x: modernChartOptions.scales.x,
      y: {
        ...modernChartOptions.scales.y,
        title: {
          ...modernChartOptions.scales.y.title,
          text: 'Dénivelé cumulé (m)'
        }
      }
    };
  } else {
    // Mode combiné : barres empilées + courbe cumulée
    const dailyData = allDays.map(day => {
      const dayActivities = filteredData.filter(item => item.date.startsWith(day));
      return { day, activities: dayActivities };
    });

    const barDatasets = athletes.map(athlete => ({
      label: `Athlète ${athlete}`,
      data: dailyData.map(dayData => {
        const athleteActivity = dayData.activities.find(item => item.athlete_id === athlete);
        return athleteActivity ? athleteActivity.elevation_gain_m : 0;
      }),
      backgroundColor: getAthleteColor(athlete),
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
      yAxisID: 'y'
    }));

    const cumulativeElevations = [];
    let cumulativeElevation = 0;
    dailyData.forEach(dayData => {
      const dayTotal = dayData.activities.reduce((sum, activity) => sum + activity.elevation_gain_m, 0);
      cumulativeElevation += dayTotal;
      cumulativeElevations.push(cumulativeElevation);
    });

    datasets = [
      {
        type: 'line',
        label: 'Dénivelé cumulé (m)',
        data: cumulativeElevations,
        borderColor: '#FF6384',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderWidth: 3,
        yAxisID: 'y1',
        fill: false,
        pointBackgroundColor: 'rgba(0, 0, 0, 0)',
        pointBorderColor: 'rgba(0, 0, 0, 0)',
        pointHoverRadius: 5,
        pointHitRadius: 10,
        tension: 0.3
      },
      ...barDatasets
    ];

    chartType = 'bar';
    scalesConfig = {
      x: {
        ...modernChartOptions.scales.x,
        stacked: true
      },
      y: {
        ...modernChartOptions.scales.y,
        stacked: true,
        position: 'left',
        title: {
          ...modernChartOptions.scales.y.title,
          text: 'Dénivelé quotidien (m)'
        }
      },
      y1: {
        ...modernChartOptions.scales.y1,
        position: 'right',
        title: {
          ...modernChartOptions.scales.y1.title,
          text: 'Dénivelé cumulé (m)'
        }
      }
    };
  }

  // Créer le graphique
  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (deniveleChart) deniveleChart.destroy();

  const titleText = isRanking
    ? `Classement ${year} (Sport: ${selectedSport || 'Tous'})`
    : `Dénivelé ${year} (filtres: Tous, ${selectedSport || 'Tous'})`;

  const options = {
    ...modernChartOptions,
    plugins: {
      ...modernChartOptions.plugins,
      title: {
        ...modernChartOptions.plugins.title,
        text: titleText
      }
    },
    scales: scalesConfig
  };

  deniveleChart = new Chart(ctx, {
    type: chartType,
    data: { labels: allDays, datasets },
    options: options
  });
}

// 8. Mettre à jour le graphique
function updateChart() {
  const athleteSelect = document.getElementById('athleteSelect');
  const sportSelect = document.getElementById('sportSelect');
  const selectedAthlete = athleteSelect.value;
  const selectedSport = sportSelect.value;

  if (selectedAthlete === "classement") {
    const filteredData = selectedSport
      ? allData.filter(item => item.sport === selectedSport)
      : allData;
    showChart(filteredData, selectedSport, true);
  } else {
    const filteredData = getFilteredData();
    showChart(filteredData, selectedSport, false);
  }
}

// 9. Fonction principale
async function main() {
  allData = await loadData();
  fillAthleteSelect(allData);
  updateChart();
}

main();
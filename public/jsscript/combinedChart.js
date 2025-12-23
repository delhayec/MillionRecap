// combinedChart.js
import { getAthleteColor, generateAllDays } from './chartUtils.js';

function showCombinedChart(filteredData, selectedSport, chartOptions) {
  if (!filteredData || filteredData.length === 0) {
    console.warn("Aucune donnée à afficher pour le graphique combiné.");
    return;
  }

  const year = new Date(filteredData[0].date).getFullYear();
  const allDays = generateAllDays(year);

  // Grouper les données par jour et par athlète
  const dailyData = allDays.map(day => {
    const dayActivities = filteredData.filter(item => item.date.startsWith(day));
    return { day, activities: dayActivities };
  });

  // Extraire la liste des athlètes uniques
  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];

  // Préparer les datasets pour le stacked barplot
  const barDatasets = athletes.map(athlete => ({
    label: `Athlète ${athlete}`,
    data: dailyData.map(dayData => {
      const athleteActivity = dayData.activities.find(item => item.athlete_id === athlete);
      return athleteActivity ? athleteActivity.elevation_gain_m || 0 : 0;
    }),
    backgroundColor: getAthleteColor(athlete),
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: 4,
    borderSkipped: false,
    yAxisID: 'y'
  }));

  // Calculer le dénivelé cumulé
  const cumulativeElevations = [];
  let cumulativeElevation = 0;
  dailyData.forEach(dayData => {
    const dayTotal = dayData.activities.reduce((sum, activity) => sum + (activity.elevation_gain_m || 0), 0);
    cumulativeElevation += dayTotal;
    cumulativeElevations.push(cumulativeElevation);
  });

  // Ajouter une droite linéaire de 0 à 1 000 000
  const linearTarget = [];
  const totalDays = allDays.length;
  for (let i = 0; i < totalDays; i++) {
    // Droite linéaire de 0 à 1 000 000
    linearTarget.push((1000000 / totalDays) * i);
  }

  // Créer le graphique
  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  // Options spécifiques pour ce graphique
  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: `Dénivelé ${year} (filtres: ${document.getElementById('athleteSelect').value || 'Tous'}, ${selectedSport || 'Tous'})`
      },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            const dataset = context.dataset;
            const dayIndex = context.dataIndex;

            // Pour la droite linéaire
            if (dataset.label === 'Objectif 1M') {
              const currentValue = cumulativeElevations[dayIndex];
              const targetValue = linearTarget[dayIndex];
              const diff = targetValue - currentValue;
              return [
                `Objectif: ${targetValue.toFixed(0)} m`,
                `Écart: ${diff.toFixed(0)} m ${diff >= 0 ? '↓' : '↑'}`
              ];
            }

            // Pour les autres datasets
            return `${dataset.label}: ${context.parsed.y.toFixed(0)} m`;
          }
        }
      }
    },
    scales: {
      x: {
        ...chartOptions.scales.x,
        stacked: true
      },
      y: {
        ...chartOptions.scales.y,
        stacked: true,
        position: 'left',
        id: 'y'
      },
      y1: {
        ...chartOptions.scales.y1,
        position: 'right',
        id: 'y1'
      }
    }
  };

  window.deniveleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDays,
      datasets: [
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
        {
          type: 'line',
          label: 'Objectif 1M',
          data: linearTarget,
          borderColor: '#fefedf',
          backgroundColor: '#f3f3cc',
          borderWidth: 2,
          borderDash: [5, 5], // Ligne pointillée
          yAxisID: 'y1',
          fill: false,
          pointRadius: 0
        },
        ...barDatasets
      ]
    },
    options: options
  });
}

export { showCombinedChart };

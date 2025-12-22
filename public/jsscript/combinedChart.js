import { getAthleteColor, generateAllDays } from './chartUtils.js';
import { updateStats } from './statsDisplay.js';

// Afficher le graphique combiné (stacked barplot + courbe cumulée)
function showCombinedChart(filteredData, selectedSport, chartOptions) {
  const year = filteredData.length > 0 ? new Date(filteredData[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  const dailyData = allDays.map(day => {
    const dayActivities = filteredData.filter(item => item.date.startsWith(day));
    return { day, activities: dayActivities };
  });

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];

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

  updateStats(filteredData);

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: `Dénivelé ${year} (filtres: Tous, ${selectedSport || 'Tous'})`
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
        ...barDatasets
      ]
    },
    options: options
  });
}

export { showCombinedChart };

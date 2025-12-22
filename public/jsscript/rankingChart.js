import { getAthleteColor, generateAllDays } from './chartUtils.js';
import { updateStats } from './statsDisplay.js';

// Afficher le classement (courbes cumulées par athlète)
function showRankingChart(data, selectedSport, chartOptions) {
  const year = data.length > 0 ? new Date(data[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  const filteredData = selectedSport
    ? data.filter(item => item.sport === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];
  const datasets = athletes.map(athlete => {
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
      yAxisID: 'y1',
      fill: false,
      pointRadius: 0,
      tension: 0.3
    };
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
        text: `Classement ${year} (Sport: ${selectedSport || 'Tous'})`
      }
    },
    scales: {
      y1: {
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
  };

  window.deniveleChart = new Chart(ctx, {
    type: 'line',
    data: { labels: allDays, datasets },
    options: options
  });
}

export { showRankingChart };

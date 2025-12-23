// rankingChart.js
import { getAthleteColor, generateAllDays } from './chartUtils.js';
import { updateStats } from './statsDisplay.js';

// Fonction pour obtenir le suffixe ordinal (1er, 2e, etc.)
function getOrdinalSuffix(num) {
  if (num === 1) return 'er';
  return 'e';
}

// Afficher le classement (courbes cumulées par athlète)
function showRankingChart(data, selectedSport, chartOptions) {
  const year = data.length > 0 ? new Date(data[0].date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  const filteredData = selectedSport
    ? data.filter(item => item.sport === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];

  // Calcule les données cumulées par athlète
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

  // Crée les datasets
  const datasets = athletes.map(athlete => ({
    type: 'line',
    label: `Athlète ${athlete}`,
    data: athleteDataMap[athlete],
    borderColor: getAthleteColor(athlete),
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidth: 3,
    yAxisID: 'y1',
    fill: false,
    pointRadius: 0,
    tension: 0.3
  }));

  updateStats(filteredData);

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  // Fonction pour calculer le classement à un jour donné
  const getRankingForDay = (dayIndex) => {
    const dayRanking = athletes.map(athlete => ({
      athleteId: athlete,
      elevation: athleteDataMap[athlete][dayIndex]
    }));

    // Trie par dénivelé cumulé (descendant)
    dayRanking.sort((a, b) => b.elevation - a.elevation);

    // Crée un mapping athlète -> classement
    const rankingMap = {};
    dayRanking.forEach((entry, index) => {
      rankingMap[entry.athleteId] = index + 1; // 1 = premier
    });

    return rankingMap;
  };

  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: `Classement ${year} (Sport: ${selectedSport || 'Tous'})`
      },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            const dataset = context.dataset;
            const dayIndex = context.dataIndex;
            const athleteId = parseInt(dataset.label.replace('Athlète ', ''));
            const ranking = getRankingForDay(dayIndex)[athleteId];

            return [
              `${dataset.label}: ${context.parsed.y.toFixed(0)} m`,
              `Classement: ${ranking}${getOrdinalSuffix(ranking)}`
            ];
          }
        }
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

import { loadData } from './dataLoader.js';
import { fillAthleteSelect } from './dropdowns.js';
import { showCombinedChart } from './combinedChart.js';
import { showRankingChart } from './rankingChart.js';
import { updateStats } from './statsDisplay.js';

// Options de style réutilisables
const chartOptions = {
  responsive: true,
  plugins: {
    title: {
      display: true,
      color: '#FFFFFF',
      font: {
        size: 16,
        weight: 'bold',
        family: "'Times New Roman', serif"
      }
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
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      padding: 12,
      bodyFont: { size: 12 },
      titleFont: { size: 14, weight: 'bold' },
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
        font: { size: 10 }
      }
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.08)' },
      ticks: {
        color: '#FFFFFF',
        font: { size: 10 }
      },
      title: {
        display: true,
        color: '#FFFFFF',
        font: { size: 12, weight: 'bold' }
      }
    },
    y1: {
      grid: {
        color: 'rgba(255, 255, 255, 0.08)',
        drawOnChartArea: false
      },
      ticks: {
        color: '#FFFFFF',
        font: { size: 10 }
      },
      title: {
        display: true,
        color: '#FFFFFF',
        font: { size: 12, weight: 'bold' }
      }
    }
  }
};

// Filtrer les données selon les sélections
function getFilteredData() {
  const athleteSelect = document.getElementById('athleteSelect');
  const sportSelect = document.getElementById('sportSelect');
  const selectedAthlete = athleteSelect.value;
  const selectedSport = sportSelect.value;

  if (!selectedAthlete || selectedAthlete === "") {
    return window.allData.filter(item => !selectedSport || item.sport === selectedSport);
  } else {
    return window.allData.filter(item =>
      item.athlete_id == selectedAthlete &&
      (!selectedSport || item.sport === selectedSport)
    );
  }
}

// Mettre à jour le graphique
function updateChart() {
  const athleteSelect = document.getElementById('athleteSelect');
  const selectedAthlete = athleteSelect.value;
  const selectedSport = document.getElementById('sportSelect').value;

  if (selectedAthlete === "classement") {
    showRankingChart(window.allData, selectedSport, chartOptions);
  } else {
    const filteredData = getFilteredData();
    showCombinedChart(filteredData, selectedSport, chartOptions);
  }
}

// Écouter les événements personnalisés
document.addEventListener('athleteChanged', updateChart);
document.addEventListener('sportChanged', updateChart);

// Fonction principale
async function main() {
  window.allData = await loadData();
  fillAthleteSelect(window.allData);
  updateChart();
}

main();

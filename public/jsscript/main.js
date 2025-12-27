// main.js
import { loadData } from './dataLoader.js';
import { fillAthleteSelect } from './dropdowns.js';
import { showCombinedChart } from './combinedChart.js';
import { showRankingChart } from './rankingChart.js';
import { showMapChart, initMap } from './mapChart.js';
import { updateStats } from './statsDisplay.js';
import { showRankingTable } from './rankingTable.js';

// Variables globales
let allData = [];
let deniveleChart = null;

// Palette de couleurs personnalisée
const customColors = [
  '#8F87C6', // violet doux
  '#796cef', // violet
  '#9A5FE0', // violet-magenta
  '#D9468F', // rose
  '#E84C5B', // rouge-rose
  '#F08C2E', // orange
  '#D9A317', // jaune
  '#8FBF2F', // vert-jaune
  '#3FB86B', // vert
  '#2FB3A3', // vert-cyan
  '#2BB0D9', // cyan
  '#4A86E8', // bleu
  '#003c75'  // bleu profond
];

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
      grid: { color: 'rgba(255, 255, 255, 0.08)' },
      ticks: { color: '#FFFFFF', font: { size: 10 } }
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.08)' },
      ticks: { color: '#FFFFFF', font: { size: 10 } },
      title: { display: true, color: '#FFFFFF', font: { size: 12, weight: 'bold' } }
    },
    y1: {
      grid: { color: 'rgba(255, 255, 255, 0.08)', drawOnChartArea: false },
      ticks: { color: '#FFFFFF', font: { size: 10 } },
      title: { display: true, color: '#FFFFFF', font: { size: 12, weight: 'bold' } }
    }
  }
};

// Filtrer les données selon les sélections
function getFilteredData() {
  const athleteSelect = document.getElementById('athleteSelect');
  const sportSelect = document.getElementById('sportSelect');
  const selectedAthlete = athleteSelect.value;
  const selectedSport = sportSelect.value;

  if (!allData || allData.length === 0) return [];

  if (!selectedAthlete || selectedAthlete === "") {
    return allData.filter(item => !selectedSport || item.sport === selectedSport);
  } else if (selectedAthlete === "classement") {
    return allData.filter(item => !selectedSport || item.sport === selectedSport);
  } else {
    return allData.filter(item =>
      item.athlete_id == selectedAthlete && (!selectedSport || item.sport === selectedSport)
    );
  }
}

// Mettre à jour tous les graphiques et la carte
function updateChart() {
  const filteredData = getFilteredData() || [];
  const athleteSelect = document.getElementById('athleteSelect');
  const selectedAthlete = athleteSelect.value;
  const selectedSport = document.getElementById('sportSelect').value;

  if (!allData || allData.length === 0) {
    console.warn("Les données ne sont pas encore chargées.");
    return;
  }

  if (selectedAthlete === "classement") {
    showRankingChart(allData, selectedSport, chartOptions, customColors);
    showRankingTable(filteredData);
  } else {
    showCombinedChart(filteredData, selectedSport, chartOptions, customColors);
    showMapChart(filteredData, customColors);
  }

  updateStats(filteredData);
}

// Fonction pour activer le plein écran
function launchFullscreen(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
  document.getElementById('closeFullscreen').style.display = 'block';
}

// Fonction pour quitter le plein écran
function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
  document.getElementById('closeFullscreen').style.display = 'none';
}

// Gestion du plein écran pour le graphique combiné
function setupFullscreenForChart() {
  const chartCanvas = document.getElementById('elevationChart');
  const closeFullscreenBtn = document.getElementById('closeFullscreen');

  if (chartCanvas) {
    chartCanvas.addEventListener('dblclick', () => {
      launchFullscreen(chartCanvas);
    });
  }

  if (closeFullscreenBtn) {
    closeFullscreenBtn.addEventListener('click', exitFullscreen);
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      closeFullscreenBtn.style.display = 'none';
    }
  });
}

function validateDataStructure(data) {
  data.forEach(activity => {
    if (!activity.tracemap) {
      console.warn(`L'activité ${activity.activity_id} n'a pas de champ tracemap.`);
    } else if (!activity.tracemap.polyline) {
      console.warn(`L'activité ${activity.activity_id} n'a pas de polyline dans tracemap.`);
    } else if (typeof activity.tracemap.polyline !== 'string') {
      console.warn(`La polyline de l'activité ${activity.activity_id} n'est pas une chaîne de caractères.`);
    }
  });
}

// Fonction principale
async function main() {
  try {
    allData = await loadData();
    console.log("Données chargées:", allData);

    if (!allData || !Array.isArray(allData) || allData.length === 0) {
      console.error("Données invalides ou vides.");
      return;
    }

    validateDataStructure(allData);
    fillAthleteSelect(allData);

    document.getElementById('athleteSelect').addEventListener('change', updateChart);
    document.getElementById('sportSelect').addEventListener('change', updateChart);

    initMap();
    updateChart();
    setupFullscreenForChart(); // Initialise la gestion du plein écran
  } catch (error) {
    console.error("Erreur:", error);
  }
}

main();

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
  '#8F87C6', '#796cef', '#9A5FE0', '#D9468F', '#E84C5B',
  '#F08C2E', '#D9A317', '#8FBF2F', '#3FB86B', '#2FB3A3',
  '#2BB0D9', '#4A86E8', '#003c75'
];

// Options de style réutilisables
const chartOptions = {
  responsive: true,
  plugins: {
    title: { display: true, color: '#FFFFFF', font: { size: 16, weight: 'bold', family: "'Times New Roman', serif" } },
    legend: { labels: { color: '#FFFFFF', font: { size: 12 }, usePointStyle: true, pointStyle: 'circle' } },
    tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.9)', titleColor: '#FFFFFF', bodyColor: '#FFFFFF', padding: 12, bodyFont: { size: 12 }, titleFont: { size: 14, weight: 'bold' }, displayColors: false, boxPadding: 4 }
  },
  scales: {
    x: { grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { color: '#FFFFFF', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { color: '#FFFFFF', font: { size: 10 } }, title: { display: true, color: '#FFFFFF', font: { size: 12, weight: 'bold' } } },
    y1: { grid: { color: 'rgba(255, 255, 255, 0.08)', drawOnChartArea: false }, ticks: { color: '#FFFFFF', font: { size: 10 } }, title: { display: true, color: '#FFFFFF', font: { size: 12, weight: 'bold' } } }
  }
};

// Fonctions existantes (getFilteredData, updateChart, etc.)
// ...

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

// Fonction pour gérer le double-clic sur le graphique
function setupFullscreenForChart() {
  const chartCanvas = document.getElementById('elevationChart');
  const closeFullscreenBtn = document.getElementById('closeFullscreen');

  if (!chartCanvas || !closeFullscreenBtn) {
    console.error("Le canvas ou le bouton de fermeture n'existe pas.");
    return;
  }

  chartCanvas.addEventListener('dblclick', () => {
    launchFullscreen(chartCanvas);
    // Rotation à 90° uniquement sur mobile
    if (window.innerWidth <= 768) {
      chartCanvas.style.transform = 'rotate(90deg)';
      chartCanvas.style.transformOrigin = 'center';
      chartCanvas.style.width = '100vh';
      chartCanvas.style.height = '100vw';
      chartCanvas.style.marginTop = 'calc(100vh - 100vw)';
    }
  });

  closeFullscreenBtn.addEventListener('click', () => {
    exitFullscreen();
    // Réinitialiser la rotation sur mobile
    if (window.innerWidth <= 768) {
      chartCanvas.style.transform = 'none';
      chartCanvas.style.width = '';
      chartCanvas.style.height = '';
      chartCanvas.style.marginTop = '';
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      closeFullscreenBtn.style.display = 'none';
      // Réinitialiser la rotation sur mobile
      if (window.innerWidth <= 768) {
        chartCanvas.style.transform = 'none';
        chartCanvas.style.width = '';
        chartCanvas.style.height = '';
        chartCanvas.style.marginTop = '';
      }
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

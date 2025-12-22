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
  '#938bb7', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
  '#F59E0B', '#EAB308', '#84CC16', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#00619a'
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
    showMapChart(filteredData, customColors); // Passe customColors à showMapChart
  }

  updateStats(filteredData);
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

    validateDataStructure(allData); // Vérifie la structure des données
    fillAthleteSelect(allData);

    document.getElementById('athleteSelect').addEventListener('change', updateChart);
    document.getElementById('sportSelect').addEventListener('change', updateChart);

    initMap();
    updateChart();
  } catch (error) {
    console.error("Erreur:", error);
  }
}

main();

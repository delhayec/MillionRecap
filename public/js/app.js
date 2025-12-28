import { loadData, updateStats } from './utils.js';
import { showRankingChart, showIndividualChart, showMapChart, showRankingTable, showAllAthletesChart, initMap } from './charts.js';

// ==============================
// VARIABLES GLOBALES
// ==============================
let allData = [];

// ==============================
// REMPLISSAGE DES DROPDOWNS
// ==============================
function fillDropdowns(data) {
  const athleteSelect = document.getElementById('athleteSelect');
  const optionClassement = document.createElement('option');
  optionClassement.value = "classement";
  optionClassement.textContent = "Classement";
  athleteSelect.appendChild(optionClassement);

  const athletes = [...new Set(data.map(item => item.athlete_id))];
  athletes.forEach(athlete => {
    const option = document.createElement('option');
    option.value = athlete;
    option.textContent = `Athlète ${athlete}`;
    athleteSelect.appendChild(option);
  });

  const sportSelect = document.getElementById('sportSelect');
  const sports = [...new Set(data.map(item => item.sport))];
  sports.forEach(sport => {
    const option = document.createElement('option');
    option.value = sport;
    option.textContent = sport;
    sportSelect.appendChild(option);
  });
}

// ==============================
// FILTRAGE DES DONNÉES
// ==============================
function getFilteredData() {
  const athleteValue = document.getElementById('athleteSelect').value;
  const sportValue = document.getElementById('sportSelect').value;

  let filteredData = allData;

  // Filtre par sport
  if (sportValue) {
    filteredData = filteredData.filter(item => item.sport === sportValue);
  }

  // Filtre par athlète (sauf si "classement" est sélectionné)
  if (athleteValue && athleteValue !== "classement") {
    filteredData = filteredData.filter(item => item.athlete_id == athleteValue);
  }

  return filteredData;
}

// ==============================
// MISE À JOUR DU GRAPHIQUE
// ==============================
function updateChart() {
  const athleteValue = document.getElementById('athleteSelect').value;
  const sportValue = document.getElementById('sportSelect').value;
  const filteredData = getFilteredData();

  // Mise à jour des statistiques
  updateStats(filteredData);

  // Gestion de l'affichage selon la sélection
  if (athleteValue === "classement") {
    // Mode Classement
    document.getElementById('rankingTableContainer').style.display = 'block';
    document.getElementById('map-and-legend').style.display = 'none';
    showRankingChart(allData, sportValue);
    showRankingTable(allData);
  } else if (athleteValue === "") {
    // Mode "Tous les athlètes"
    document.getElementById('rankingTableContainer').style.display = 'none';
    document.getElementById('map-and-legend').style.display = 'flex';
    showAllAthletesChart(allData, sportValue);
    showMapChart(filteredData);
  } else {
    // Mode athlète individuel
    document.getElementById('rankingTableContainer').style.display = 'none';
    document.getElementById('map-and-legend').style.display = 'flex';
    showIndividualChart(allData, athleteValue, sportValue);
    showMapChart(filteredData);
  }
}

// ==============================
// GESTION DU PLEIN ÉCRAN
// ==============================
function setupFullscreen() {
  const chartContainer = document.querySelector('.chart-container');
  const closeBtn = document.getElementById('closeFullscreen');

  if (!chartContainer || !closeBtn) return;

  // Double-clic pour activer le plein écran
  chartContainer.addEventListener('dblclick', () => {
    if (chartContainer.requestFullscreen) {
      chartContainer.requestFullscreen();
    } else if (chartContainer.webkitRequestFullscreen) {
      chartContainer.webkitRequestFullscreen();
    } else if (chartContainer.mozRequestFullScreen) {
      chartContainer.mozRequestFullScreen();
    }
    closeBtn.style.display = 'block';
  });

  // Clic sur la croix pour quitter
  closeBtn.addEventListener('click', () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
  });

  // Détection de la sortie du plein écran
  const fullscreenChangeHandler = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
      closeBtn.style.display = 'none';
    } else {
      closeBtn.style.display = 'block';
    }
  };

  document.addEventListener('fullscreenchange', fullscreenChangeHandler);
  document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
  document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
}

// ==============================
// INITIALISATION
// ==============================
async function init() {
  try {
    allData = await loadData();
    console.log("Données chargées:", allData);

    if (!allData || !Array.isArray(allData) || allData.length === 0) {
      console.error("Données invalides ou vides.");
      return;
    }

    fillDropdowns(allData);
    initMap();
    setupFullscreen();

    // Écouteurs d'événements
    document.getElementById('athleteSelect').addEventListener('change', updateChart);
    document.getElementById('sportSelect').addEventListener('change', updateChart);

    // Affichage initial
    updateChart();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
  }
}

// Lancement de l'application
init();
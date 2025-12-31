import { loadData, updateStats } from './utils.js';
import {
  showRankingChart,
  showIndividualChart,
  showMapChart,
  showRankingTable,
  showAllAthletesChart,
  showSankeyDiagram,
  showCalendarHeatmap,
  initMap,
  showRidgelineBySport,
  showRidgelineByAthlete
} from './charts.js';

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

  if (sportValue) {
    filteredData = filteredData.filter(item => item.sport === sportValue);
  }

  if (athleteValue && athleteValue !== "classement") {
    filteredData = filteredData.filter(item => item.athlete_id == athleteValue);
  }

  return filteredData;
}

// ==============================
// MISE À JOUR DU GRAPHIQUE
// ==============================
function updateChart() {
  try {
    const athleteValue = document.getElementById('athleteSelect').value;
    const sportValue = document.getElementById('sportSelect').value;
    const filteredData = getFilteredData();

    const rankingTableContainer = document.getElementById('rankingTableContainer');
    const mapAndLegend = document.getElementById('map-and-legend');
    const sankeyContainer = document.querySelector('.sankey-container');
    const heatmapContainer = document.querySelector('.heatmap-container');
    const ridgelineContainer = document.querySelector('.ridgeline-container');

    updateStats(filteredData);

    if (athleteValue === "classement") {
      rankingTableContainer.style.display = 'block';
      mapAndLegend.style.display = 'none';
      if (sankeyContainer) sankeyContainer.style.display = 'none';
      if (heatmapContainer) heatmapContainer.style.display = 'block';
      if (ridgelineContainer) ridgelineContainer.style.display = 'block';

      showRankingChart(allData, sportValue);
      showRankingTable(allData);
      showCalendarHeatmap(allData, "classement", sportValue);
      showRidgelineByAthlete(allData, sportValue);

    } else if (athleteValue === "") {
      rankingTableContainer.style.display = 'none';
      mapAndLegend.style.display = 'flex';
      if (sankeyContainer) sankeyContainer.style.display = 'block';
      if (heatmapContainer) heatmapContainer.style.display = 'block';
      if (ridgelineContainer) ridgelineContainer.style.display = 'block';

      showAllAthletesChart(allData, sportValue);
      showMapChart(filteredData, null);
      showSankeyDiagram(filteredData);
      showCalendarHeatmap(allData, null, sportValue);
      showRidgelineBySport(allData, null, sportValue);

    } else {
      rankingTableContainer.style.display = 'none';
      mapAndLegend.style.display = 'flex';
      if (sankeyContainer) sankeyContainer.style.display = 'block';
      if (heatmapContainer) heatmapContainer.style.display = 'block';
      if (ridgelineContainer) ridgelineContainer.style.display = 'block';

      showIndividualChart(allData, athleteValue, sportValue);
      showMapChart(filteredData, athleteValue);
      showSankeyDiagram(filteredData);
      showCalendarHeatmap(allData, athleteValue, sportValue);
      showRidgelineBySport(allData, athleteValue, sportValue);
    }
  } catch (error) {
    console.error('Erreur dans updateChart():', error);
  }
}

// ==============================
// GESTION DU PLEIN ÉCRAN
// ==============================
function setupFullscreen() {
  const chartContainer = document.querySelector('.chart-container');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const closeBtn = document.getElementById('closeFullscreen');

  if (!chartContainer || !fullscreenBtn || !closeBtn) {
    console.error("Éléments de plein écran manquants");
    return;
  }

  const enterFullscreen = () => {
    if (chartContainer.requestFullscreen) {
      chartContainer.requestFullscreen().catch(err => console.error('Erreur fullscreen:', err));
    } else if (chartContainer.webkitRequestFullscreen) {
      chartContainer.webkitRequestFullscreen();
    } else if (chartContainer.mozRequestFullScreen) {
      chartContainer.mozRequestFullScreen();
    } else if (chartContainer.msRequestFullscreen) {
      chartContainer.msRequestFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
  };

  fullscreenBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    enterFullscreen();
  });

  fullscreenBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    enterFullscreen();
  });

  chartContainer.addEventListener('dblclick', (e) => {
    if (e.target !== fullscreenBtn && e.target !== closeBtn) {
      enterFullscreen();
    }
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exitFullscreen();
  });

  const fullscreenChangeHandler = () => {
    const isFullscreen = document.fullscreenElement ||
                        document.webkitFullscreenElement ||
                        document.mozFullScreenElement;

    if (isFullscreen) {
      closeBtn.style.display = 'block';
      fullscreenBtn.style.display = 'none';
    } else {
      closeBtn.style.display = 'none';
      fullscreenBtn.style.display = 'flex';
    }
  };

  document.addEventListener('fullscreenchange', fullscreenChangeHandler);
  document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
  document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);

  closeBtn.style.display = 'none';
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

    document.getElementById('athleteSelect').addEventListener('change', updateChart);
    document.getElementById('sportSelect').addEventListener('change', updateChart);

    updateChart();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
  }
}

init();
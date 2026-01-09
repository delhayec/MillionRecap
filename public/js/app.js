import { loadData, updateStats, getAthleteName, filterValidActivities, normalizeMultiDayActivities } from './utils.js';
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
  showRidgelineByAthlete,
  showSportPieChart,
  showMiniRanking,
  showSocialGraph,
  loadGroupActivities
} from './charts.js';

// ==============================
// VARIABLES GLOBALES
// ==============================
let allData = [];
let groupActivities = null;

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
    option.textContent = getAthleteName(athlete);
    athleteSelect.appendChild(option);
  });

  const sportSelect = document.getElementById('sportSelect');
  const sports = [...new Set(data.map(item => item.sport_type))];
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
    filteredData = filteredData.filter(item => item.sport_type === sportValue);
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
    const mapSection = document.querySelector('.map-section');
    const sankeySection = document.querySelector('.sankey-section');
    const heatmapSection = document.querySelector('.heatmap-section');
    const ridgelineContainer = document.querySelector('.ridgeline-container');
    const socialContainer = document.querySelector('.social-section');
    const chartSection = document.querySelector('.chart-section');

    updateStats(filteredData);
    showSportPieChart(filteredData);
    showMiniRanking(allData);

    const renumberSections = () => {
      const visibleSections = document.querySelectorAll('section:not([style*="display: none"]):not([style*="display:none"])');
      let num = 1;
      visibleSections.forEach(section => {
        const numberEl = section.querySelector('.section-number');
        if (numberEl) {
          numberEl.textContent = String(num).padStart(2, '0');
          num++;
        }
      });
    };

    if (athleteValue === "classement") {
      rankingTableContainer.style.display = 'block';
      if (mapSection) mapSection.style.display = 'none';
      if (sankeySection) sankeySection.style.display = 'none';
      if (heatmapSection) heatmapSection.style.display = 'none';
      if (ridgelineContainer) ridgelineContainer.style.display = 'block';
      if (socialContainer) socialContainer.style.display = 'none';
      
      if (chartSection && rankingTableContainer) {
        chartSection.parentNode.insertBefore(rankingTableContainer, chartSection);
      }

      showRankingChart(allData, sportValue);
      showRankingTable(allData);
      showRidgelineByAthlete(allData, sportValue);
      
      setTimeout(renumberSections, 50);

    } else if (athleteValue === "") {
      rankingTableContainer.style.display = 'none';
      if (mapSection) mapSection.style.display = 'block';
      if (sankeySection) sankeySection.style.display = 'block';
      if (heatmapSection) heatmapSection.style.display = 'block';
      if (ridgelineContainer) ridgelineContainer.style.display = 'block';
      if (socialContainer) socialContainer.style.display = 'block';

      showAllAthletesChart(allData, sportValue);
      showMapChart(filteredData, null);
      showSankeyDiagram(filteredData);
      showCalendarHeatmap(allData, null, sportValue);
      showRidgelineBySport(allData, null, sportValue);
      showSocialGraph(allData, groupActivities);
      
      setTimeout(renumberSections, 50);

    } else {
      rankingTableContainer.style.display = 'none';
      if (mapSection) mapSection.style.display = 'block';
      if (sankeySection) sankeySection.style.display = 'block';
      if (heatmapSection) heatmapSection.style.display = 'block';
      if (ridgelineContainer) ridgelineContainer.style.display = 'block';
      if (socialContainer) socialContainer.style.display = 'none';

      showIndividualChart(allData, athleteValue, sportValue);
      showMapChart(filteredData, athleteValue);
      showSankeyDiagram(filteredData);
      showCalendarHeatmap(allData, athleteValue, sportValue);
      showRidgelineBySport(allData, athleteValue, sportValue);
      
      setTimeout(renumberSections, 50);
    }
  } catch (error) {
    console.error('Erreur dans updateChart:', error);
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
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingText = document.querySelector('.loading-text');
  
  try {
    // Masquer le contenu pendant le chargement
    document.body.style.overflow = 'hidden';

    const totalStartTime = performance.now();

    // CHARGEMENT DES DONNÉES ===
    loadingText.textContent = 'Chargement des données...';
    const groupDataPromise = loadGroupActivities();

    let rawData = await loadData();
    console.log("📊 Données brutes chargées:", rawData.length, "activités");

    // FILTRAGE (rapide) ===
    loadingText.textContent = 'Filtrage des activités...';
    rawData = filterValidActivities(rawData);
    console.log("✅ Après filtrage:", rawData.length, "activités");

    // NORMALISATION (potentiellement lente, maintenant en cache) ===
    loadingText.textContent = 'Normalisation des données...';
    allData = normalizeMultiDayActivities(rawData);
    console.log("✅ Après normalisation:", allData.length, "activités");

    // DONNÉES DE GROUPE ===
    loadingText.textContent = 'Chargement des données de groupe...';
    groupActivities = await groupDataPromise;
    if (groupActivities) {
      console.log("✅ Données de groupe:", groupActivities.length, "sorties");
    }

    if (!allData || !Array.isArray(allData) || allData.length === 0) {
      console.error("❌ Données invalides ou vides.");
      return;
    }

    // INITIALISATION UI (très rapide) ===
    loadingText.textContent = 'Préparation de l\'interface...';
    fillDropdowns(allData);
    initMap();
    setupFullscreen();

    document.getElementById('athleteSelect').addEventListener('change', updateChart);
    document.getElementById('sportSelect').addEventListener('change', updateChart);

    // MASQUER L'ÉCRAN DE CHARGEMENT ===
    // On masque AVANT de générer les graphiques pour un ressenti plus rapide
    loadingText.textContent = 'Presque prêt...';

    const totalTime = performance.now() - totalStartTime;
    console.log(`⚡ Données prêtes en ${totalTime.toFixed(0)}ms`);

    // Petit délai pour permettre à l'UI de se mettre à jour
    await new Promise(resolve => setTimeout(resolve, 50));

    // Masquer l'écran de chargement
    loadingScreen.classList.add('hidden');
    document.body.style.overflow = '';

    // GÉNÉRATION DES GRAPHIQUES (après l'affichage) ===
    // Utiliser requestAnimationFrame pour ne pas bloquer l'UI
    requestAnimationFrame(() => {
      console.log("🎨 Génération des graphiques...");
      const chartsStartTime = performance.now();

      updateChart();

      const chartsTime = performance.now() - chartsStartTime;
      const totalTimeWithCharts = performance.now() - totalStartTime;

      console.log(`✅ Graphiques générés en ${chartsTime.toFixed(0)}ms`);
      console.log(`🎉 Initialisation complète en ${totalTimeWithCharts.toFixed(0)}ms`);
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation:", error);
    loadingText.textContent = 'Erreur de chargement. Veuillez rafraîchir la page.';
    loadingText.style.color = '#ef4444';
  }
}


init();

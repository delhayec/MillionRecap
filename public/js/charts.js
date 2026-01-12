import { getAthleteColor, getSportColor, mapSportName, generateAllDays, getOrdinalSuffix, decodePolyline, formatElevation, getAthleteName, getAthleteIdFromName, loadGroupActivitiesWithCache } from './utils.js';

// ==============================
// CONFIGURATION CHART.JS — REFONTE 2025
// ==============================
const chartColors = {
  background: '#1a1a24',
  text: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textMuted: 'rgba(255, 255, 255, 0.3)',
  grid: 'rgba(255, 255, 255, 0.06)',
  accent: '#f97316',
  accentSecondary: '#22d3ee'
};

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    title: {
      display: true,
      color: chartColors.text,
      font: { 
        size: 16, 
        weight: '600', 
        family: "'Syne', sans-serif" 
      },
      padding: { bottom: 24 }
    },
    legend: {
      labels: {
        color: chartColors.textSecondary,
        font: { size: 12, family: "'Inter', sans-serif" },
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16
      }
    },
    tooltip: {
      enabled: false
    }
  },
  scales: {
    x: {
      grid: { color: chartColors.grid },
      ticks: { 
        color: chartColors.textSecondary, 
        font: { size: 10, family: "'Space Mono', monospace" } 
      }
    }
  }
};

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw: (chart) => {
    if (chart.tooltip?._active?.length) {
      const ctx = chart.ctx;
      const activePoint = chart.tooltip._active[0];
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
      ctx.stroke();
      ctx.restore();
    }
  }
};

// ==============================
// GRAPHIQUE TOUS LES ATHLÈTES
// ==============================
export function showAllAthletesChart(data, selectedSport) {
  const year = data.length > 0 ? new Date(data[0].start_date).getFullYear() : 2025;
  const allDays = generateAllDays(year);
  const TARGET = 1000000;

  const filteredData = selectedSport
    ? data.filter(item => item.sport_type === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];
  const athleteDailyData = {};
  const dailySports = {};

  athletes.forEach(athlete => {
    athleteDailyData[athlete] = allDays.map((day, index) => {
      const dayActivities = filteredData.filter(item =>
        item.athlete_id === athlete && item.start_date.startsWith(day)
      );

      if (!dailySports[index]) dailySports[index] = {};
      const mappedSports = [...new Set(dayActivities.map(act => mapSportName(act.sport_type)))].join(', ');
      dailySports[index][athlete] = mappedSports || 'Aucun';

      return dayActivities.reduce((sum, act) => sum + (act.total_elevation_gain|| 0), 0);
    });
  });

  const totalDailyElevation = allDays.map((day, index) => {
    return athletes.reduce((sum, athlete) => sum + athleteDailyData[athlete][index], 0);
  });

  let cumulative = 0;
  const cumulativeElevation = totalDailyElevation.map(value => {
    cumulative += value;
    return cumulative;
  });

  const targetLine = allDays.map((day, index) => {
    return (TARGET / 365) * (index + 1);
  });

  const barDatasets = athletes.map(athlete => ({
    type: 'bar',
    label: `${getAthleteName(athlete)}`,
    data: athleteDailyData[athlete],
    backgroundColor: getAthleteColor(athlete),
    borderRadius: 2,
    stack: 'stack0',
    yAxisID: 'y'
  }));

  const lineDataset = {
    type: 'line',
    label: 'Dénivelé cumulé total',
    data: cumulativeElevation,
    borderColor: chartColors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 3,
    fill: true,
    pointRadius: 0,
    tension: 0.4,
    yAxisID: 'y1'
  };

  const targetDataset = {
    type: 'line',
    label: 'Objectif 1 Million',
    data: targetLine,
    borderColor: chartColors.textMuted,
    borderWidth: 2,
    borderDash: [8, 4],
    fill: false,
    pointRadius: 0,
    yAxisID: 'y1'
  };

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  window.deniveleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDays,
      datasets: [...barDatasets, lineDataset, targetDataset]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: {
          ...baseChartOptions.plugins.title,
          text: `Progression ${year} — ${selectedSport || 'Tous sports'}`
        },
        tooltip: {
          enabled: false,
          external: function(context) {
            // Utiliser le container du chart pour le plein écran
            const chartContainer = context.chart.canvas.parentNode;
            let tooltipEl = chartContainer.querySelector('#all-athletes-tooltip');
            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.id = 'all-athletes-tooltip';
              tooltipEl.style.cssText = `
                position: absolute;
                background: rgba(10, 10, 15, 0.98);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 12px 16px;
                pointer-events: none;
                z-index: 10000;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                color: #fff;
                max-width: 300px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                transition: opacity 0.15s ease;
              `;
              chartContainer.style.position = 'relative';
              chartContainer.appendChild(tooltipEl);
            }

            const tooltipModel = context.tooltip;
            if (tooltipModel.opacity === 0) {
              tooltipEl.style.opacity = 0;
              return;
            }

            if (tooltipModel.body) {
              const dayIndex = tooltipModel.dataPoints[0].dataIndex;
              const date = new Date(allDays[dayIndex]);
              const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
              
              const cumul = cumulativeElevation[dayIndex];
              const objectif = targetLine[dayIndex];
              const difference = cumul - objectif;
              const status = difference >= 0 ? '↑ Avance' : '↓ Retard';
              const statusColor = difference >= 0 ? '#10b981' : '#f43f5e';
              
              let html = `
                <div style="font-weight:600;margin-bottom:8px;color:#fff;">${dateStr}</div>
                <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);">
                  <div>Cumulé: ${formatElevation(cumul)} m D+</div>
                  <div style="color:${statusColor}">${status}: ${formatElevation(Math.abs(difference))} m D+</div>
                </div>
              `;
              
              // N'afficher que les athlètes avec du D+ ce jour
              athletes.forEach(athleteId => {
                const elevation = athleteDailyData[athleteId][dayIndex];
                if (elevation > 0) {
                  const sport = dailySports[dayIndex]?.[athleteId] || '';
                  html += `
                    <div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
                      <span style="width:10px;height:10px;border-radius:50%;background:${getAthleteColor(athleteId)};flex-shrink:0;"></span>
                      <span style="color:rgba(255,255,255,0.9);">${getAthleteName(athleteId)}</span>
                      <span style="color:rgba(255,255,255,0.5);margin-left:auto;">${formatElevation(elevation)} m D+</span>
                    </div>
                  `;
                }
              });
              
              tooltipEl.innerHTML = html;
            }

            // Position du tooltip relative au canvas
            const canvasRect = context.chart.canvas.getBoundingClientRect();
            const containerRect = chartContainer.getBoundingClientRect();
            const mouseX = tooltipModel.caretX;
            const chartWidth = context.chart.width;
            
            let left;
            if (mouseX > chartWidth / 2) {
              left = mouseX - tooltipEl.offsetWidth - 20;
            } else {
              left = mouseX + 20;
            }
            
            // S'assurer que le tooltip reste dans le container
            left = Math.max(10, Math.min(left, chartWidth - tooltipEl.offsetWidth - 10));
            
            tooltipEl.style.opacity = 1;
            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = Math.max(10, tooltipModel.caretY - tooltipEl.offsetHeight / 2) + 'px';
          }
        }
      },
      scales: {
        x: {
          ...baseChartOptions.scales.x,
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          position: 'right',
          stacked: true,
          title: {
            display: true,
            text: 'Dénivelé journalier (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: { color: chartColors.grid },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: {
            color: chartColors.grid,
            drawOnChartArea: false
          },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

// ==============================
// GRAPHIQUE INDIVIDUEL
// ==============================
export function showIndividualChart(data, athleteId, selectedSport) {
  const year = data.length > 0 ? new Date(data[0].start_date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  let filteredData = data.filter(item => item.athlete_id == athleteId);
  if (selectedSport) {
    filteredData = filteredData.filter(item => item.sport_type === selectedSport);
  }

  const dailyElevation = [];
  const dailySportColors = [];
  const dailySportNames = [];

  allDays.forEach(day => {
    const dayActivities = filteredData.filter(item => item.start_date.startsWith(day));
    const totalElevation = dayActivities.reduce((sum, act) => sum + (act.total_elevation_gain|| 0), 0);
    dailyElevation.push(totalElevation);

    if (dayActivities.length > 0) {
      const sportElevation = {};
      dayActivities.forEach(act => {
        const mappedSport = mapSportName(act.sport_type);
        sportElevation[mappedSport] = (sportElevation[mappedSport] || 0) + (act.total_elevation_gain|| 0);
      });
      const mainSport = Object.keys(sportElevation).reduce((a, b) =>
        sportElevation[a] > sportElevation[b] ? a : b
      );
      dailySportColors.push(getSportColor(mainSport));

      const mappedSports = [...new Set(dayActivities.map(act => mapSportName(act.sport_type)))].join(', ');
      dailySportNames.push(mappedSports);
    } else {
      dailySportColors.push(getAthleteColor(athleteId));
      dailySportNames.push('Aucun');
    }
  });

  let cumulative = 0;
  const cumulativeElevation = dailyElevation.map(value => {
    cumulative += value;
    return cumulative;
  });

  const totalElevation = cumulativeElevation[cumulativeElevation.length - 1] || 0;
  const targetLine = allDays.map((day, index) => {
    return (totalElevation / 365) * (index + 1);
  });

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  window.deniveleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDays,
      datasets: [
        {
          type: 'bar',
          label: 'Dénivelé journalier',
          data: dailyElevation,
          backgroundColor: dailySportColors,
          borderRadius: 2,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Dénivelé cumulé',
          data: cumulativeElevation,
          borderColor: chartColors.text,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: 3,
          fill: true,
          pointRadius: 0,
          tension: 0.4,
          yAxisID: 'y1'
        },
        {
          type: 'line',
          label: `Objectif ${formatElevation(totalElevation)} m D+`,
          data: targetLine,
          borderColor: chartColors.accent,
          borderWidth: 2,
          borderDash: [8, 4],
          fill: false,
          pointRadius: 0,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        title: {
          ...baseChartOptions.plugins.title,
          text: `${getAthleteName(athleteId)} — ${selectedSport || 'Tous sports'}`
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(10, 10, 15, 0.95)',
          titleColor: chartColors.text,
          bodyColor: chartColors.textSecondary,
          borderColor: chartColors.grid,
          borderWidth: 1,
          padding: 16,
          cornerRadius: 12,
          displayColors: true,
          callbacks: {
            title: function(tooltipItems) {
              const date = tooltipItems[0].label;
              const dateObj = new Date(date);
              return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            },
            afterTitle: function(tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              const cumul = cumulativeElevation[index];
              const objectif = targetLine[index];
              const difference = cumul - objectif;
              const status = difference >= 0 ? '↑ Avance' : '↓ Retard';
              return `\nCumulé: ${formatElevation(cumul)} m\n${status}: ${formatElevation(Math.abs(difference))} m D+`;
            },
            label: function(context) {
              if (context.dataset.type === 'bar') {
                const dayIndex = context.dataIndex;
                const sport = dailySportNames[dayIndex];
                return [
                  `${context.dataset.label}: ${formatElevation(context.parsed.y)} m D+`,
                  `Sport: ${sport}`
                ];
              }
              return null;
            }
          }
        }
      },
      scales: {
        x: {
          ...baseChartOptions.scales.x,
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Dénivelé journalier (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: { color: chartColors.grid },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        },
        y1: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: {
            color: chartColors.grid,
            drawOnChartArea: false
          },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

// ==============================
// GRAPHIQUE DE CLASSEMENT
// ==============================
export function showRankingChart(data, selectedSport) {
  const year = data.length > 0 ? new Date(data[0].start_date).getFullYear() : 2025;
  const allDays = generateAllDays(year);

  const filteredData = selectedSport
    ? data.filter(item => item.sport_type === selectedSport)
    : data;

  const athletes = [...new Set(filteredData.map(item => item.athlete_id))];
  const athleteDataMap = {};

  athletes.forEach(athlete => {
    const athleteData = filteredData.filter(item => item.athlete_id === athlete);
    const allDaysWithData = allDays.map(day => {
      const dayActivities = athleteData.filter(item => item.start_date.startsWith(day));
      return dayActivities.reduce((sum, act) => sum + (act.total_elevation_gain|| 0), 0);
    });

    let cumulativeElevation = 0;
    const cumulativeElevations = allDaysWithData.map(value => {
      cumulativeElevation += value;
      return cumulativeElevation;
    });

    athleteDataMap[athlete] = cumulativeElevations;
  });

  // État pour les séries sélectionnées
  let selectedSeries = new Set();

  const datasets = athletes.map(athlete => ({
    type: 'line',
    label: `${getAthleteName(athlete)}`,
    data: athleteDataMap[athlete],
    borderColor: getAthleteColor(athlete),
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderWidth: 3,
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHitRadius: 20, // Zone de clic élargie
    tension: 0.4,
    athleteId: athlete
  }));

  const ctx = document.getElementById('elevationChart').getContext('2d');
  if (window.deniveleChart) window.deniveleChart.destroy();

  const getRankingForDay = (dayIndex) => {
    const dayRanking = athletes.map(athlete => ({
      athleteId: athlete,
      name: getAthleteName(athlete),
      elevation: athleteDataMap[athlete][dayIndex],
      color: getAthleteColor(athlete)
    }));

    dayRanking.sort((a, b) => b.elevation - a.elevation);
    return dayRanking;
  };

  window.deniveleChart = new Chart(ctx, {
    type: 'line',
    data: { labels: allDays, datasets },
    options: {
      ...baseChartOptions,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const datasetIndex = elements[0].datasetIndex;
          const athleteId = datasets[datasetIndex].athleteId;
          
          if (selectedSeries.has(athleteId)) {
            selectedSeries.delete(athleteId);
          } else {
            selectedSeries.add(athleteId);
          }
          
          // Mettre à jour les styles
          window.deniveleChart.data.datasets.forEach((ds, idx) => {
            if (selectedSeries.size === 0) {
              // Aucune sélection : tout normal
              ds.borderWidth = 3;
              ds.borderColor = getAthleteColor(ds.athleteId);
            } else if (selectedSeries.has(ds.athleteId)) {
              // Sélectionné : en surbrillance
              ds.borderWidth = 5;
              ds.borderColor = getAthleteColor(ds.athleteId);
            } else {
              // Non sélectionné : atténué
              ds.borderWidth = 1;
              ds.borderColor = getAthleteColor(ds.athleteId) + '40';
            }
          });
          
          // Ajuster l'échelle si des séries sont sélectionnées
          if (selectedSeries.size > 0) {
            const selectedData = [];
            window.deniveleChart.data.datasets.forEach(ds => {
              if (selectedSeries.has(ds.athleteId)) {
                selectedData.push(...ds.data);
              }
            });
            const maxVal = Math.max(...selectedData);
            const minVal = Math.min(...selectedData.filter(v => v > 0));
            window.deniveleChart.options.scales.y.min = Math.max(0, minVal * 0.9);
            window.deniveleChart.options.scales.y.max = maxVal * 1.1;
          } else {
            // Reset de l'échelle
            window.deniveleChart.options.scales.y.min = undefined;
            window.deniveleChart.options.scales.y.max = undefined;
          }
          
          window.deniveleChart.update();
        }
      },
      plugins: {
        ...baseChartOptions.plugins,
        title: {
          ...baseChartOptions.plugins.title,
          text: `Classement ${year} — ${selectedSport || 'Tous sports'}`
        },
        tooltip: {
          enabled: false,
          external: function(context) {
            const chartContainer = context.chart.canvas.parentNode;
            let tooltipEl = chartContainer.querySelector('#ranking-tooltip');
            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.id = 'ranking-tooltip';
              tooltipEl.style.cssText = `
                position: absolute;
                background: rgba(10, 10, 15, 0.98);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 12px 16px;
                pointer-events: none;
                z-index: 10000;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                color: #fff;
                max-width: 280px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                transition: opacity 0.15s ease;
              `;
              chartContainer.style.position = 'relative';
              chartContainer.appendChild(tooltipEl);
            }

            const tooltipModel = context.tooltip;
            if (tooltipModel.opacity === 0) {
              tooltipEl.style.opacity = 0;
              return;
            }

            if (tooltipModel.body) {
              const dayIndex = tooltipModel.dataPoints[0].dataIndex;
              const date = new Date(allDays[dayIndex]);
              const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
              
              const ranking = getRankingForDay(dayIndex);
              
              // Filtrer si des séries sont sélectionnées
              const displayRanking = selectedSeries.size > 0 
                ? ranking.filter(entry => selectedSeries.has(entry.athleteId))
                : ranking;
              
              let html = `<div style="font-weight:600;margin-bottom:8px;color:#fff;">${dateStr}</div>`;
              
              displayRanking.forEach((entry, idx) => {
                const fullPosition = ranking.findIndex(r => r.athleteId === entry.athleteId) + 1;
                const suffix = fullPosition === 1 ? 'ᵉʳ' : 'ᵉ';
                const elevFormatted = formatElevation(entry.elevation);
                
                html += `
                  <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
                    <span style="width:10px;height:10px;border-radius:50%;background:${entry.color};flex-shrink:0;"></span>
                    <span style="color:rgba(255,255,255,0.9);">${fullPosition}${suffix} ${entry.name}</span>
                    <span style="color:rgba(255,255,255,0.5);margin-left:auto;">${elevFormatted} D+</span>
                  </div>
                `;
              });
              
              tooltipEl.innerHTML = html;
            }

            const mouseX = tooltipModel.caretX;
            const chartWidth = context.chart.width;
            
            let left;
            if (mouseX > chartWidth / 2) {
              left = mouseX - tooltipEl.offsetWidth - 20;
            } else {
              left = mouseX + 20;
            }
            
            left = Math.max(10, Math.min(left, chartWidth - tooltipEl.offsetWidth - 10));
            
            tooltipEl.style.opacity = 1;
            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = Math.max(10, tooltipModel.caretY - tooltipEl.offsetHeight / 2) + 'px';
          }
        },
        legend: {
          ...baseChartOptions.plugins.legend,
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            const athleteId = datasets[index].athleteId;
            
            if (selectedSeries.has(athleteId)) {
              selectedSeries.delete(athleteId);
            } else {
              selectedSeries.add(athleteId);
            }
            
            // Mettre à jour les styles
            legend.chart.data.datasets.forEach((ds) => {
              if (selectedSeries.size === 0) {
                ds.borderWidth = 3;
                ds.borderColor = getAthleteColor(ds.athleteId);
              } else if (selectedSeries.has(ds.athleteId)) {
                ds.borderWidth = 5;
                ds.borderColor = getAthleteColor(ds.athleteId);
              } else {
                ds.borderWidth = 1;
                ds.borderColor = getAthleteColor(ds.athleteId) + '40';
              }
            });
            
            // Ajuster l'échelle
            if (selectedSeries.size > 0) {
              const selectedData = [];
              legend.chart.data.datasets.forEach(ds => {
                if (selectedSeries.has(ds.athleteId)) {
                  selectedData.push(...ds.data);
                }
              });
              const maxVal = Math.max(...selectedData);
              const minVal = Math.min(...selectedData.filter(v => v > 0));
              legend.chart.options.scales.y.min = Math.max(0, minVal * 0.9);
              legend.chart.options.scales.y.max = maxVal * 1.1;
            } else {
              legend.chart.options.scales.y.min = undefined;
              legend.chart.options.scales.y.max = undefined;
            }
            
            legend.chart.update();
          }
        }
      },
      scales: {
        x: {
          ...baseChartOptions.scales.x,
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Dénivelé cumulé (m)',
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 11 }
          },
          grid: { color: chartColors.grid },
          ticks: { 
            color: chartColors.textSecondary,
            font: { family: "'Space Mono', monospace", size: 10 }
          }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

// ==============================
// CARTE
// ==============================
let map;
let polylines = [];

export function initMap() {
  if (map) {
    // Si la carte existe déjà, forcer le recalcul de taille
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return;
  }

  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  map = L.map('map', {
    center: [46.5, 2.5],  // Centre de la France
    zoom: 5  // Zoom pour voir toute la France + pays limitrophes
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // Forcer le recalcul de la taille après initialisation
  setTimeout(() => {
    map.invalidateSize();
  }, 200);
}

function generateLegend(activities, colorMode = 'athlete') {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) return;

  legendContainer.innerHTML = '<h3>Légende</h3>';

  if (colorMode === 'sport') {
    const sports = [...new Set(activities.map(activity => mapSportName(activity.sport_type)))];

    sports.forEach(sport => {
      const color = getSportColor(sport);
      const count = activities.filter(a => mapSportName(a.sport_type) === sport).length;

      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.title = `${count} activité${count > 1 ? 's' : ''}`;

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = color;

      const text = document.createElement('div');
      text.className = 'legend-text';
      text.textContent = `${sport} (${count})`;

      legendItem.appendChild(colorBox);
      legendItem.appendChild(text);
      legendContainer.appendChild(legendItem);
    });
  } else {
    const uniqueAthletes = [...new Set(activities.map(activity => activity.athlete_id))];

    uniqueAthletes.forEach(athleteId => {
      const color = getAthleteColor(athleteId);
      const count = activities.filter(a => a.athlete_id === athleteId).length;

      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.title = `${count} activité${count > 1 ? 's' : ''}`;

      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = color;

      const text = document.createElement('div');
      text.className = 'legend-text';
      text.textContent = `${getAthleteName(athleteId)} (${count})`;

      legendItem.appendChild(colorBox);
      legendItem.appendChild(text);
      legendContainer.appendChild(legendItem);
    });
  }
}

function calculateCountryStats(activities) {
  const countryStats = {};

  activities.forEach(activity => {
    const country = activity.country;
    if (!country) return;

    if (!countryStats[country]) {
      countryStats[country] = {
        name: country,
        count: 0,
        elevation: 0,
        distance: 0,
        athletes: new Set()
      };
    }

    countryStats[country].count++;
    countryStats[country].elevation += activity.total_elevation_gain|| 0;
    countryStats[country].distance += activity.distance|| 0;
    countryStats[country].athletes.add(activity.athlete_id);
  });

  return Object.values(countryStats).sort((a, b) => b.elevation - a.elevation);
}

function generateCountryStats(activities) {
  const container = document.getElementById('countryStatsContainer');
  if (!container) return;

  const stats = calculateCountryStats(activities);
  
  container.innerHTML = '<h3>Pays</h3>';

  stats.forEach((country, index) => {
    const item = document.createElement('div');
    item.className = 'country-item';
    
    item.innerHTML = `
      <div class="country-name">
        <span class="country-badge">${index + 1}</span>
        ${country.name}
      </div>
      <div class="country-stats-line">↑ ${formatElevation(country.elevation)} m D+</div>
      <div class="country-stats-line">→ ${(country.distance / 1000).toFixed(0)} km</div>
      <div class="country-stats-line">◉ ${country.count} activités</div>
    `;
    
    container.appendChild(item);
  });

  const summary = document.createElement('div');
  summary.className = 'country-summary';
  summary.textContent = `${stats.length} pays visités`;
  container.appendChild(summary);
}

export function showMapChart(data, athleteId) {
  if (!map) initMap();

  // Forcer le recalcul de taille
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);

  polylines.forEach(p => map.removeLayer(p));
  polylines = [];

  const colorMode = athleteId ? 'sport' : 'athlete';
  generateLegend(data, colorMode);
  generateCountryStats(data);

  data.forEach(activity => {
    if (!activity.map || !activity.map.summary_polyline) return;

    const points = decodePolyline(activity.map.summary_polyline);
    if (points.length === 0) return;

    const color = athleteId 
      ? getSportColor(mapSportName(activity.sport_type))
      : getAthleteColor(activity.athlete_id);

    // Filtrer les segments rectilignes (trajets en train)
    const filteredSegments = filterStraightLines(points, 20000); // 20km de seuil
    
    filteredSegments.forEach(segment => {
      if (segment.length < 2) return;
      
      const polyline = L.polyline(segment, {
        color: color,
        weight: 2.5,
        opacity: 0.8
      }).addTo(map);

      const date = new Date(activity.start_date).toLocaleDateString('fr-FR');
      const popup = `
        <strong>${activity.name}</strong><br>
        ${date}<br>
        ${mapSportName(activity.sport_type)}<br>
        ↑ ${activity.total_elevation_gain} m
      `;
      polyline.bindPopup(popup);
      polylines.push(polyline);
    });
  });

  if (polylines.length > 0) {
    const group = L.featureGroup(polylines);
    map.fitBounds(group.getBounds(), { 
      padding: [30, 30],
      maxZoom: 6  // Ne pas zoomer plus que niveau 6 pour garder une vue d'ensemble
    });
    
    // Recalculer après fitBounds
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }
}

// Fonction pour vérifier si un segment est rectiligne
function isSegmentStraight(points, startIdx, endIdx) {
  if (endIdx - startIdx < 2) return false;
  
  const start = points[startIdx];
  const end = points[endIdx];
  
  // Calculer la distance directe (utilise haversineDistance définie plus bas)
  const directDistance = haversineDistanceMap(start[0], start[1], end[0], end[1]);
  
  // Calculer la distance totale du chemin
  let pathDistance = 0;
  for (let i = startIdx; i < endIdx; i++) {
    pathDistance += haversineDistanceMap(points[i][0], points[i][1], points[i+1][0], points[i+1][1]);
  }
  
  // Si le ratio est très proche de 1, c'est une ligne droite
  const ratio = directDistance / pathDistance;
  return ratio > 0.99; // Plus de 98% de rectitude
}

// Version locale de haversine pour la carte (évite conflit avec celle du social graph)
function haversineDistanceMap(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Filtrer les lignes droites de plus de X mètres
function filterStraightLines(points, minStraightDistance) {
  if (!points || points.length < 3) return [points];
  
  const segments = [];
  let currentSegment = [points[0]];
  
  for (let i = 1; i < points.length - 1; i++) {
    // Chercher en avant pour détecter une ligne droite
    let straightEnd = -1;
    
    for (let j = i + 2; j < Math.min(i + 50, points.length); j++) {
      const directDist = haversineDistanceMap(points[i][0], points[i][1], points[j][0], points[j][1]);
      
      if (directDist > minStraightDistance && isSegmentStraight(points, i, j)) {
        straightEnd = j;
      }
    }
    
    if (straightEnd > 0) {
      // On a trouvé une ligne droite significative
      // Terminer le segment courant
      currentSegment.push(points[i]);
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      
      // Commencer un nouveau segment après la ligne droite
      currentSegment = [points[straightEnd]];
      i = straightEnd; // Sauter la ligne droite
    } else {
      currentSegment.push(points[i]);
    }
  }
  
  // Ajouter le dernier point et segment
  currentSegment.push(points[points.length - 1]);
  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }
  
  return segments.length > 0 ? segments : [points];
}

// ==============================
// TABLEAU DE CLASSEMENT
// ==============================
export function showRankingTable(data) {
  const tbody = document.getElementById('rankingTableBody');
  if (!tbody) return;

  const athleteStats = {};

  data.forEach(activity => {
    const id = activity.athlete_id;
    if (!athleteStats[id]) {
      athleteStats[id] = {
        athlete_id: id,
        total_elevation: 0,
        activity_count: 0,
        total_distance: 0,
        total_time: 0,
        active_days: new Set(),
        best_activity: null,
        elevation_by_sport: {},
        activities_without_elevation: 0,
        // Nouvelles stats
        total_kudos: 0,
        total_achievements: 0,
        night_activities: 0,
        morning_activities: 0,
        weekend_activities: 0,
        countries: new Set(),
        max_speed: 0,
        longest_activity_time: 0,
        // Stats pour nouveaux achievements
        elevation_by_day: {}, // Pour calculer le meilleur jour
        sports_used: new Set() // Pour compter les types de sports
      };
    }

    athleteStats[id].total_elevation += activity.total_elevation_gain || 0;
    athleteStats[id].activity_count++;
    athleteStats[id].total_distance += activity.distance || 0;
    athleteStats[id].total_time += activity.moving_time || 0;
    
    // Jours actifs et D+ par jour
    const day = activity.start_date.split('T')[0];
    athleteStats[id].active_days.add(day);
    athleteStats[id].elevation_by_day[day] = (athleteStats[id].elevation_by_day[day] || 0) + (activity.total_elevation_gain || 0);
    
    // Sports utilisés
    const sport = mapSportName(activity.sport_type);
    athleteStats[id].sports_used.add(sport);
    
    // Meilleure activité (ignorer les activités multi-jours)
    if (!activity._isPartOfMultiDay) {
      if (!athleteStats[id].best_activity || (activity.total_elevation_gain || 0) > athleteStats[id].best_activity.elevation) {
        athleteStats[id].best_activity = {
          id: activity.activity_id,
          elevation: activity.total_elevation_gain || 0,
          date: activity.start_date,
          name: activity.name
        };
      }
    }
    
    // Elevation par sport
    athleteStats[id].elevation_by_sport[sport] = (athleteStats[id].elevation_by_sport[sport] || 0) + (activity.total_elevation_gain || 0);
    
    // Activités sans dénivelé
    if (!activity.total_elevation_gain || activity.total_elevation_gain === 0) {
      athleteStats[id].activities_without_elevation++;
    }
    
    // Nouvelles stats
    athleteStats[id].total_kudos += activity.kudos_count || 0;
    athleteStats[id].total_achievements += activity.achievement_count || 0;
    
    // Heure locale pour déterminer matin/nuit
    const localTime = activity.start_date_local || activity.start_date;
    const hour = parseInt(localTime.substring(11, 13));
    if (hour >= 20 || hour < 5) {
      athleteStats[id].night_activities++;
    }
    if (hour >= 4 && hour < 7) {
      athleteStats[id].morning_activities++;
    }
    
    // Weekend
    const dt = new Date(activity.start_date);
    if (dt.getDay() === 0 || dt.getDay() === 6) {
      athleteStats[id].weekend_activities++;
    }
    
    // Pays
    if (activity.country) {
      athleteStats[id].countries.add(activity.country);
    }
    
    // Vitesse max
    if (activity.max_speed && activity.max_speed > athleteStats[id].max_speed) {
      athleteStats[id].max_speed = activity.max_speed;
    }
    
    // Plus longue activité
    if (activity.moving_time && activity.moving_time > athleteStats[id].longest_activity_time) {
      athleteStats[id].longest_activity_time = activity.moving_time;
    }
  });

  const stats = Object.values(athleteStats).map(s => {
    // Calculer le meilleur jour (plus gros D+ en 24h)
    const best24h = Object.entries(s.elevation_by_day).reduce((best, [day, elev]) => {
      return elev > best.elevation ? { day, elevation: elev } : best;
    }, { day: null, elevation: 0 });
    
    return {
      ...s,
      active_days_count: s.active_days.size,
      elevation_per_distance: s.total_distance > 0 ? (s.total_elevation / (s.total_distance / 1000)).toFixed(1) : 0,
      elevation_per_time: s.total_time > 0 ? (s.total_elevation / (s.total_time / 3600)).toFixed(1) : 0,
      elevation_per_activity: s.activity_count > 0 ? (s.total_elevation / s.activity_count).toFixed(0) : 0,
      best_elevation: s.best_activity ? s.best_activity.elevation : 0,
      num_countries: s.countries.size,
      weekend_ratio: s.activity_count > 0 ? s.weekend_activities / s.activity_count : 0,
      // Nouvelles stats dérivées
      best_24h_elevation: best24h.elevation,
      best_24h_day: best24h.day,
      num_sports: s.sports_used.size
    };
  });

  stats.sort((a, b) => b.total_elevation - a.total_elevation);

  const renderTable = () => {
    tbody.innerHTML = '';
    stats.forEach(s => {
      const row = document.createElement('tr');
      const recordDate = s.best_activity ? new Date(s.best_activity.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-';
      const stravaLink = s.best_activity ? `https://www.strava.com/activities/${s.best_activity.id}` : '#';
      
      row.innerHTML = `
        <td style="color: ${getAthleteColor(s.athlete_id)}">${getAthleteName(s.athlete_id)}</td>
        <td>${s.total_elevation.toLocaleString('fr-FR')}</td>
        <td>${s.activity_count}</td>
        <td>${(s.total_distance / 1000).toFixed(0)}</td>
        <td>${Math.round(s.total_time / 3600)}</td>
        <td>${s.elevation_per_distance}</td>
        <td>${s.elevation_per_time}</td>
        <td>${s.elevation_per_activity}</td>
        <td data-sort-value="${s.best_elevation}">
          ${s.best_activity ? `
            <a href="${stravaLink}" target="_blank" class="record-link" title="${s.best_activity.name}">
              <span class="record-elevation">↑ ${formatElevation(s.best_activity.elevation)} m D+</span>
              <span class="record-date">${recordDate}</span>
              <span class="record-strava">Voir sur Strava →</span>
            </a>
          ` : '-'}
        </td>
      `;
      tbody.appendChild(row);
    });
  };

  renderTable();

  // Générer les achievements
  generateAchievements(stats);

  // Tri des colonnes
  document.querySelectorAll('#rankingTable th').forEach(th => {
    // Supprimer les anciens listeners
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
    
    newTh.addEventListener('click', () => {
      const key = newTh.dataset.sort;
      if (!key) return;
      
      const isAsc = newTh.classList.contains('sorted-asc');
      
      document.querySelectorAll('#rankingTable th').forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      
      // Tri selon le type de clé
      if (key === 'best_elevation') {
        stats.sort((a, b) => isAsc ? a.best_elevation - b.best_elevation : b.best_elevation - a.best_elevation);
      } else {
        stats.sort((a, b) => {
          const valA = parseFloat(a[key]) || 0;
          const valB = parseFloat(b[key]) || 0;
          return isAsc ? valA - valB : valB - valA;
        });
      }
      
      newTh.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
      renderTable();
    });
  });
}

function generateAchievements(stats) {
  const grid = document.getElementById('achievementsGrid');
  if (!grid) return;

  const achievements = [
    {
      id: 'king',
      emoji: '👑',
      name: 'Roi du D+',
      desc: 'Le plus de dénivelé total',
      type: 'legendary',
      getValue: s => s.total_elevation,
      format: v => `${formatElevation(v)} m D+`
    },
    {
      id: 'best24h',
      emoji: '🔥',
      name: 'Journée de Feu',
      desc: 'Le plus gros D+ en 24h',
      type: 'legendary',
      getValue: s => s.best_24h_elevation,
      format: v => `${formatElevation(v)} m D+`
    },
    {
      id: 'polyvalent',
      emoji: '🎯',
      name: 'Polyvalent',
      desc: 'Le plus de types d\'activités',
      type: 'normal',
      getValue: s => s.num_sports,
      format: v => `${v} sports`
    },
    {
      id: 'efficient',
      emoji: '⚡',
      name: 'Efficace',
      desc: 'Le plus de D+ par sortie',
      type: 'normal',
      getValue: s => parseFloat(s.elevation_per_activity),
      format: v => `${formatElevation(v)} m D+/sortie`
    },
    {
      id: 'steep',
      emoji: '🧗',
      name: 'Accro à la Pente',
      desc: 'Le plus de D+ par km',
      type: 'normal',
      getValue: s => parseFloat(s.elevation_per_distance),
      format: v => `${v} m/km`
    },
    {
      id: 'nightowl',
      emoji: '🦉',
      name: 'Oiseau de Nuit',
      desc: 'Activités après 20h (heure locale)',
      type: 'fun',
      getValue: s => s.night_activities,
      format: v => `${v} sorties`
    },
    {
      id: 'earlybird',
      emoji: '🐓',
      name: 'Lève-tôt',
      desc: 'Activités 4h-7h (heure locale)',
      type: 'normal',
      getValue: s => s.morning_activities,
      format: v => `${v} sorties`
    },
    {
      id: 'distance',
      emoji: '🛣️',
      name: 'Forrest Gump',
      desc: 'La plus grande distance totale',
      type: 'normal',
      getValue: s => s.total_distance,
      format: v => `${(v/1000).toFixed(0)} km`
    },
    {
      id: 'flat',
      emoji: '🤷',
      name: 'A pas compris',
      desc: 'Le plus d\'activités sans D+',
      type: 'fun',
      getValue: s => s.activities_without_elevation,
      format: v => `${v} activités`
    },
    {
      id: 'cyclist',
      emoji: '🚴',
      name: 'Roi de la Pédale',
      desc: 'Le plus de D+ en vélo',
      type: 'normal',
      getValue: s => s.elevation_by_sport['Bike'] || 0,
      format: v => `${formatElevation(v)} m D+ `
    },
    {
      id: 'runner',
      emoji: '🏃',
      name: 'Crapahute',
      desc: 'Le plus de D+ en trail/run',
      type: 'normal',
      getValue: s => s.elevation_by_sport['Run'] || 0,
      format: v => `${formatElevation(v)} m D+`
    },
    {
      id: 'skier',
      emoji: '⛷️',
      name: 'Collant Pipette',
      desc: 'Le plus de D+ en ski',
      type: 'normal',
      getValue: s => s.elevation_by_sport['Ski mountaineering'] || 0,
      format: v => `${formatElevation(v)} m D+`
    },
    {
      id: 'hiker',
      emoji: '🥾',
      name: 'Randonneur',
      desc: 'Le plus de D+ en rando',
      type: 'normal',
      getValue: s => s.elevation_by_sport['Hike'] || 0,
      format: v => `${formatElevation(v)} m D+`
    }
  ];

  // Créer le tooltip custom s'il n'existe pas
  let tooltipEl = document.getElementById('achievement-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'achievement-tooltip';
    tooltipEl.style.cssText = `
      position: fixed;
      background: rgba(10, 10, 15, 0.98);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px 16px;
      pointer-events: none;
      z-index: 10000;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: #fff;
      max-width: 280px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      opacity: 0;
      transition: opacity 0.15s ease;
    `;
    document.body.appendChild(tooltipEl);
  }

  grid.innerHTML = achievements.map((achievement, achievementIdx) => {
    // Trouver le classement complet
    const validStats = stats.filter(s => achievement.getValue(s) > 0);
    if (validStats.length === 0) return '';
    
    // Trier pour avoir le classement
    const sorted = [...validStats].sort((a, b) => achievement.getValue(b) - achievement.getValue(a));
    const winner = sorted[0];
    const top3 = sorted.slice(0, 3);
    
    const value = achievement.getValue(winner);
    
    return `
      <div class="achievement-card" data-achievement-idx="${achievementIdx}">
        <div class="achievement-badge ${achievement.type}">${achievement.emoji}</div>
        <div class="achievement-info">
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">${achievement.desc}</div>
          <div class="achievement-winner">
            <div class="achievement-winner-color" style="background: ${getAthleteColor(winner.athlete_id)}"></div>
            <span class="achievement-winner-name">${getAthleteName(winner.athlete_id)}</span>
            <span class="achievement-winner-value">${achievement.format(value)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Ajouter les événements pour le tooltip
  document.querySelectorAll('.achievement-card').forEach(card => {
    const idx = parseInt(card.dataset.achievementIdx);
    const achievement = achievements[idx];
    if (!achievement) return;
    
    const validStats = stats.filter(s => achievement.getValue(s) > 0);
    const sorted = [...validStats].sort((a, b) => achievement.getValue(b) - achievement.getValue(a));
    const top3 = sorted.slice(0, 3);
    
    card.addEventListener('mouseenter', (e) => {
      let html = `<div style="font-weight:600;margin-bottom:10px;font-size:13px;">${achievement.emoji} ${achievement.name}</div>`;
      
      top3.forEach((s, idx) => {
        const pos = idx + 1;
        const suffix = pos === 1 ? 'er' : 'e';
        const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
        html += `
          <div style="display:flex;align-items:center;gap:8px;margin:6px 0;">
            <span>${medal}</span>
            <span style="width:10px;height:10px;border-radius:50%;background:${getAthleteColor(s.athlete_id)};flex-shrink:0;"></span>
            <span style="color:rgba(255,255,255,0.9);">${getAthleteName(s.athlete_id)}</span>
            <span style="color:rgba(255,255,255,0.5);margin-left:auto;">${achievement.format(achievement.getValue(s))}</span>
          </div>
        `;
      });
      
      tooltipEl.innerHTML = html;
      tooltipEl.style.opacity = '1';
    });
    
    card.addEventListener('mousemove', (e) => {
      tooltipEl.style.left = (e.clientX + 15) + 'px';
      tooltipEl.style.top = (e.clientY - 10) + 'px';
    });
    
    card.addEventListener('mouseleave', () => {
      tooltipEl.style.opacity = '0';
    });
  });
}

// ==============================
// DIAGRAMME SANKEY
// ==============================
export function showSankeyDiagram(data) {
  const chartDom = document.getElementById('sankeyChart');
  if (!chartDom) return;

  if (window.sankeyChart && typeof window.sankeyChart.dispose === 'function') {
    window.sankeyChart.dispose();
  }

  window.sankeyChart = echarts.init(chartDom);

  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  const athletes = [...new Set(data.map(d => d.athlete_id))];
  const sports = [...new Set(data.map(d => mapSportName(d.sport_type)))];

  // Calculer le total global
  const totalGlobal = data.reduce((sum, d) => sum + (d.total_elevation_gain|| 0), 0);

  // Calculer les totaux par athlète
  const athleteTotals = {};
  athletes.forEach(a => {
    athleteTotals[a] = data.filter(d => d.athlete_id === a)
      .reduce((sum, d) => sum + (d.total_elevation_gain|| 0), 0);
  });

  // Calculer les totaux par sport
  const sportTotals = {};
  sports.forEach(s => {
    sportTotals[s] = data.filter(d => mapSportName(d.sport_type) === s)
      .reduce((sum, d) => sum + (d.total_elevation_gain|| 0), 0);
  });

  athletes.forEach(a => {
    const name = `${getAthleteName(a)}`;
    if (!nodeSet.has(name)) {
      nodes.push({ 
        name, 
        itemStyle: { color: getAthleteColor(a) },
        total: athleteTotals[a],
        percentage: ((athleteTotals[a] / totalGlobal) * 100).toFixed(1)
      });
      nodeSet.add(name);
    }
  });

  sports.forEach(s => {
    if (!nodeSet.has(s)) {
      nodes.push({ 
        name: s, 
        itemStyle: { color: getSportColor(s) },
        total: sportTotals[s],
        percentage: ((sportTotals[s] / totalGlobal) * 100).toFixed(1)
      });
      nodeSet.add(s);
    }
  });

  const linkMap = {};
  data.forEach(activity => {
    const source = `${getAthleteName(activity.athlete_id)}`;
    const target = mapSportName(activity.sport_type);
    const key = `${source}->${target}`;

    if (!linkMap[key]) {
      linkMap[key] = { source, target, value: 0 };
    }
    linkMap[key].value += activity.total_elevation_gain|| 0;
  });

  Object.values(linkMap).forEach(link => links.push(link));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      formatter: params => {
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}<br/>↑ ${formatElevation(params.data.value)} m D+`;
        }
        // Node tooltip
        const node = nodes.find(n => n.name === params.name);
        if (node) {
          return `<strong>${params.name}</strong><br/>↑ ${formatElevation(node.total)} m D+<br/>${node.percentage}% du total`;
        }
        return params.name;
      }
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      nodeAlign: 'left',
      data: nodes,
      links: links,
      label: {
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
        fontSize: 12
      },
      lineStyle: {
        color: 'gradient',
        curveness: 0.5,
        opacity: 0.4
      },
      itemStyle: {
        borderWidth: 0
      }
    }]
  };

  window.sankeyChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.sankeyChart) window.sankeyChart.resize();
  });
}

// ==============================
// HEATMAP CALENDRIER
// ==============================
export function showCalendarHeatmap(data, athleteId, selectedSport) {
  const chartDom = document.getElementById('calendarHeatmap');
  if (!chartDom) return;

  if (window.calendarChart && typeof window.calendarChart.dispose === 'function') {
    window.calendarChart.dispose();
  }

  window.calendarChart = echarts.init(chartDom);

  let filteredData = data;
  if (athleteId && athleteId !== "classement") {
    filteredData = filteredData.filter(d => d.athlete_id == athleteId);
  }
  if (selectedSport) {
    filteredData = filteredData.filter(d => d.sport_type === selectedSport);
  }

  // Calculer le nombre d'athlètes (pour l'objectif individuel)
  // Si un athlète est sélectionné, on divise par le nombre total d'athlètes
  // Si tous sont affichés, on ne divise pas (objectif global)
  const totalAthletes = [...new Set(data.map(d => d.athlete_id))].length;
  const numAthletes = athleteId && athleteId !== "classement" 
    ? totalAthletes  // Un athlète sélectionné -> objectif individuel
    : 1;             // Tous les athlètes -> objectif global

  const year = filteredData.length > 0 ? new Date(filteredData[0].start_date).getFullYear() : 2025;

  const dailyElevation = {};
  filteredData.forEach(activity => {
    const date = activity.start_date.split('T')[0];
    dailyElevation[date] = (dailyElevation[date] || 0) + (activity.total_elevation_gain|| 0);
  });

  const calendarData = Object.entries(dailyElevation).map(([date, value]) => [date, value]);

  const maxValue = Math.max(...calendarData.map(d => d[1]), 1);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      formatter: params => {
        const date = new Date(params.data[0]).toLocaleDateString('fr-FR', { 
          weekday: 'long', day: 'numeric', month: 'long' 
        });
        return `${date}<br/>↑ ${formatElevation(params.data[1])} m D+`;
      }
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxValue,
      inRange: {
        color: ['#1a1a24', '#f97316']
      }
    },
    calendar: {
      top: 20,
      left: 50,
      right: 20,
      bottom: 10,
      cellSize: ['auto', 15],
      range: year,
      itemStyle: {
        borderWidth: 2,
        borderColor: '#0a0a0f'
      },
      yearLabel: { show: false },
      monthLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontFamily: "'Space Mono', monospace",
        fontSize: 10
      },
      dayLabel: {
        firstDay: 1,
        color: 'rgba(255, 255, 255, 0.3)',
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        nameMap: ['D', 'L', 'M', 'M', 'J', 'V', 'S']
      },
      splitLine: { show: false }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calendarData
    }]
  };

  window.calendarChart.setOption(option);

  // Générer les barres de performance avec animation au scroll
  setupPerformanceBarsAnimation(filteredData, year, numAthletes);

  window.addEventListener('resize', () => {
    if (window.calendarChart) window.calendarChart.resize();
  });
}

function setupPerformanceBarsAnimation(data, year, numAthletes = 1) {
  const performanceBars = document.querySelector('.performance-bars');
  if (!performanceBars) return;

  // Stocker les données pour l'animation
  window.perfBarsData = { data, year, numAthletes };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Déclencher l'animation des barres
        setTimeout(() => {
          generateWeeklyBars(data, year, true, numAthletes);
          generateMonthlyBars(data, year, true, numAthletes);
        }, 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(performanceBars);
  
  // Générer les barres sans animation d'abord (hauteur 0)
  generateWeeklyBars(data, year, false, numAthletes);
  generateMonthlyBars(data, year, false, numAthletes);
}

function generateWeeklyBars(data, year, animate = true, numAthletes = 1) {
  const container = document.getElementById('weeklyBars');
  if (!container) return;

  const TARGET = 1000000;
  // Objectif individuel : divisé par le nombre d'athlètes
  const weeklyTarget = (TARGET / numAthletes) / 52;

  // Calculer le dénivelé par semaine
  const weeklyData = {};
  data.forEach(activity => {
    const date = new Date(activity.start_date);
    if (date.getFullYear() !== year) return;
    
    const weekNum = getWeekNumber(date);
    const weekKey = `S${weekNum}`;
    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + (activity.total_elevation_gain|| 0);
  });

  // Créer toutes les semaines de l'année
  const allWeeks = [];
  for (let i = 1; i <= 52; i++) {
    allWeeks.push({ week: `S${i}`, value: weeklyData[`S${i}`] || 0 });
  }

  const maxValue = Math.max(...allWeeks.map(w => w.value), weeklyTarget * 1.2);
  const objectiveHeight = (weeklyTarget / maxValue) * 100;

  // Générer les barres
  let barsHTML = allWeeks.map((w, index) => {
    const height = (w.value / maxValue) * 100;
    const displayLabel = w.week.replace('S', '');
    const showLabel = parseInt(displayLabel) % 4 === 1;
    const diff = w.value - weeklyTarget;
    const diffSign = diff >= 0 ? '+' : '';
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const initialHeight = animate ? Math.max(height, 2) : 0;
    const delay = animate ? index * 15 : 0;
    
    return `
      <div class="perf-bar" style="height: ${initialHeight}%; transition: height 0.5s ease-out ${delay}ms;">
        <div class="perf-bar-tooltip">
          <strong>${w.week}</strong><br>
          ↑ ${formatElevation(w.value)} m D+<br>
          <span class="diff-${diffClass}">${diffSign}${formatElevation(diff)} m D+</span>
        </div>
        ${showLabel ? `<span class="perf-bar-label">${displayLabel}</span>` : ''}
      </div>
    `;
  }).join('');

  // Ajouter la ligne d'objectif
  const objectiveLine = `
    <div class="objective-line" style="bottom: ${objectiveHeight}%">
      <span class="objective-label">Obj. ${formatElevation(weeklyTarget)} m D+/sem</span>
    </div>
  `;

  container.innerHTML = barsHTML + objectiveLine;
}

function generateMonthlyBars(data, year, animate = true, numAthletes = 1) {
  const container = document.getElementById('monthlyBars');
  if (!container) return;

  const TARGET = 1000000;
  // Objectif individuel : divisé par le nombre d'athlètes
  const monthlyTarget = (TARGET / numAthletes) / 12;
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  
  // Calculer le dénivelé par mois
  const monthlyData = new Array(12).fill(0);
  data.forEach(activity => {
    const date = new Date(activity.start_date);
    if (date.getFullYear() !== year) return;
    monthlyData[date.getMonth()] += (activity.total_elevation_gain|| 0);
  });

  const maxValue = Math.max(...monthlyData, monthlyTarget * 1.2);
  const objectiveHeight = (monthlyTarget / maxValue) * 100;

  // Générer les barres
  let barsHTML = monthlyData.map((value, index) => {
    const height = (value / maxValue) * 100;
    const diff = value - monthlyTarget;
    const diffSign = diff >= 0 ? '+' : '';
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const initialHeight = animate ? Math.max(height, 2) : 0;
    const delay = animate ? index * 50 : 0;
    
    return `
      <div class="perf-bar" style="height: ${initialHeight}%; transition: height 0.6s ease-out ${delay}ms;">
        <div class="perf-bar-tooltip">
          <strong>${monthNames[index]}</strong><br>
          ↑ ${formatElevation(value)} m D+<br>
          <span class="diff-${diffClass}">${diffSign}${formatElevation(diff)} m D+</span>
        </div>
        <span class="perf-bar-label">${monthNames[index]}</span>
      </div>
    `;
  }).join('');

  // Ajouter la ligne d'objectif
  const objectiveLine = `
    <div class="objective-line" style="bottom: ${objectiveHeight}%">
      <span class="objective-label">Obj. ${formatElevation(monthlyTarget)} m D+/mois</span>
    </div>
  `;

  container.innerHTML = barsHTML + objectiveLine;
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ==============================
// RIDGELINE CHART
// ==============================
function calculateHourlyDistribution(data, groupBy = 'sport') {
  const distributions = {};

  // Exclure les activités lissées sur plusieurs jours
  const filteredData = data.filter(activity => !activity._isPartOfMultiDay);

  filteredData.forEach(activity => {
    // Utiliser start_date_local pour avoir l'heure locale de l'athlète
    // Le format est "2025-01-15T08:30:00Z" - on extrait directement HH:MM
    const dateStr = activity.start_date_local || activity.start_date;
    const hourPart = parseInt(dateStr.substring(11, 13));
    const minutePart = parseInt(dateStr.substring(14, 16));
    const hour = hourPart + minutePart / 60;
    const duration = (activity.moving_time || 0) / 3600;

    let key;
    if (groupBy === 'athlete') {
      key = `${getAthleteName(activity.athlete_id)}`;
    } else {
      key = mapSportName(activity.sport_type);
    }

    if (!distributions[key]) {
      distributions[key] = [];
    }

    for (let i = 0; i < duration; i += 0.25) {
      const currentHour = (hour + i) % 24;
      distributions[key].push(currentHour);
    }
  });

  return distributions;
}

export function showRidgelineBySport(data, athleteId, selectedSport = null) {
  const chartDom = document.getElementById('ridgelineChart');
  if (!chartDom) return;

  if (window.ridgelineChart && typeof window.ridgelineChart.dispose === 'function') {
    window.ridgelineChart.dispose();
  }

  window.ridgelineChart = echarts.init(chartDom);

  let filteredData = data;
  if (athleteId) {
    filteredData = filteredData.filter(activity => activity.athlete_id == athleteId);
  }
  if (selectedSport) {
    filteredData = filteredData.filter(activity => activity.sport_type === selectedSport);
  }

  const distributions = calculateHourlyDistribution(filteredData, 'sport');
  const sports = Object.keys(distributions);

  if (sports.length === 0) return;

  const sportVolumes = {};
  sports.forEach(sport => {
    sportVolumes[sport] = distributions[sport].length * 0.25;
  });

  const sortedSports = sports.sort((a, b) => sportVolumes[a] - sportVolumes[b]);

  const series = [];
  const xAxisData = [];
  for (let h = 0; h < 24; h += 0.25) {
    xAxisData.push(h);
  }

  const rawDataBySport = {};
  const allHoursData = {};
  let maxHours = 0;

  sortedSports.forEach((sport) => {
    const hoursData = xAxisData.map((hour) => {
      const hourStart = hour;
      const hourEnd = hour + 0.25;
      const activitiesInSlot = distributions[sport].filter(h => h >= hourStart && h < hourEnd);
      return activitiesInSlot.length * 0.25;
    });

    allHoursData[sport] = hoursData;
    rawDataBySport[sport] = hoursData;

    const sportMax = Math.max(...hoursData);
    if (sportMax > maxHours) maxHours = sportMax;
  });

  const GAP_FACTOR = 0.15;

  sortedSports.forEach((sport, index) => {
    const hoursData = allHoursData[sport];
    const normalizedData = hoursData.map(h => h + (index * (maxHours * GAP_FACTOR)));

    series.push({
      name: sport,
      type: 'line',
      data: normalizedData,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: 2,
        color: getSportColor(sport)
      },
      areaStyle: {
        origin: index * (maxHours * GAP_FACTOR),
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: getSportColor(sport) + 'CC' },
            { offset: 1, color: getSportColor(sport) + '20' }
          ]
        }
      },
      emphasis: { focus: 'series' },
      itemStyle: { color: getSportColor(sport) }
    });
  });

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: athleteId ? `Rythmes — ${getAthleteName(athleteId)}` : 'Rythmes par sport',
      textStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: "'Syne', sans-serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(249, 115, 22, 0.5)', width: 1 }
      },
      formatter: function(params) {
        const hour = params[0].axisValue;
        const hourInt = Math.floor(hour);
        const minutes = Math.round((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        let result = `<strong>${timeStr}</strong><br/>`;
        const dataIndex = params[0].dataIndex;

        params.forEach(param => {
          const sportName = param.seriesName;
          const hours = rawDataBySport[sportName][dataIndex];
          if (hours > 0) {
            const minutesInt = Math.round(hours * 60);
            result += `${param.marker}${sportName}: ${minutesInt}min<br/>`;
          }
        });

        return result;
      }
    },
    legend: {
      data: sortedSports,
      textStyle: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, fontFamily: "'Inter', sans-serif" },
      top: 40,
      left: 'center'
    },
    grid: {
      left: '3%',
      right: '4%',
      top: 90,
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      boundaryGap: false,
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        formatter: value => Math.floor(value) % 2 === 0 && value % 1 === 0 ? Math.floor(value) + 'h' : ''
      },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.04)' } }
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: series
  };

  window.ridgelineChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.ridgelineChart) window.ridgelineChart.resize();
  });
}

export function showRidgelineByAthlete(data, selectedSport = null) {
  const chartDom = document.getElementById('ridgelineChart');
  if (!chartDom) return;

  if (window.ridgelineChart && typeof window.ridgelineChart.dispose === 'function') {
    window.ridgelineChart.dispose();
  }

  window.ridgelineChart = echarts.init(chartDom);

  let filteredData = data;
  if (selectedSport) {
    filteredData = filteredData.filter(activity => activity.sport_type === selectedSport);
  }

  const distributions = calculateHourlyDistribution(filteredData, 'athlete');
  const athletes = Object.keys(distributions);

  if (athletes.length === 0) return;

  const athleteVolumes = {};
  athletes.forEach(athlete => {
    athleteVolumes[athlete] = distributions[athlete].length * 0.25;
  });

  const sortedAthletes = athletes.sort((a, b) => athleteVolumes[a] - athleteVolumes[b]);

  const series = [];
  const xAxisData = [];
  for (let h = 0; h < 24; h += 0.25) {
    xAxisData.push(h);
  }

  const rawDataByAthlete = {};
  const allHoursData = {};
  let maxHours = 0;

  sortedAthletes.forEach((athlete) => {
    const hoursData = xAxisData.map((hour) => {
      const hourStart = hour;
      const hourEnd = hour + 0.25;
      const activitiesInSlot = distributions[athlete].filter(h => h >= hourStart && h < hourEnd);
      return activitiesInSlot.length * 0.25;
    });

    allHoursData[athlete] = hoursData;
    rawDataByAthlete[athlete] = hoursData;

    const athleteMax = Math.max(...hoursData);
    if (athleteMax > maxHours) maxHours = athleteMax;
  });

  const GAP_FACTOR = 0.15;

  sortedAthletes.forEach((athlete, index) => {
    const athleteId = getAthleteIdFromName(athlete);
    const hoursData = allHoursData[athlete];
    const normalizedData = hoursData.map(h => h + (index * (maxHours * GAP_FACTOR)));

    series.push({
      name: athlete,
      type: 'line',
      data: normalizedData,
      smooth: true,
      symbol: 'none',
      lineStyle: {
        width: 2,
        color: getAthleteColor(athleteId)
      },
      areaStyle: {
        origin: index * (maxHours * GAP_FACTOR),
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: getAthleteColor(athleteId) + 'CC' },
            { offset: 1, color: getAthleteColor(athleteId) + '20' }
          ]
        }
      },
      emphasis: { focus: 'series' },
      itemStyle: { color: getAthleteColor(athleteId) }
    });
  });

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: `Rythmes par athlète${selectedSport ? ' — ' + selectedSport : ''}`,
      textStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: "'Syne', sans-serif"
      },
      left: 'center',
      top: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif" },
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(249, 115, 22, 0.5)', width: 1 }
      },
      formatter: function(params) {
        const hour = params[0].axisValue;
        const hourInt = Math.floor(hour);
        const minutes = Math.round((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        let result = `<strong>${timeStr}</strong><br/>`;
        const dataIndex = params[0].dataIndex;

        params.forEach(param => {
          const athleteName = param.seriesName;
          const hours = rawDataByAthlete[athleteName][dataIndex];
          if (hours > 0) {
            const minutesInt = Math.round(hours * 60);
            result += `${param.marker}${athleteName}: ${minutesInt}min<br/>`;
          }
        });

        return result;
      }
    },
    legend: {
      data: sortedAthletes,
      textStyle: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, fontFamily: "'Inter', sans-serif" },
      top: 40,
      left: 'center',
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '4%',
      top: sortedAthletes.length > 5 ? 100 : 90,
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      boundaryGap: false,
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        formatter: value => Math.floor(value) % 2 === 0 && value % 1 === 0 ? Math.floor(value) + 'h' : ''
      },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.04)' } }
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: series
  };

  window.ridgelineChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.ridgelineChart) window.ridgelineChart.resize();
  });
}

// ==============================
// PIE CHART SPORTS
// ==============================
export function showSportPieChart(data) {
  const chartDom = document.getElementById('sportPieChart');
  if (!chartDom) return;

  if (window.sportPieChart && typeof window.sportPieChart.dispose === 'function') {
    window.sportPieChart.dispose();
  }

  window.sportPieChart = echarts.init(chartDom);

  const sportData = {};
  data.forEach(activity => {
    const sport = mapSportName(activity.sport_type);
    sportData[sport] = (sportData[sport] || 0) + (activity.total_elevation_gain|| 0);
  });

  const pieData = Object.entries(sportData)
    .map(([name, value]) => ({
      name,
      value,
      itemStyle: { color: getSportColor(name) }
    }))
    .sort((a, b) => b.value - a.value);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 10, 15, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: { color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: 12 },
      formatter: params => `${params.name}<br/>↑ ${formatElevation(params.value)} m D+ (${params.percent.toFixed(1)}%)`
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#1a1a24',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontFamily: "'Inter', sans-serif"
      },
      labelLine: {
        show: true,
        length: 10,
        length2: 10,
        lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(249, 115, 22, 0.5)'
        },
        label: { fontWeight: 'bold' }
      },
      data: pieData,
      animationType: 'expansion',
      animationDuration: 1500,
      animationEasing: 'cubicOut'
    }]
  };

  window.sportPieChart.setOption(option);

  window.addEventListener('resize', () => {
    if (window.sportPieChart) window.sportPieChart.resize();
  });
}

// ==============================
// MINI RANKING SLIDER
// ==============================
export function showMiniRanking(data) {
  const slider = document.getElementById('miniRankingSlider');
  const dotsContainer = document.getElementById('rankingDots');
  const prevBtn = document.getElementById('rankingPrev');
  const nextBtn = document.getElementById('rankingNext');
  
  if (!slider) return;

  // Calculer les stats par athlète
  const athleteStats = {};
  data.forEach(activity => {
    const id = activity.athlete_id;
    if (!athleteStats[id]) {
      athleteStats[id] = { athlete_id: id, total_elevation: 0 };
    }
    athleteStats[id].total_elevation += activity.total_elevation_gain|| 0;
  });

  const stats = Object.values(athleteStats).sort((a, b) => b.total_elevation - a.total_elevation);
  const maxElevation = stats[0]?.total_elevation || 1;

  // Générer les items
  slider.innerHTML = stats.map((s, index) => {
    const percentage = (s.total_elevation / maxElevation) * 100;
    const positionClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    
    return `
      <div class="mini-rank-item">
        <div class="mini-rank-position ${positionClass}">${index + 1}</div>
        <div class="mini-rank-info">
          <div class="mini-rank-name" style="color: ${getAthleteColor(s.athlete_id)}">${getAthleteName(s.athlete_id)}</div>
          <div class="mini-rank-value">${formatElevation(s.total_elevation)} m D+</div>
        </div>
        <div class="mini-rank-bar">
          <div class="mini-rank-bar-fill" style="width: ${percentage}%; background: ${getAthleteColor(s.athlete_id)}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Pagination par groupe de 4
  const itemsPerPage = 4;
  const totalPages = Math.ceil(stats.length / itemsPerPage);
  let currentPage = 0;

  // Générer les dots
  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from({ length: totalPages }, (_, i) => 
      `<div class="ranking-dot ${i === 0 ? 'active' : ''}" data-page="${i}"></div>`
    ).join('');

    dotsContainer.querySelectorAll('.ranking-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        currentPage = parseInt(dot.dataset.page);
        updateSlider();
      });
    });
  }

  function updateSlider() {
    const itemWidth = 188; // min-width + gap
    slider.scrollTo({ left: currentPage * itemsPerPage * itemWidth, behavior: 'smooth' });
    
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.ranking-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentPage);
      });
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentPage = Math.max(0, currentPage - 1);
      updateSlider();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage = Math.min(totalPages - 1, currentPage + 1);
      updateSlider();
    });
  }
}

// ==============================
// CHORD DIAGRAM (SOCIAL GRAPH) - VERSION MODIFIÉE
// ==============================

let precomputedGroups = null;

export async function loadGroupActivities() {
  if (precomputedGroups) return precomputedGroups;

  // Utiliser la fonction avec cache
  precomputedGroups = await loadGroupActivitiesWithCache();
  return precomputedGroups;
}
// Fonction principale pour afficher le Chord Diagram
export function showSocialGraph(data, groupActivities = null) {
  const container = document.getElementById('socialGraph');
  if (!container) return;

  container.innerHTML = '';

  // Utiliser les données pré-calculées si disponibles
  const groups = groupActivities || precomputedGroups || [];

  if (groups.length === 0) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.5);">Aucune sortie de groupe détectée</div>';
    return;
  }

  // Filtrer les activités "Climb" et mapper correctement les sports
  const filteredGroups = groups.filter(g => {
    const sport = g.sport_type || g.sport;
    return sport !== 'Climb' && sport !== 'RockClimbing';
  });

  // Collecter les athlètes actifs (ceux avec des sorties de groupe)
  const athleteSet = new Set();
  filteredGroups.forEach(g => g.athletes.forEach(id => athleteSet.add(id)));
  const athleteIds = Array.from(athleteSet);
  const n = athleteIds.length;

  // Créer une matrice pour la somme des D+ (pour dimensionner les arcs)
  const totalMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
  const athleteIndex = new Map(athleteIds.map((id, i) => [id, i]));

  // Stocker chaque activité individuellement pour créer des ribbons séparés
  const individualLinks = [];
  const sportsUsed = new Set();

  filteredGroups.forEach(g => {
    // Mapper correctement les sports
    let sportCat = g.sport_category || mapSportName(g.sport_type || g.sport);

    // S'assurer que "Ski" est bien mappé à "Ski mountaineering"
    if (sportCat === 'Ski' || g.sport === 'BackcountrySki' || g.sport === 'NordicSki') {
      sportCat = 'Ski mountaineering';
    }

    sportsUsed.add(sportCat);

    // Pour chaque paire d'athlètes dans le groupe
    for (let i = 0; i < g.athletes.length; i++) {
      for (let j = i + 1; j < g.athletes.length; j++) {
        const a1 = g.athletes[i];
        const a2 = g.athletes[j];
        const idx1 = athleteIndex.get(a1);
        const idx2 = athleteIndex.get(a2);

        if (idx1 !== undefined && idx2 !== undefined) {
          // Ajouter le D+ à la matrice totale
          totalMatrix[idx1][idx2] += g.elevation;
          totalMatrix[idx2][idx1] += g.elevation;

          // Stocker chaque activité comme un lien individuel
          individualLinks.push({
            source: idx1,
            target: idx2,
            value: g.elevation,
            sport: sportCat,
            name: g.name,
            date: g.date,
            athleteIds: [a1, a2],
            // Stocker les IDs des activités pour choisir un nom arbitrairement
            activityIds: g.activity_ids || []
          });
        }
      }
    }
  });

  // Dimensions
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;
  const outerRadius = Math.min(width, height) * 0.4;
  const innerRadius = outerRadius - 25;

  // Créer le SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width/2},${height/2})`);

  // Tooltip
  const tooltip = d3.select(container)
    .append('div')
    .style('position', 'fixed')
    .style('background', 'rgba(10, 10, 15, 0.98)')
    .style('border', '1px solid rgba(255,255,255,0.15)')
    .style('border-radius', '10px')
    .style('padding', '12px 16px')
    .style('pointer-events', 'none')
    .style('z-index', '1000')
    .style('font-size', '12px')
    .style('color', '#fff')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.5)')
    .style('opacity', 0)
    .style('transition', 'opacity 0.15s')
    .style('max-width', '300px');

  // Créer le layout chord avec la matrice totale (pour les arcs)
  const chord = d3.chord()
    .padAngle(0.05)
    .sortSubgroups(d3.descending);

  const chords = chord(totalMatrix);

  // Arc pour les groupes (arcs extérieurs)
  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // Fonction pour créer un ribbon personnalisé pour chaque activité
  const ribbon = d3.ribbon()
    .radius(innerRadius - 2);

  // État de sélection
  let selectedIndex = null;

  // Fonction highlight
  function highlightAthlete(index) {
    selectedIndex = index;
    tooltip.style('opacity', 0);

    // Atténuer les arcs non connectés
    groupArcs.transition().duration(200)
      .style('opacity', d => {
        const isConnected = individualLinks.some(link =>
          link.source === index || link.target === index
        );
        return (d.index === index || isConnected) ? 1 : 0.15;
      });

    // Atténuer les ribbons non connectés
    ribbons.transition().duration(200)
      .style('opacity', d => (d.source === index || d.target === index) ? 0.85 : 0.03);

    // Atténuer les labels
    labels.transition().duration(200)
      .style('opacity', d => {
        const isConnected = individualLinks.some(link =>
          link.source === index || link.target === index
        );
        return (d.index === index || isConnected) ? 1 : 0.2;
      });
  }

  function resetHighlight() {
    selectedIndex = null;

    groupArcs.transition().duration(200).style('opacity', 0.9);
    ribbons.transition().duration(200).style('opacity', 0.65);
    labels.transition().duration(200).style('opacity', 1);
  }

  // Dessiner les ribbons individuels (une ligne par activité)
  // On groupe d'abord les liens par paire pour calculer les positions
  const linksByPair = new Map();
  individualLinks.forEach(link => {
    const pairKey = `${Math.min(link.source, link.target)}-${Math.max(link.source, link.target)}`;
    if (!linksByPair.has(pairKey)) {
      linksByPair.set(pairKey, []);
    }
    linksByPair.get(pairKey).push(link);
  });

  // Préparer les données de ribbons avec offsets
  const ribbonData = [];
  linksByPair.forEach((links, pairKey) => {
    const [sourceIdx, targetIdx] = pairKey.split('-').map(Number);

    // Trouver les groupes correspondants
    const sourceGroup = chords.groups.find(g => g.index === sourceIdx);
    const targetGroup = chords.groups.find(g => g.index === targetIdx);

    if (!sourceGroup || !targetGroup) return;

    // Calculer la largeur d'angle totale pour cette paire
    const totalValue = links.reduce((sum, l) => sum + l.value, 0);
    const sourceAngleWidth = (sourceGroup.endAngle - sourceGroup.startAngle) * (totalValue / sourceGroup.value);
    const targetAngleWidth = (targetGroup.endAngle - targetGroup.startAngle) * (totalValue / targetGroup.value);

    // Calculer l'offset de départ (centré dans la section de la paire)
    let sourceOffset = sourceGroup.startAngle;
    let targetOffset = targetGroup.startAngle;

    // Pour chaque lien, créer un ribbon
    links.forEach(link => {
      const linkSourceWidth = sourceAngleWidth * (link.value / totalValue);
      const linkTargetWidth = targetAngleWidth * (link.value / totalValue);

      ribbonData.push({
        ...link,
        sourceStartAngle: sourceOffset,
        sourceEndAngle: sourceOffset + linkSourceWidth,
        targetStartAngle: targetOffset,
        targetEndAngle: targetOffset + linkTargetWidth
      });

      sourceOffset += linkSourceWidth;
      targetOffset += linkTargetWidth;
    });
  });

  const ribbons = svg.append('g')
    .selectAll('path')
    .data(ribbonData)
    .join('path')
    .attr('d', d => {
      return ribbon({
        source: {
          startAngle: d.sourceStartAngle,
          endAngle: d.sourceEndAngle
        },
        target: {
          startAngle: d.targetStartAngle,
          endAngle: d.targetEndAngle
        }
      });
    })
    .attr('fill', d => getSportColor(d.sport))
    .attr('stroke', 'rgba(255,255,255,0.1)')
    .attr('stroke-width', 0.5)
    .style('opacity', 0.65)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      if (selectedIndex !== null) return;

      d3.select(this)
        .style('opacity', 0.95)
        .attr('stroke-width', 1);

      const a1 = athleteIds[d.source];
      const a2 = athleteIds[d.target];
      const date = new Date(d.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      // Afficher l'infobulle avec : Date, D+, Type d'activité, Nom de l'activité
      tooltip.html(`
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:#f97316;">
          ${date}
        </div>
        <div style="font-size:14px;margin-bottom:6px;font-weight:500;">
          ${d.name}
        </div>
        <div style="display:flex;gap:12px;font-size:11px;color:rgba(255,255,255,0.8);">
          <div>
            <span style="color:rgba(255,255,255,0.5);">Sport:</span> ${d.sport}
          </div>
          <div>
            <span style="color:rgba(255,255,255,0.5);">D+:</span> ${formatElevation(d.value)} m D+
          </div>
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);">
          ${getAthleteName(a1)} · ${getAthleteName(a2)}
        </div>
      `)
      .style('left', (event.clientX + 15) + 'px')
      .style('top', (event.clientY - 10) + 'px')
      .style('opacity', 1);
    })
    .on('mouseout', function() {
      if (selectedIndex !== null) return;
      d3.select(this)
        .style('opacity', 0.65)
        .attr('stroke-width', 0.5);
      tooltip.style('opacity', 0);
    });

  // Dessiner les arcs (athlètes)
  const groupArcs = svg.append('g')
    .selectAll('path')
    .data(chords.groups)
    .join('path')
    .attr('d', arc)
    .attr('fill', d => getAthleteColor(athleteIds[d.index]))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .style('opacity', 0.9)
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      event.stopPropagation();
      if (selectedIndex === d.index) {
        resetHighlight();
      } else {
        highlightAthlete(d.index);
      }
    })
    .on('mouseover', function(event, d) {
      if (selectedIndex !== null) return;

      d3.select(this).style('opacity', 1);

      const athleteId = athleteIds[d.index];
      const groupCount = filteredGroups.filter(g => g.athletes.includes(athleteId)).length;
      const partners = new Set();
      let totalElev = 0;

      filteredGroups.forEach(g => {
        if (g.athletes.includes(athleteId)) {
          g.athletes.forEach(id => { if (id !== athleteId) partners.add(id); });
          totalElev += g.elevation;
        }
      });

      tooltip.html(`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="width:14px;height:14px;border-radius:50%;background:${getAthleteColor(athleteId)};"></span>
          <span style="font-weight:600;font-size:14px;">${getAthleteName(athleteId)}</span>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);">
          ${groupCount} sortie${groupCount > 1 ? 's' : ''} en groupe<br>
          ${partners.size} partenaire${partners.size > 1 ? 's' : ''}<br>
          ↑ ${formatElevation(totalElev)} m D+ en groupe
        </div>
        <div style="margin-top:8px;font-size:10px;color:rgba(255,255,255,0.4);">
          Cliquer pour filtrer
        </div>
      `)
      .style('left', (event.clientX + 15) + 'px')
      .style('top', (event.clientY - 10) + 'px')
      .style('opacity', 1);
    })
    .on('mouseout', function() {
      if (selectedIndex !== null) return;
      d3.select(this).style('opacity', 0.9);
      tooltip.style('opacity', 0);
    });

  // Labels des athlètes
  const labels = svg.append('g')
    .selectAll('text')
    .data(chords.groups)
    .join('text')
    .attr('dy', '.35em')
    .attr('transform', d => {
      const angle = (d.startAngle + d.endAngle) / 2;
      const rotate = angle * 180 / Math.PI - 90;
      const flip = angle > Math.PI;
      return `rotate(${rotate}) translate(${outerRadius + 10}) ${flip ? 'rotate(180)' : ''}`;
    })
    .attr('text-anchor', d => {
      const angle = (d.startAngle + d.endAngle) / 2;
      return angle > Math.PI ? 'end' : 'start';
    })
    .attr('fill', '#fff')
    .attr('font-size', '11px')
    .attr('font-weight', '500')
    .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')
    .text(d => getAthleteName(athleteIds[d.index]));

  // Clic sur le fond pour reset
  d3.select(container).select('svg').on('click', () => {
    resetHighlight();
    tooltip.style('opacity', 0);
  });

  // Légende et stats
  generateSocialLegend(Array.from(sportsUsed));
  generateChordStats(athleteIds, individualLinks, filteredGroups);
}

function generateSocialLegend(sports) {
  const legendContainer = document.getElementById('socialLegendItems');
  if (!legendContainer) return;

  if (!sports || sports.length === 0) {
    legendContainer.innerHTML = '<span style="color:rgba(255,255,255,0.5)">Aucune sortie de groupe détectée</span>';
    return;
  }

  legendContainer.innerHTML = sports.map(sport => `
    <div class="social-legend-item">
      <span class="social-legend-color" style="background: ${getSportColor(sport)}"></span>
      <span class="social-legend-label">${sport}</span>
    </div>
  `).join('');
}

function generateChordStats(athleteIds, individualLinks, groups) {
  const statsContainer = document.getElementById('socialStats');
  if (!statsContainer) return;

  const totalGroups = groups.length;
  const totalElev = individualLinks.reduce((sum, l) => sum + l.value, 0);

  // Trouver le duo le plus actif (par nombre d'activités)
  const pairCounts = new Map();
  individualLinks.forEach(link => {
    const pairKey = [link.athleteIds[0], link.athleteIds[1]].sort().join('-');
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
  });

  let topPair = null;
  let topCount = 0;
  pairCounts.forEach((count, key) => {
    if (count > topCount) {
      topCount = count;
      topPair = key;
    }
  });

  let topPairNames = '';
  if (topPair) {
    const [a1, a2] = topPair.split('-').map(Number);
    topPairNames = `${getAthleteName(a1)} & ${getAthleteName(a2)}`;
  }

  // Athlète le plus social
  const socialCounts = {};
  groups.forEach(g => {
    g.athletes.forEach(id => {
      socialCounts[id] = (socialCounts[id] || 0) + 1;
    });
  });
  const mostSocial = Object.entries(socialCounts).sort((a, b) => b[1] - a[1])[0];

  // Groupes de 3+
  const bigGroups = groups.filter(g => g.athletes.length >= 3).length;

  statsContainer.innerHTML = `
    <h4>Statistiques</h4>
    <div class="social-stat-item">
      <span>Sorties en groupe</span>
      <span class="social-stat-value">${totalGroups}</span>
    </div>
    <div class="social-stat-item">
      <span>D+ en groupe</span>
      <span class="social-stat-value">${formatElevation(totalElev)} m D+</span>
    </div>
    ${bigGroups > 0 ? `
    <div class="social-stat-item">
      <span>Sorties à 3+</span>
      <span class="social-stat-value">${bigGroups}</span>
    </div>
    ` : ''}
    ${topPairNames ? `
    <div class="social-stat-item">
      <span>Duo le + actif</span>
      <span class="social-stat-value" style="font-size: 0.65rem">${topPairNames}</span>
    </div>
    ` : ''}
    ${mostSocial ? `
    <div class="social-stat-item">
      <span>Le + social</span>
      <span class="social-stat-value">${getAthleteName(Number(mostSocial[0]))}</span>
    </div>
    ` : ''}
  `;
}
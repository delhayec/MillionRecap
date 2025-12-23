// statsDisplay.js
function updateStats(filteredData) {
  if (!filteredData || filteredData.length === 0) {
    document.getElementById('totalElevation').textContent = '0 m';
    document.getElementById('totalActivities').textContent = '0';
    document.getElementById('totalDistance').textContent = '0 km';
    document.getElementById('totalTime').textContent = '0 h';
    document.getElementById('bestDay').textContent = '-';
    document.getElementById('bestWeek').textContent = '-';
    return;
  }

  // Calcul des statistiques de base
  const totalElevation = filteredData.reduce((sum, activity) => sum + (activity.elevation_gain_m || 0), 0);
  const totalActivities = filteredData.length;
  const totalDistance = (filteredData.reduce((sum, activity) => sum + (activity.distance_m || 0), 0) / 1000).toFixed(2);
  const totalTime = Math.round(filteredData.reduce((sum, activity) => sum + (activity.moving_time_s || 0), 0) / 3600);

  // Mise à jour des stats de base
  document.getElementById('totalElevation').textContent = `${totalElevation} m`;
  document.getElementById('totalActivities').textContent = totalActivities;
  document.getElementById('totalDistance').textContent = `${totalDistance} km`;
  document.getElementById('totalTime').textContent = `${totalTime} h`;

  // Calcul de la meilleure journée
  const bestDay = findBestDay(filteredData);
  document.getElementById('bestDay').textContent = bestDay ?
    `${bestDay.date} (${bestDay.elevation} m)` : '-';

  // Calcul de la meilleure semaine
  const bestWeek = findBestWeek(filteredData);
  document.getElementById('bestWeek').textContent = bestWeek ?
    `${bestWeek.period} (${bestWeek.elevation} m)` : '-';
}

// Fonction pour trouver la meilleure journée
function findBestDay(data) {
  if (!data || data.length === 0) return null;

  const dailyElevation = {};
  data.forEach(activity => {
    if (!activity.date) return;
    const date = activity.date.split('T')[0];
    dailyElevation[date] = (dailyElevation[date] || 0) + (activity.elevation_gain_m || 0);
  });

  let bestDate = null;
  let bestElevation = 0;
  for (const date in dailyElevation) {
    if (dailyElevation[date] > bestElevation) {
      bestElevation = dailyElevation[date];
      bestDate = date;
    }
  }

  if (!bestDate) return null;

  const dateObj = new Date(bestDate);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = formatDate(dateObj, options);

  return {
    date: formattedDate,
    elevation: bestElevation
  };
}

// Fonction pour trouver la meilleure semaine
function findBestWeek(data) {
  if (!data || data.length === 0) return null;

  const weeklyElevation = {};
  const weeklyDates = {};

  data.forEach(activity => {
    if (!activity.date) return;

    const date = new Date(activity.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-${week}`;

    weeklyElevation[weekKey] = (weeklyElevation[weekKey] || 0) + (activity.elevation_gain_m || 0);

    if (!weeklyDates[weekKey]) {
      weeklyDates[weekKey] = { min: date, max: date };
    } else {
      if (date < weeklyDates[weekKey].min) weeklyDates[weekKey].min = date;
      if (date > weeklyDates[weekKey].max) weeklyDates[weekKey].max = date;
    }
  });

  let bestWeekKey = null;
  let bestElevation = 0;
  for (const weekKey in weeklyElevation) {
    if (weeklyElevation[weekKey] > bestElevation) {
      bestElevation = weeklyElevation[weekKey];
      bestWeekKey = weekKey;
    }
  }

  if (!bestWeekKey) return null;

  const [year, week] = bestWeekKey.split('-');
  const startDate = weeklyDates[bestWeekKey].min;
  const endDate = weeklyDates[bestWeekKey].max;

  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedStartDate = formatDate(startDate, options);
  const formattedEndDate = formatDate(endDate, options);

  return {
    period: `${formattedStartDate} - ${formattedEndDate}`,
    elevation: bestElevation
  };
}

// Fonction pour formater une date avec "1er" au lieu de "1"
function formatDate(date, options) {
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'long' });
  const year = date.getFullYear();

  let dayStr = day.toString();
  if (day === 1) dayStr = "1er";

  return `${dayStr} ${month} ${year}`;
}

// Fonction pour obtenir le numéro de la semaine
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export { updateStats };

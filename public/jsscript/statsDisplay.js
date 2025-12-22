// Calculer et afficher les statistiques globales
function updateStats(filteredData) {
  const totalElevation = filteredData.reduce((sum, activity) => sum + (activity.elevation_gain_m || 0), 0);
  const totalActivities = filteredData.length;
  const totalDistance = (filteredData.reduce((sum, activity) => sum + (activity.distance_m || 0), 0) / 1000).toFixed(2);
  const totalTime = Math.round(filteredData.reduce((sum, activity) => sum + (activity.moving_time_s || 0), 0) / 3600);

  document.getElementById('totalElevation').textContent = `${totalElevation} m`;
  document.getElementById('totalActivities').textContent = totalActivities;
  document.getElementById('totalDistance').textContent = `${totalDistance} km`;
  document.getElementById('totalTime').textContent = `${totalTime} h`;
}

export { updateStats };

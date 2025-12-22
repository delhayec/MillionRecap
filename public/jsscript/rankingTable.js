// rankingTable.js
function showRankingTable(data) {
  // Masque la carte
  document.getElementById('mapContainer').style.display = 'none';
  // Affiche le conteneur du tableau
  document.getElementById('rankingTableContainer').style.display = 'block';

  // Calcule les statistiques par athlète
  const athletesStats = {};
  data.forEach(activity => {
    const athleteId = activity.athlete_id;
    if (!athletesStats[athleteId]) {
      athletesStats[athleteId] = {
        athlete_id: athleteId,
        total_elevation: 0,
        activity_count: 0,
        total_distance: 0,
        total_time: 0,
        name: `Athlète ${athleteId}`
      };
    }
    athletesStats[athleteId].total_elevation += activity.elevation_gain_m || 0;
    athletesStats[athleteId].activity_count += 1;
    athletesStats[athleteId].total_distance += activity.distance_m || 0;
    athletesStats[athleteId].total_time += activity.moving_time_s || 0;
  });

  // Convertit en tableau et calcule les ratios
  const athletesArray = Object.values(athletesStats).map(stat => ({
    ...stat,
    total_distance_km: (stat.total_distance / 1000).toFixed(2),
    total_time_h: (stat.total_time / 3600).toFixed(2),
    elevation_per_distance: stat.total_distance > 0 ? (stat.total_elevation / (stat.total_distance / 1000)).toFixed(2) : 0,
    elevation_per_time: stat.total_time > 0 ? (stat.total_elevation / (stat.total_time / 3600)).toFixed(2) : 0,
    elevation_per_activity: (stat.total_elevation / stat.activity_count).toFixed(2)
  }));

  // Trie par dénivelé total par défaut
  athletesArray.sort((a, b) => b.total_elevation - a.total_elevation);

  // Remplit le tableau
  const tableBody = document.getElementById('rankingTableBody');
  tableBody.innerHTML = '';
  athletesArray.forEach(athlete => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${athlete.name}</td>
      <td>${athlete.total_elevation.toFixed(0)}</td>
      <td>${athlete.activity_count}</td>
      <td>${athlete.total_distance_km}</td>
      <td>${athlete.total_time_h}</td>
      <td>${athlete.elevation_per_distance}</td>
      <td>${athlete.elevation_per_time}</td>
      <td>${athlete.elevation_per_activity}</td>
    `;
    tableBody.appendChild(row);
  });

  // Ajoute les écouteurs pour le tri
  setupSorting(athletesArray);
}

function setupSorting(athletesArray) {
  const headers = document.querySelectorAll('#rankingTable th[data-sort]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const sortKey = header.getAttribute('data-sort');
      const currentSort = header.getAttribute('data-order') || 'none';

      // Réinitialise tous les en-têtes
      headers.forEach(h => {
        h.removeAttribute('data-order');
        h.classList.remove('sorted-asc', 'sorted-desc');
      });

      // Trie les données
      let newOrder = 'asc';
      if (currentSort === 'asc') newOrder = 'desc';
      else if (currentSort === 'desc') newOrder = 'none';

      if (newOrder !== 'none') {
        header.setAttribute('data-order', newOrder);
        header.classList.add(`sorted-${newOrder}`);

        athletesArray.sort((a, b) => {
          // Cas particulier pour elevation_per_*
          if (sortKey.startsWith('elevation_per')) {
            const valA = parseFloat(a[sortKey]);
            const valB = parseFloat(b[sortKey]);
            return newOrder === 'asc' ? valA - valB : valB - valA;
          }
          // Cas général
          return newOrder === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
        });

        // Met à jour le tableau
        const tableBody = document.getElementById('rankingTableBody');
        tableBody.innerHTML = '';
        athletesArray.forEach(athlete => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${athlete.name}</td>
            <td>${athlete.total_elevation.toFixed(0)}</td>
            <td>${athlete.activity_count}</td>
            <td>${athlete.total_distance_km}</td>
            <td>${athlete.total_time_h}</td>
            <td>${athlete.elevation_per_distance}</td>
            <td>${athlete.elevation_per_time}</td>
            <td>${athlete.elevation_per_activity}</td>
          `;
          tableBody.appendChild(row);
        });
      }
    });
  });
}

export { showRankingTable };

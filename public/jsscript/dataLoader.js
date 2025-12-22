// Charger les données
async function loadData() {
  const response = await fetch('data/activities_2025.json');
  const data = await response.json();
  console.log("Données chargées :", data);
  return data;
}

export { loadData };

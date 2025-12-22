// Palette de couleurs
const customColors = [
  '#938bb7', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
  '#F59E0B', '#EAB308', '#84CC16', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#00619a'
];

// Mapping des couleurs par athlète
const athleteColors = {};

// Obtenir une couleur persistante par athlète
function getAthleteColor(athleteId) {
  if (!athleteColors[athleteId]) {
    athleteColors[athleteId] = customColors[Object.keys(athleteColors).length % customColors.length];
  }
  return athleteColors[athleteId];
}

// Générer tous les jours de l'année
function generateAllDays(year) {
  const allDays = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDays.push(new Date(d).toISOString().split('T')[0]);
  }
  return allDays;
}

export { getAthleteColor, generateAllDays, athleteColors };

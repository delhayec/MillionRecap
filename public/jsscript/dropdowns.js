// dropdowns.js
function fillAthleteSelect(data) {
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

export { fillAthleteSelect };

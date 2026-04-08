const muscleMapping = {
  'abdominals': 'Abdominales',
  'adductors': 'Aductores',
  'abductors': 'Abductores',
  'biceps': 'Bíceps',
  'calves': 'Gemelos',
  'chest': 'Pecho',
  'forearms': 'Antebrazos',
  'glutes': 'Glúteos',
  'hamstrings': 'Isquios',
  'lats': 'Dorsales',
  'lower back': 'Lumbar',
  'middle back': 'Espalda Media',
  'neck': 'Cuello',
  'quadriceps': 'Cuádriceps',
  'shoulders': 'Hombros',
  'traps': 'Trapecios',
  'triceps': 'Tríceps'
};

const equipmentMapping = {
  'barbell': 'Barra',
  'dumbbell': 'Mancuerna',
  'body only': 'Peso corporal',
  'machine': 'Máquina',
  'cable': 'Polea',
  'kettlebells': 'Kettlebell',
  'bands': 'Bandas',
  'medicine ball': 'Balón medicinal',
  'exercise ball': 'Pelota de ejercicio',
  'e-z curl bar': 'Barra Z',
  'foam roll': 'Rodillo de espuma',
  'other': 'Otro'
};

const categoryMapping = {
  'strength': 'Fuerza',
  'stretching': 'Estiramiento',
  'plyometrics': 'Pliometría',
  'strongman': 'Strongman',
  'powerlifting': 'Powerlifting',
  'cardio': 'Cardio',
  'olympic weightlifting': 'Halterofilia'
};

const wordsMapping = {
  'Bench Press': 'Press de Banca',
  'Incline': 'Inclinado',
  'Decline': 'Declinado',
  'Squat': 'Sentadilla',
  'Deadlift': 'Peso Muerto',
  'Bicep Curl': 'Curl de Bíceps',
  'Tricep Extension': 'Extensión de Tríceps',
  'Shoulder Press': 'Press de Hombros',
  'Lateral Raise': 'Elevación Lateral',
  'Front Raise': 'Elevación Frontal',
  'Bent Over Row': 'Remo con Barra',
  'Lat Pulldown': 'Jalón al Pecho',
  'Leg Extension': 'Extensión de Pierna',
  'Leg Curl': 'Curl de Pierna',
  'Leg Press': 'Prensa de Piernas',
  'Push Up': 'Flexiones',
  'Pull Up': 'Dominadas',
  'Dips': 'Fondos',
  'Crunch': 'Abdominales',
  'Plank': 'Plancha',
  'Lunge': 'Zancada',
  'Fly': 'Aperturas',
  'Barbell': 'con Barra',
  'Dumbbell': 'con Mancuerna',
  'Cable': 'en Polea',
  'Machine': 'en Máquina',
  'Seated': 'Sentado',
  'Standing': 'de Pie',
  'Romanian': 'Rumano',
  'Calf Raise': 'Elevación de Gemelos',
  'Face Pull': 'Face Pull',
  'Russian Twist': 'Giro Ruso',
  'Hammer': 'Martillo',
  'Preacher': 'Predicador',
  'Skullcrusher': 'Press Francés',
  'Military Press': 'Press Militar'
};

function translateName(name) {
  let translated = name;
  for (const [eng, esp] of Object.entries(wordsMapping)) {
    const regex = new RegExp(`\\b${eng}\\b`, 'gi');
    translated = translated.replace(regex, esp);
  }
  return translated;
}

async function generateSQL() {
  const response = await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json');
  const exercises = await response.json();

  let sql = `-- SCRIP PARA POBLAR EL CATÁLOGO DE EJERCICIOS (800+ EJERCICIOS TRADUCIDOS)\n`;
  sql += `DELETE FROM catalogo_ejercicios;\n`; // Limpiar antes de poblar de nuevo
  sql += `INSERT INTO catalogo_ejercicios (id, nombre, musculo_principal, equipamiento, categoria) VALUES \n`;

  const values = exercises.map(ex => {
    const muscle = muscleMapping[ex.primaryMuscles[0]] || ex.primaryMuscles[0];
    const equip = equipmentMapping[ex.equipment] || ex.equipment;
    const cat = categoryMapping[ex.category] || ex.category;
    
    // Traducir nombre
    let translatedName = translateName(ex.name);
    
    // Escapar comillas simples
    const name = translatedName.replace(/'/g, "''");
    
    return `('${ex.id}', '${name}', '${muscle}', '${equip}', '${cat}')`;
  });

  sql += values.join(',\n') + ';';
  
  console.log(sql);
}

generateSQL();

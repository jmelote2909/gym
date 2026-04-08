import re
import os

known_muscles = {
    "pecho": "Pecho",
    "biceps": "Bíceps",
    "bíceps": "Bíceps",
    "isquiotibiales": "Isquiotibiales",
    "isquitibiales": "Isquiotibiales",
    "cuadriceps": "Cuádriceps",
    "cuádriceps": "Cuádriceps",
    "hombro": "Hombros",
    "hombros": "Hombros",
    "abdominales": "Abdominales",
    "cardio": "Cardio",
    "antebrazos": "Antebrazos",
    "trap": "Trapecio",
    "trapecio": "Trapecio",
    "gluteos": "Glúteos",
    "glúteos": "Glúteos",
    "dorsales": "Dorsales",
    "aductores": "Aductores",
    "adductores": "Aductores",
    "triceps": "Tríceps",
    "tríceps": "Tríceps",
    "espalda superior": "Espalda Superior",
    "espalda baja": "Espalda Baja",
    "cuerpo entero": "Cuerpo Entero",
    "gemelos": "Gemelos",
    "otro": "Otro",
    "suadriceps": "Cuádriceps"
}

def generate_id(name):
    s = name.lower()
    # Normalize Spanish characters
    accents = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'}
    for k, v in accents.items():
        s = s.replace(k, v)
    s = re.sub(r'[^a-z0-0\s]', '', s)
    s = s.strip().replace(' ', '_')
    return s

def parse_line(line):
    line = line.strip()
    if not line: return None
    
    # Check for equipment
    eq_match = re.search(r'\(.*?\)', line)
    equipment = eq_match.group(0).strip('()') if eq_match else ""
    
    # Remove parentheses part from name if present
    cleaned_line = line
    if eq_match:
        name_before = line[:eq_match.start()].strip()
        name_after = line[eq_match.end():].strip()
        cleaned_line = (name_before + " " + name_after).strip()
    
    # Muscle detection from the end
    muscle = ""
    name_only = cleaned_line
    # Sort keys by length descending to match multi-word muscles first
    sorted_muscle_keys = sorted(known_muscles.keys(), key=len, reverse=True)
    
    for m in sorted_muscle_keys:
        if cleaned_line.lower().endswith(m.lower()):
            muscle = known_muscles[m]
            name_only = cleaned_line[:-len(m)].strip()
            break
            
    if not muscle:
        parts = cleaned_line.rsplit(' ', 1)
        name_only = parts[0]
        muscle = parts[1].capitalize() if len(parts) > 1 else ""
        
    return {
        "id": generate_id(name_only if name_only else cleaned_line),
        "nombre": name_only if name_only else cleaned_line,
        "equipamiento": equipment,
        "musculo_principal": muscle,
        "categoria": muscle
    }

def main():
    input_file = "ejercicios.txt"
    output_file = "supabase/populate_catalog.sql"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    results = []
    for line in lines:
        p = parse_line(line)
        if p: results.append(p)

    # Handle duplicate IDs
    seen = {}
    for r in results:
        base_id = r['id']
        if not base_id: base_id = "unknown"
        if base_id in seen:
            seen[base_id] += 1
            r['id'] = f"{base_id}_{seen[base_id]}"
        else:
            seen[base_id] = 1

    # Generate SQL
    sql = "-- POBLAR CATALOGO DE EJERCICIOS\n"
    sql += "DELETE FROM catalogo_ejercicios;\n\n"
    sql += "INSERT INTO catalogo_ejercicios (id, nombre, musculo_principal, equipamiento, categoria) VALUES\n"

    def escape(s):
        return s.replace("'", "''")

    values = []
    for r in results:
        val = f"('{escape(r['id'])}', '{escape(r['nombre'])}', '{escape(r['musculo_principal'])}', '{escape(r['equipamiento'])}', '{escape(r['categoria'])}')"
        values.append(val)

    sql += ",\n".join(values) + ";\n"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(sql)
    
    print(f"Success: {output_file} generated with {len(results)} exercises.")

if __name__ == "__main__":
    main()

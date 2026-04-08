import re
import os

replacements = {
    r'\bsuadriceps\b': 'cuádriceps',
    r'\bcuadriceps\b': 'cuádriceps',
    r'\bmacuerna\b': 'mancuerna',
    r'\bcaridio\b': 'cardio',
    r'\bmaquina\b': 'máquina',
    r'\bisquitibiales\b': 'isquiotibiales',
    r'\bcelan\b': 'clean',
    r'\btion\b': 'tirón',
    r'\btrion\b': 'tirón',
    r'\bbicileta\b': 'bicicleta',
    r'\bball samlams\b': 'ball slams',
    r'\bepatorrilla\b': 'pantorrilla',
    r'\btriceps\b': 'tríceps',
    r'\bbiceps\b': 'bíceps',
    r'\bgluteos\b': 'glúteos',
    r'\bgluteo\b': 'glúteo',
    r'\babdominales\b': 'abdominales', # just to be safe
    r'\bHollow RockAbdominales\b': 'Hollow Rock Abdominales',
    r'\bchin up\b': 'Chin Up',
    r'\bjerk\b': 'Jerk',
    r'\bsnatch\b': 'Snatch',
    r'\bclean and jerk\b': 'Clean and Jerk',
    r'\bhiit\b': 'HIIT',
    r'\bpec deck\b': 'Pec Deck',
    r'\bsmith\b': 'Smith',
}

def fix_line(line):
    line = line.strip()
    if not line: return ""
    
    # Apply replacements (case insensitive for searching)
    corrected = line
    for pattern, replacement in replacements.items():
        corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)
    
    # Ensure first letter is capitalized
    if corrected:
        corrected = corrected[0].upper() + corrected[1:]
        
    return corrected

def main():
    file_path = "ejercicios.txt"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    fixed_lines = [fix_line(l) for l in lines]
    
    # Filtering empty lines but keeping the content
    content = "\n".join(fixed_lines)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"Success: {file_path} corrected.")

if __name__ == "__main__":
    main()


from collections import Counter

file_path = r'c:\Users\Usuario\Desktop\gym-app\ejercicios.txt'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = [line.strip() for line in f if line.strip()]

# Find duplicates ignoring case
counts = Counter(line.lower() for line in lines)
duplicates = {line: count for line, count in counts.items() if count > 1}

if not duplicates:
    print("No se encontraron ejercicios repetidos (al menos no exactos).")
else:
    print("Ejercicios repetidos (ignorando mayúsculas/minúsculas):")
    for line, count in duplicates.items():
        # Find the original casing for display
        original_versions = set(l for l in lines if l.lower() == line)
        print(f"- '{', '.join(original_versions)}' (aparece {count} veces)")

# Also check for very similar ones (optional, but good for UX)
# For now, let's stick to exact matches after lowercasing.

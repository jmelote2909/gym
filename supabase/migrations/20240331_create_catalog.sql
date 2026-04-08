-- Migración para crear el catálogo de ejercicios
CREATE TABLE IF NOT EXISTS catalogo_ejercicios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    musculo_principal TEXT,
    equipamiento TEXT,
    categoria TEXT,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar lectura pública para el catálogo
ALTER TABLE catalogo_ejercicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública para catalogo_ejercicios" ON catalogo_ejercicios FOR SELECT USING (true);

-- Inserción de datos (Ejemplo de los primeros, el script completo se generará aparte o se adjuntará)
-- NOTA: Como son 800+, lo ideal es que el usuario ejecute un archivo .sql completo que subiré a continuación.

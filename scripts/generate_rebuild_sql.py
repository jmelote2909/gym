import os

def main():
    catalog_sql_path = "supabase/populate_catalog.sql"
    rebuild_sql_path = "supabase/rebuild_all.sql"
    
    if not os.path.exists(catalog_sql_path):
        print(f"Error: {catalog_sql_path} not found. Run parse_exercises.py first.")
        return

    with open(catalog_sql_path, "r", encoding="utf-8") as f:
        catalog_insert_sql = f.read()

    # We remove the "DELETE FROM..." part from catalog_insert_sql because we will drop and recreate
    catalog_insert_sql = catalog_insert_sql.replace("-- POBLAR CATALOGO DE EJERCICIOS\nDELETE FROM catalogo_ejercicios;\n\n", "")

    rebuild_sql = f"""-- RECONSTRUCCIÓN COMPLETA DE ESQUEMA GYM PRO

-- 1. LIMPIEZA (Usamos CASCADE para eliminar dependencias automáticamente)
DROP TABLE IF EXISTS public.entrenamientos CASCADE;
DROP TABLE IF EXISTS public.ejercicios_usuario CASCADE;
DROP TABLE IF EXISTS public.ejercicios CASCADE; -- antigua tabla
DROP TABLE IF EXISTS public.series_entrenamiento CASCADE; -- antigua tabla
DROP TABLE IF EXISTS public.catalogo_ejercicios CASCADE;

-- 2. CREACIÓN DE TABLAS

-- Biblioteca Maestra de Ejercicios
CREATE TABLE public.catalogo_ejercicios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    musculo_principal TEXT,
    equipamiento TEXT,
    categoria TEXT,
    creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- Ejercicios Seleccionados por el Usuario
CREATE TABLE public.ejercicios_usuario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    id_catalogo TEXT REFERENCES public.catalogo_ejercicios(id) ON DELETE CASCADE,
    peso_actual FLOAT DEFAULT 0,
    peso_anterior FLOAT DEFAULT 0,
    dias_semana TEXT[] DEFAULT '{{}}',
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Logs de Entrenamiento (Series / Repes)
CREATE TABLE public.entrenamientos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    id_ejercicio_usuario UUID REFERENCES public.ejercicios_usuario(id) ON DELETE CASCADE,
    peso FLOAT NOT NULL DEFAULT 0,
    repeticiones INTEGER NOT NULL DEFAULT 0,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. SEGURIDAD (RLS)

ALTER TABLE catalogo_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejercicios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrenamientos ENABLE ROW LEVEL SECURITY;

-- Políticas para Catálogo (Lectura pública, sin escritura para usuarios)
CREATE POLICY "Lectura pública para catalogo_ejercicios" ON catalogo_ejercicios FOR SELECT USING (true);

-- Políticas para Ejercicios de Usuario (Solo dueño)
CREATE POLICY "Ejercicios usuario propios" ON ejercicios_usuario FOR ALL USING (auth.uid() = id_usuario);

-- Políticas para Entrenamientos (Solo dueño)
CREATE POLICY "Entrenamientos propios" ON entrenamientos FOR ALL USING (auth.uid() = id_usuario);

-- 4. POBLACIÓN DE DATOS REPROCESADOS
{catalog_insert_sql}
"""

    with open(rebuild_sql_path, "w", encoding="utf-8") as f:
        f.write(rebuild_sql)
    
    print(f"Success: {rebuild_sql_path} generated.")

if __name__ == "__main__":
    main()

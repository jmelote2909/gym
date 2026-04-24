-- 0. Limpiar tablas conflictivas para asegurar el nuevo esquema
DROP TABLE IF EXISTS public.series_entrenamiento CASCADE;
DROP TABLE IF EXISTS public.sesiones_entrenamiento CASCADE;

-- 1. Crear tabla de sesiones si no existe
CREATE TABLE public.sesiones_entrenamiento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    nombre TEXT DEFAULT 'Entrenamiento',
    nota TEXT,
    estado_animo TEXT,
    nivel_energia INTEGER,
    duracion_minutos INTEGER,
    volumen_total FLOAT DEFAULT 0,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Asegurar que existe la tabla de series
CREATE TABLE public.series_entrenamiento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_sesion UUID REFERENCES public.sesiones_entrenamiento(id) ON DELETE CASCADE,
    id_ejercicio_catalogo TEXT REFERENCES public.catalogo_ejercicios(id),
    peso FLOAT DEFAULT 0,
    repeticiones INTEGER DEFAULT 0,
    tiempo_minutos INTEGER,
    tiempo_segundos INTEGER,
    distancia_km FLOAT,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar RLS
ALTER TABLE sesiones_entrenamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_entrenamiento ENABLE ROW LEVEL SECURITY;

-- 4. Políticas
DROP POLICY IF EXISTS "Sesiones propias" ON sesiones_entrenamiento;
CREATE POLICY "Sesiones propias" ON sesiones_entrenamiento FOR ALL USING (auth.uid() = id_usuario);

DROP POLICY IF EXISTS "Series de sesiones propias" ON series_entrenamiento;
CREATE POLICY "Series de sesiones propias" ON series_entrenamiento FOR ALL USING (
    EXISTS (
        SELECT 1 FROM sesiones_entrenamiento 
        WHERE sesiones_entrenamiento.id = series_entrenamiento.id_sesion 
        AND sesiones_entrenamiento.id_usuario = auth.uid()
    )
);

-- Indices para rendimiento
CREATE INDEX IF NOT EXISTS idx_series_sesion ON series_entrenamiento(id_sesion);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones_entrenamiento(id_usuario, creado_el DESC);

-- 5. Función RPC para estadísticas por músculo
CREATE OR REPLACE FUNCTION public.get_muscle_stats(p_user_id UUID)
RETURNS TABLE (muscle TEXT, series BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.musculo_principal as muscle,
        COUNT(se.id) as series
    FROM 
        series_entrenamiento se
    JOIN 
        sesiones_entrenamiento ses ON ses.id = se.id_sesion
    JOIN 
        catalogo_ejercicios ce ON ce.id = se.id_ejercicio_catalogo
    WHERE 
        ses.id_usuario = p_user_id
    GROUP BY 
        ce.musculo_principal
    ORDER BY 
        series DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

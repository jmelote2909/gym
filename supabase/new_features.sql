-- ==========================================
-- ACTUALIZACIÓN PARA NUEVAS FUNCIONES
-- ==========================================

-- 1. Añadir imagen_url al catálogo
ALTER TABLE public.catalogo_ejercicios 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- 2. Tabla de Objetivos
CREATE TABLE IF NOT EXISTS public.objetivos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    tipo TEXT CHECK (tipo IN ('peso_corporal', 'frecuencia_semanal', 'sesiones_totales', 'pr_ejercicio')),
    valor_objetivo FLOAT NOT NULL,
    valor_actual FLOAT DEFAULT 0,
    nombre_ejercicio TEXT, -- Solo para pr_ejercicio
    completado BOOLEAN DEFAULT false,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    actualizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Logros/Insignias earned por el usuario
CREATE TABLE IF NOT EXISTS public.logros_usuario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    id_logro TEXT NOT NULL,
    fecha_ganado TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(id_usuario, id_logro)
);

-- 4. RLS para nuevas tablas
ALTER TABLE public.objetivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logros_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Objetivos propios" ON public.objetivos FOR ALL USING (auth.uid() = id_usuario);
CREATE POLICY "Logros propios" ON public.logros_usuario FOR SELECT USING (auth.uid() = id_usuario);

-- 5. Función para actualizar actualizado_el
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_el = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_objetivos_updated_at BEFORE UPDATE ON public.objetivos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

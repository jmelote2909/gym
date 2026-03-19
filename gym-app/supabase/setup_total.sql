-- ==========================================
-- ESTRUCTURA COMPLETA GYM PRO (EJECUTAR TODO)
-- ==========================================

-- 1. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre_usuario TEXT UNIQUE,
  url_avatar TEXT,
  actualizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA DE EJERCICIOS
CREATE TABLE IF NOT EXISTS public.ejercicios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  musculo_objetivo TEXT,
  dias_semana TEXT[] DEFAULT '{}',
  peso FLOAT DEFAULT 0,
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABLA DE ENTRENAMIENTOS
CREATE TABLE IF NOT EXISTS public.entrenamientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  nombre TEXT DEFAULT 'Entrenamiento sin nombre',
  fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABLA DE SERIES (LOGS)
CREATE TABLE IF NOT EXISTS public.series_entrenamiento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_entrenamiento UUID REFERENCES public.entrenamientos ON DELETE CASCADE NOT NULL,
  id_ejercicio UUID REFERENCES public.ejercicios ON DELETE SET NULL,
  peso FLOAT NOT NULL DEFAULT 0,
  repeticiones INTEGER NOT NULL DEFAULT 0,
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. TABLA DE AMISTADES
CREATE TABLE IF NOT EXISTS public.amistades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario UUID REFERENCES public.perfiles(id) NOT NULL,
  id_amigo UUID REFERENCES public.perfiles(id) NOT NULL,
  estado TEXT CHECK (estado IN ('pendiente', 'aceptada', 'bloqueada')) DEFAULT 'pendiente',
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(id_usuario, id_amigo)
);

-- ==========================================
-- CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ==========================================

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrenamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_entrenamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE amistades ENABLE ROW LEVEL SECURITY;

-- Políticas de Perfiles
DROP POLICY IF EXISTS "Perfiles visibles para todos" ON perfiles;
CREATE POLICY "Perfiles visibles para todos" ON perfiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil" ON perfiles;
CREATE POLICY "Usuarios actualizan su propio perfil" ON perfiles FOR UPDATE USING (auth.uid() = id);

-- Políticas de Ejercicios
DROP POLICY IF EXISTS "Ejercicios propios" ON ejercicios;
CREATE POLICY "Ejercicios propios" ON ejercicios FOR ALL USING (auth.uid() = id_usuario);

-- Políticas de Entrenamientos
DROP POLICY IF EXISTS "Entrenamientos propios" ON entrenamientos;
CREATE POLICY "Entrenamientos propios" ON entrenamientos FOR ALL USING (auth.uid() = id_usuario);

-- Políticas de Series
DROP POLICY IF EXISTS "Series propias" ON series_entrenamiento;
CREATE POLICY "Series propias" ON series_entrenamiento FOR ALL USING (
  EXISTS (
    SELECT 1 FROM entrenamientos 
    WHERE entrenamientos.id = series_entrenamiento.id_entrenamiento 
    AND entrenamientos.id_usuario = auth.uid()
  )
);

-- Políticas de Amistades
DROP POLICY IF EXISTS "Usuarios ven sus propias amistades" ON amistades;
CREATE POLICY "Usuarios ven sus propias amistades" ON amistades FOR SELECT USING (
  auth.uid() = id_usuario OR auth.uid() = id_amigo
);

DROP POLICY IF EXISTS "Usuarios envían solicitudes" ON amistades;
CREATE POLICY "Usuarios envían solicitudes" ON amistades FOR INSERT WITH CHECK (
  auth.uid() = id_usuario
);

DROP POLICY IF EXISTS "Usuarios aceptan/borran sus amistades" ON amistades;
CREATE POLICY "Usuarios aceptan/borran sus amistades" ON amistades FOR UPDATE USING (
  auth.uid() = id_amigo
);

DROP POLICY IF EXISTS "Usuarios eliminan sus amistades" ON amistades;
CREATE POLICY "Usuarios eliminan sus amistades" ON amistades FOR DELETE USING (
  auth.uid() = id_usuario OR auth.uid() = id_amigo
);

-- ==========================================
-- AUTOMATIZACIÓN (TRIGGERS)
-- ==========================================

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre_usuario)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'nombre_usuario', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de creación
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sincronizar usuarios actuales
INSERT INTO public.perfiles (id, nombre_usuario)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Forzar recarga de caché
NOTIFY pgrst, 'reload_schema';

-- ==========================================
-- CORRECCIÓN DE RELACIONES (SI HAY ERRORES)
-- ==========================================
-- Ejecuta esto si ves errores de "Schema Cache" o "Could not find relationship":
-- ALTER TABLE public.amistades DROP CONSTRAINT IF EXISTS amistades_id_usuario_fkey;
-- ALTER TABLE public.amistades DROP CONSTRAINT IF EXISTS amistades_id_amigo_fkey;
-- ALTER TABLE public.amistades ADD CONSTRAINT amistades_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.perfiles(id);
-- ALTER TABLE public.amistades ADD CONSTRAINT amistades_id_amigo_fkey FOREIGN KEY (id_amigo) REFERENCES public.perfiles(id);

-- ==========================================
-- CONFIGURACIÓN DE TIEMPO REAL
-- ==========================================
-- Ejecuta esto para activar las actualizaciones en vivo en la app:
-- ALTER PUBLICATION supabase_realtime ADD TABLE amistades;
-- ALTER PUBLICATION supabase_realtime ADD TABLE perfiles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE entrenamientos;
-- ALTER PUBLICATION supabase_realtime ADD TABLE series_entrenamiento;
-- ALTER PUBLICATION supabase_realtime ADD TABLE ejercicios;

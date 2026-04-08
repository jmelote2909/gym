-- ==========================================
-- NUEVAS FUNCIONALIDADES: LOGROS, RUTINAS, NOTAS, GRÁFICOS Y FEED SOCIAL
-- ==========================================

-- 1. TABLA DE LOGROS (ACHIEVEMENTS)
CREATE TABLE IF NOT EXISTS public.logros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL, -- ej: 'streak_7', 'volume_10k', 'first_workout'
  nombre TEXT NOT NULL,
  descripcion TEXT,
  icono TEXT, -- nombre del icono de Ionicons
  categoria TEXT, -- 'racha', 'volumen', 'ejercicio', 'social'
  requisito_valor INTEGER, -- valor necesario para desbloquear
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA DE LOGROS DESBLOQUEADOS POR USUARIO
CREATE TABLE IF NOT EXISTS public.logros_usuario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  id_logro UUID REFERENCES public.logros ON DELETE CASCADE NOT NULL,
  desbloqueado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(id_usuario, id_logro)
);

-- 3. TABLA DE RUTINAS GUARDADAS
CREATE TABLE IF NOT EXISTS public.rutinas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_favorita BOOLEAN DEFAULT false,
  veces_usada INTEGER DEFAULT 0,
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  actualizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABLA DE EJERCICIOS EN RUTINAS
CREATE TABLE IF NOT EXISTS public.rutinas_ejercicios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_rutina UUID REFERENCES public.rutinas ON DELETE CASCADE NOT NULL,
  id_ejercicio_catalogo TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  series_sugeridas INTEGER DEFAULT 3,
  repeticiones_sugeridas INTEGER DEFAULT 10,
  peso_sugerido FLOAT DEFAULT 0,
  notas TEXT
);

-- 5. TABLA DE NOTAS DE ENTRENAMIENTO
CREATE TABLE IF NOT EXISTS public.notas_entrenamiento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_entrenamiento UUID REFERENCES public.entrenamientos ON DELETE CASCADE NOT NULL,
  nota TEXT NOT NULL,
  estado_animo TEXT, -- 'excelente', 'bien', 'normal', 'cansado', 'mal'
  nivel_energia INTEGER CHECK (nivel_energia >= 1 AND nivel_energia <= 5),
  calidad_sueno INTEGER CHECK (calidad_sueno >= 1 AND calidad_sueno <= 5),
  dolor_muscular TEXT[], -- array de músculos con dolor
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. TABLA DE REACCIONES A ENTRENAMIENTOS (FEED SOCIAL)
CREATE TABLE IF NOT EXISTS public.reacciones_entrenamiento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_entrenamiento UUID REFERENCES public.entrenamientos ON DELETE CASCADE NOT NULL,
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  tipo_reaccion TEXT CHECK (tipo_reaccion IN ('fuego', 'musculo', 'aplauso', 'corazon')),
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(id_entrenamiento, id_usuario)
);

-- 7. TABLA DE COMENTARIOS EN ENTRENAMIENTOS
CREATE TABLE IF NOT EXISTS public.comentarios_entrenamiento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_entrenamiento UUID REFERENCES public.entrenamientos ON DELETE CASCADE NOT NULL,
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  comentario TEXT NOT NULL,
  creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- MODIFICAR TABLA ENTRENAMIENTOS (añadir campos)
-- ==========================================
ALTER TABLE public.entrenamientos ADD COLUMN IF NOT EXISTS creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.entrenamientos ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER;
ALTER TABLE public.entrenamientos ADD COLUMN IF NOT EXISTS volumen_total FLOAT; -- kg totales levantados
ALTER TABLE public.entrenamientos ADD COLUMN IF NOT EXISTS es_publico BOOLEAN DEFAULT true;

-- ==========================================
-- CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ==========================================

ALTER TABLE logros ENABLE ROW LEVEL SECURITY;
ALTER TABLE logros_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutinas_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_entrenamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE reacciones_entrenamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios_entrenamiento ENABLE ROW LEVEL SECURITY;

-- Políticas de Logros (todos pueden ver)
DROP POLICY IF EXISTS "Logros visibles para todos" ON logros;
CREATE POLICY "Logros visibles para todos" ON logros FOR SELECT USING (true);

-- Políticas de Logros Usuario
DROP POLICY IF EXISTS "Ver propios logros" ON logros_usuario;
CREATE POLICY "Ver propios logros" ON logros_usuario FOR SELECT USING (auth.uid() = id_usuario);

DROP POLICY IF EXISTS "Sistema inserta logros" ON logros_usuario;
CREATE POLICY "Sistema inserta logros" ON logros_usuario FOR INSERT WITH CHECK (auth.uid() = id_usuario);

-- Políticas de Rutinas
DROP POLICY IF EXISTS "Rutinas propias" ON rutinas;
CREATE POLICY "Rutinas propias" ON rutinas FOR ALL USING (auth.uid() = id_usuario);

-- Políticas de Rutinas Ejercicios
DROP POLICY IF EXISTS "Ejercicios de rutinas propias" ON rutinas_ejercicios;
CREATE POLICY "Ejercicios de rutinas propias" ON rutinas_ejercicios FOR ALL USING (
  EXISTS (
    SELECT 1 FROM rutinas 
    WHERE rutinas.id = rutinas_ejercicios.id_rutina 
    AND rutinas.id_usuario = auth.uid()
  )
);

-- Políticas de Notas
DROP POLICY IF EXISTS "Notas propias" ON notas_entrenamiento;
CREATE POLICY "Notas propias" ON notas_entrenamiento FOR ALL USING (
  EXISTS (
    SELECT 1 FROM entrenamientos 
    WHERE entrenamientos.id = notas_entrenamiento.id_entrenamiento 
    AND entrenamientos.id_usuario = auth.uid()
  )
);

-- Políticas de Reacciones (ver si eres amigo o es tu entrenamiento)
DROP POLICY IF EXISTS "Ver reacciones de amigos" ON reacciones_entrenamiento;
CREATE POLICY "Ver reacciones de amigos" ON reacciones_entrenamiento FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM entrenamientos e
    WHERE e.id = reacciones_entrenamiento.id_entrenamiento
    AND (
      e.id_usuario = auth.uid() OR
      EXISTS (
        SELECT 1 FROM amistades a
        WHERE (a.id_usuario = auth.uid() AND a.id_amigo = e.id_usuario)
        OR (a.id_amigo = auth.uid() AND a.id_usuario = e.id_usuario)
        AND a.estado = 'aceptada'
      )
    )
  )
);

DROP POLICY IF EXISTS "Insertar reacciones" ON reacciones_entrenamiento;
CREATE POLICY "Insertar reacciones" ON reacciones_entrenamiento FOR INSERT WITH CHECK (auth.uid() = id_usuario);

DROP POLICY IF EXISTS "Eliminar propias reacciones" ON reacciones_entrenamiento;
CREATE POLICY "Eliminar propias reacciones" ON reacciones_entrenamiento FOR DELETE USING (auth.uid() = id_usuario);

-- Políticas de Comentarios (similar a reacciones)
DROP POLICY IF EXISTS "Ver comentarios de amigos" ON comentarios_entrenamiento;
CREATE POLICY "Ver comentarios de amigos" ON comentarios_entrenamiento FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM entrenamientos e
    WHERE e.id = comentarios_entrenamiento.id_entrenamiento
    AND (
      e.id_usuario = auth.uid() OR
      EXISTS (
        SELECT 1 FROM amistades a
        WHERE (a.id_usuario = auth.uid() AND a.id_amigo = e.id_usuario)
        OR (a.id_amigo = auth.uid() AND a.id_usuario = e.id_usuario)
        AND a.estado = 'aceptada'
      )
    )
  )
);

DROP POLICY IF EXISTS "Insertar comentarios" ON comentarios_entrenamiento;
CREATE POLICY "Insertar comentarios" ON comentarios_entrenamiento FOR INSERT WITH CHECK (auth.uid() = id_usuario);

DROP POLICY IF EXISTS "Eliminar propios comentarios" ON comentarios_entrenamiento;
CREATE POLICY "Eliminar propios comentarios" ON comentarios_entrenamiento FOR DELETE USING (auth.uid() = id_usuario);

-- ==========================================
-- DATOS INICIALES: LOGROS PREDEFINIDOS
-- ==========================================

INSERT INTO public.logros (codigo, nombre, descripcion, icono, categoria, requisito_valor) VALUES
  ('first_workout', 'Primera Sesión', 'Completaste tu primer entrenamiento', 'fitness', 'ejercicio', 1),
  ('streak_3', 'Racha de 3', 'Entrena 3 días seguidos', 'flame', 'racha', 3),
  ('streak_7', 'Guerrero Semanal', 'Racha de 7 días consecutivos', 'flame', 'racha', 7),
  ('streak_30', 'Mes Imparable', '30 días de racha', 'flame', 'racha', 30),
  ('streak_100', 'Leyenda', '100 días de racha', 'trophy', 'racha', 100),
  ('volume_1k', 'Primera Tonelada', 'Levanta 1,000 kg en total', 'barbell', 'volumen', 1000),
  ('volume_10k', 'Bestia de Hierro', 'Levanta 10,000 kg en total', 'barbell', 'volumen', 10000),
  ('volume_100k', 'Titán', 'Levanta 100,000 kg en total', 'barbell', 'volumen', 100000),
  ('workouts_10', 'Constante', 'Completa 10 entrenamientos', 'checkmark-circle', 'ejercicio', 10),
  ('workouts_50', 'Dedicado', 'Completa 50 entrenamientos', 'checkmark-circle', 'ejercicio', 50),
  ('workouts_100', 'Veterano', 'Completa 100 entrenamientos', 'medal', 'ejercicio', 100),
  ('friends_5', 'Social', 'Añade 5 amigos', 'people', 'social', 5),
  ('friends_20', 'Popular', 'Añade 20 amigos', 'people', 'social', 20),
  ('pr_first', 'Primer Récord', 'Establece tu primer récord personal', 'trophy', 'ejercicio', 1)
ON CONFLICT (codigo) DO NOTHING;

-- ==========================================
-- FUNCIONES ÚTILES
-- ==========================================

-- Función para calcular volumen total de un entrenamiento
CREATE OR REPLACE FUNCTION calcular_volumen_entrenamiento(entrenamiento_id UUID)
RETURNS FLOAT AS $$
DECLARE
  volumen FLOAT;
BEGIN
  SELECT COALESCE(SUM(peso * repeticiones), 0)
  INTO volumen
  FROM series_entrenamiento
  WHERE id_entrenamiento = entrenamiento_id;
  
  RETURN volumen;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar y otorgar logros automáticamente
CREATE OR REPLACE FUNCTION verificar_logros_usuario(usuario_id UUID)
RETURNS void AS $$
DECLARE
  racha_actual INTEGER;
  total_entrenamientos INTEGER;
  volumen_total FLOAT;
  total_amigos INTEGER;
BEGIN
  -- Obtener estadísticas del usuario
  SELECT racha INTO racha_actual FROM perfiles WHERE id = usuario_id;
  
  SELECT COUNT(*) INTO total_entrenamientos FROM entrenamientos WHERE id_usuario = usuario_id;
  
  SELECT COALESCE(SUM(s.peso * s.repeticiones), 0) INTO volumen_total
  FROM series_entrenamiento s
  JOIN entrenamientos e ON e.id = s.id_entrenamiento
  WHERE e.id_usuario = usuario_id;
  
  SELECT COUNT(*) INTO total_amigos FROM amistades 
  WHERE (id_usuario = usuario_id OR id_amigo = usuario_id) AND estado = 'aceptada';
  
  -- Otorgar logros de racha
  INSERT INTO logros_usuario (id_usuario, id_logro)
  SELECT usuario_id, id FROM logros 
  WHERE categoria = 'racha' AND requisito_valor <= racha_actual
  ON CONFLICT (id_usuario, id_logro) DO NOTHING;
  
  -- Otorgar logros de entrenamientos
  INSERT INTO logros_usuario (id_usuario, id_logro)
  SELECT usuario_id, id FROM logros 
  WHERE categoria = 'ejercicio' AND codigo LIKE 'workouts_%' AND requisito_valor <= total_entrenamientos
  ON CONFLICT (id_usuario, id_logro) DO NOTHING;
  
  -- Otorgar logros de volumen
  INSERT INTO logros_usuario (id_usuario, id_logro)
  SELECT usuario_id, id FROM logros 
  WHERE categoria = 'volumen' AND requisito_valor <= volumen_total
  ON CONFLICT (id_usuario, id_logro) DO NOTHING;
  
  -- Otorgar logros sociales
  INSERT INTO logros_usuario (id_usuario, id_logro)
  SELECT usuario_id, id FROM logros 
  WHERE categoria = 'social' AND requisito_valor <= total_amigos
  ON CONFLICT (id_usuario, id_logro) DO NOTHING;
  
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- CONFIGURACIÓN DE TIEMPO REAL
-- ==========================================
-- Ejecuta esto para activar las actualizaciones en vivo:
-- ALTER PUBLICATION supabase_realtime ADD TABLE logros_usuario;
-- ALTER PUBLICATION supabase_realtime ADD TABLE reacciones_entrenamiento;
-- ALTER PUBLICATION supabase_realtime ADD TABLE comentarios_entrenamiento;

-- ==========================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_logros_usuario_usuario ON logros_usuario(id_usuario);
CREATE INDEX IF NOT EXISTS idx_rutinas_usuario ON rutinas(id_usuario);
CREATE INDEX IF NOT EXISTS idx_notas_entrenamiento ON notas_entrenamiento(id_entrenamiento);
CREATE INDEX IF NOT EXISTS idx_reacciones_entrenamiento ON reacciones_entrenamiento(id_entrenamiento);
CREATE INDEX IF NOT EXISTS idx_comentarios_entrenamiento ON comentarios_entrenamiento(id_entrenamiento);
CREATE INDEX IF NOT EXISTS idx_entrenamientos_usuario_fecha ON entrenamientos(id_usuario, creado_el DESC);

-- ==========================================
-- ACTUALIZACIÓN: SOPORTE PARA CARDIO
-- ==========================================

-- Añadir campos de tiempo y distancia a la tabla de series
ALTER TABLE public.series_entrenamiento 
ADD COLUMN IF NOT EXISTS tiempo_minutos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tiempo_segundos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS distancia_km FLOAT;

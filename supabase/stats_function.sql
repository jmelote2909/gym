-- ==========================================
-- FUNCIÓN: Obtener estadísticas del usuario en una sola llamada
-- Ejecuta este SQL en el SQL Editor de Supabase
-- ==========================================

CREATE OR REPLACE FUNCTION obtener_stats_usuario(usuario_id UUID)
RETURNS TABLE (
  racha INTEGER,
  total_entrenamientos BIGINT,
  volumen_total FLOAT,
  total_amigos BIGINT,
  total_records BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Racha actual del perfil
    COALESCE(p.racha, 0)::INTEGER AS racha,

    -- Total de entrenamientos del usuario
    (SELECT COUNT(*) FROM entrenamientos e WHERE e.id_usuario = usuario_id)::BIGINT AS total_entrenamientos,

    -- Volumen total: suma(peso * repeticiones) de todas sus series
    COALESCE(
      (SELECT SUM(s.peso * s.repeticiones)
       FROM series_entrenamiento s
       JOIN entrenamientos e ON e.id = s.id_entrenamiento
       WHERE e.id_usuario = usuario_id),
    0.0)::FLOAT AS volumen_total,

    -- Total de amigos aceptados
    (SELECT COUNT(*) FROM amistades a
     WHERE (a.id_usuario = usuario_id OR a.id_amigo = usuario_id)
     AND a.estado = 'aceptada')::BIGINT AS total_amigos,

    -- Total de récords personales (ejercicios con peso registrado)
    (SELECT COUNT(*) FROM ejercicios ej
     WHERE ej.id_usuario = usuario_id)::BIGINT AS total_records

  FROM perfiles p
  WHERE p.id = usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permiso de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION obtener_stats_usuario(UUID) TO authenticated;

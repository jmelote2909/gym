-- 1. Crear el bucket de avatars si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir que cualquiera vea los avatars (Público)
DROP POLICY IF EXISTS "Avatars públicos" ON storage.objects;
CREATE POLICY "Avatars públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 3. Permitir a los usuarios subir su propio avatar
-- Se asume que el archivo se sube a una carpeta con el ID del usuario: userId/filename.png
DROP POLICY IF EXISTS "Usuarios suben su propio avatar" ON storage.objects;
CREATE POLICY "Usuarios suben su propio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Permitir a los usuarios borrar/actualizar su propio avatar
DROP POLICY IF EXISTS "Usuarios gestionan su propio avatar" ON storage.objects;
CREATE POLICY "Usuarios gestionan su propio avatar"
ON storage.objects FOR ALL
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

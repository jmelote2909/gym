const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://finrpximiavghslchcxl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbnJweGltaWF2Z2hzbGNoY3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDYzNTVsLCJleHAiOjIwNTk2ODI3NTV9.sb_publishable_9YhPRXWU0TxWngwGVu6KQA__DKatMOJ'; // Usando la clave real decodificada o la que vi (espera, la que vi era un placeholder?)

// Re-verificando la clave. La que vi en el archivo era 'sb_publishable_...', que parece ser un placeholder o una clave de entorno.
// Sin embargo, necesito una clave válida para consultarlo desde fuera.
// Dado que no puedo ejecutarlo fácilmente sin el entorno de React Native, voy a probar otra cosa.

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.from('entrenamientos').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns:', Object.keys(data[0] || {}));
  }
}

checkSchema();

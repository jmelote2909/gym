import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://finrpximiavghslchcxl.supabase.co';
const supabaseAnonKey = 'sb_publishable_9YhPRXWU0TxWngwGVu6KQA__DKatMOJ';

// Fallback storage in case AsyncStorage fails to load (can happen in some Expo environments)
const memoryStorage = {
  getItem: (key) => {
    return globalThis.memoryStorageBackend?.[key] || null;
  },
  setItem: (key, value) => {
    if (!globalThis.memoryStorageBackend) globalThis.memoryStorageBackend = {};
    globalThis.memoryStorageBackend[key] = value;
  },
  removeItem: (key) => {
    if (globalThis.memoryStorageBackend) delete globalThis.memoryStorageBackend[key];
  },
};

// Safe storage selector
let safeStorage = memoryStorage;
try {
  if (Platform.OS !== 'web' && AsyncStorage) {
    safeStorage = AsyncStorage;
  }
} catch (e) {
  console.warn("AsyncStorage not available, using memory storage fallback");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

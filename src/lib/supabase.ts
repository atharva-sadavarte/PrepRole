import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://drjlrhrvpyhpkzuewrmy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyamxyaHJ2cHlocGt6dWV3cm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjE1MzEsImV4cCI6MjEwNDE5NzUzMX0.1ld-LCe2aMMEYF2zE4iHhihRg1ASRDvOKYtwuTXAngY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

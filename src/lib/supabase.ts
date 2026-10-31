import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

// Placeholder values keep the app rendering (with an error banner) when env vars are missing.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing');

export const OWNER_PHONE = (import.meta.env.VITE_OWNER_PHONE as string | undefined) ?? '917202806140';

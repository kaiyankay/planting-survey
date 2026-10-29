import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * One client for the developer mode: sign-in by magic link and reading
 * responses. Row Level Security on the server decides who may read; the
 * anon key alone can only insert.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

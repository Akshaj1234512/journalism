import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True only once the Supabase project keys are set. Auth UI checks this so the
// site still builds and runs before the Supabase project exists.
export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

export function createClient() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client Supabase avec la clé service_role — contourne RLS et peut gérer
// les comptes (auth.admin.*). Ne JAMAIS importer ce fichier depuis un
// Client Component ni exposer SUPABASE_SERVICE_ROLE_KEY au navigateur.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

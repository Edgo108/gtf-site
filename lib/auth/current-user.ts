import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Utilisateur connecté, vérifié auprès de Supabase (getUser) UNE seule
// fois par requête : le layout et la page appellent cette fonction au
// lieu de refaire chacun leur aller-retour réseau. `cache` est propre à
// une requête serveur (aucun partage entre utilisateurs).
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const GRADES = [
  "Agent",
  "Enquêteur",
  "Sergent",
  "Lieutenant",
  "Capitaine",
  "Commandant",
] as const;

// Compte « Edgo » (connexion edgo@gtf.local) : sa suppression est
// interdite, pour tout le monde. Protection volontairement codée en dur
// pour ce seul compte, repéré par id (le pseudo, lui, peut changer).
// Doublée en base par supabase/profiles_edgo_protection.sql.
export const EDGO_ACCOUNT_ID = "171b373d-5cdf-4485-a65b-ccb7e31ba82c";

import type { Unite } from "@/lib/permissions";

export type Profile = {
  id: string;
  pseudo: string;
  role: "admin" | "agent";
  statut: "actif" | "suspendu";
  grade: string;
  unite: Unite;
  doit_changer_mdp: boolean;
  created_at: string;
};

"use client";

import { usePathname } from "next/navigation";

// Signature discrète « made by Edgo », fixée en bas à droite de toutes les
// pages (rendue une seule fois dans le layout racine). Jamais cliquable
// (pointer-events-none) : elle ne peut pas gêner un bouton en dessous.
// Couleur proche du fond : fond beige sur la page de connexion (/), thème
// sombre partout ailleurs.
export function MadeBySignature() {
  const pathname = usePathname();
  const onLoginPage = pathname === "/";

  return (
    <p
      aria-hidden="true"
      className={`pointer-events-none fixed bottom-2 right-3 z-40 select-none font-sans text-[10px] italic tracking-wide ${
        onLoginPage ? "text-[#C8BFAB]" : "text-[#353D48]"
      }`}
    >
      made by Edgo
    </p>
  );
}

"use client";

// Dernier filet de sécurité : erreur dans le layout racine lui-même.
// Remplace tout le document, donc ni Tailwind ni les polices du site ne
// sont disponibles ici — styles en ligne aux couleurs du thème tactique.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "#0A0C0F",
          color: "#E8EAED",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: "center",
            border: "1px solid #B23A32",
            background: "#12151A",
            borderRadius: 6,
            padding: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "1.1rem", textTransform: "uppercase" }}>
            Une erreur est survenue
          </h1>
          <p style={{ color: "#8B94A0", fontSize: 14 }}>
            L&apos;application n&apos;a pas pu se charger. Vérifiez votre
            connexion puis réessayez.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 12,
              padding: "0.6rem 1.2rem",
              border: "1px solid #3E6FA6",
              background: "#3E6FA6",
              color: "#E8EAED",
              borderRadius: 4,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

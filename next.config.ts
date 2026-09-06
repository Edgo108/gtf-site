import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Les photos de mandats de recherche vont jusqu'à 5 Mo (validé dans
      // app/(app)/mandats/actions.ts) ; la limite par défaut de 1 Mo pour
      // le corps d'une Server Action est donc trop basse.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ==========================================================
  // RACINE DU WORKSPACE
  // ==========================================================
  //
  // Fixer explicitement la racine sur ce dossier "frontend"
  // évite tout avertissement "multiple lockfiles" émis par
  // Next si un lockfile apparaît dans un dossier parent.
  // ==========================================================

  turbopack: {
    root: __dirname,
  },

  // ==========================================================
  // EN-TÊTES ET SÉCURITÉ
  // ==========================================================
  //
  // Ne pas exposer le framework utilisé ("X-Powered-By").
  // ==========================================================

  poweredByHeader: false,

  // ==========================================================
  // PERFORMANCE
  // ==========================================================
  //
  // Compresser les réponses (gzip/brotli).
  // Vérifier les effets de bord React en développement.
  // Supprimer les console.* du bundle de production
  // (les erreurs sont conservées).
  // ==========================================================

  compress: true,

  reactStrictMode: true,

  compiler: {
    removeConsole: {
      exclude: ["error"],
    },
  },
};

export default nextConfig;

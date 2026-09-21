// Charte visuelle unique du thème sombre/tactique : boutons, champs,
// libellés. Toutes les sections importent d'ici plutôt que de recopier
// les classes Tailwind (source des petites divergences d'avant).

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "warning"
  | "info";
export type ButtonSize = "md" | "sm";

// Tous les boutons ont une bordure (même celle du bouton plein, de la
// couleur du fond) : à taille égale, ils ont exactement la même hauteur
// côte à côte. Hauteur tactile confortable sous `sm`, plus compacte au-delà.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded border text-xs uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "px-4 py-2.5 font-medium tracking-widest sm:py-2",
  sm: "px-3 py-2 tracking-wider sm:py-1.5",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-gtf-blue bg-gtf-blue text-gtf-text hover:border-gtf-blue-hover hover:bg-gtf-blue-hover",
  secondary:
    "border-gtf-border text-gtf-text-muted hover:border-gtf-text-muted hover:text-gtf-text",
  danger: "border-gtf-red text-gtf-red hover:bg-gtf-red/10",
  success: "border-gtf-green text-gtf-green hover:bg-gtf-green/10",
  warning: "border-gtf-amber text-gtf-amber hover:bg-gtf-amber/10",
  info: "border-gtf-blue text-gtf-blue-hover hover:bg-gtf-blue/10",
};

export function btn(
  variant: ButtonVariant,
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]}${
    extra ? ` ${extra}` : ""
  }`;
}

// Champ de formulaire sans largeur imposée (à utiliser dans une ligne
// flex/grid qui gère la largeur).
export const inputBase =
  "rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text transition-colors focus:border-gtf-blue focus:outline-none disabled:opacity-60";

// Champ pleine largeur : formulaires de création/modification.
export const fieldClass = `w-full ${inputBase}`;

// Champ compact : édition en ligne dans un tableau, panneaux de la carte.
export const fieldCompactClass =
  "rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 text-sm text-gtf-text transition-colors focus:border-gtf-blue focus:outline-none disabled:opacity-60";

export const labelClass =
  "mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted";

// Pastille de statut/catégorie (badges).
export const badgeBase =
  "inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider";

export const BADGE_TONES = {
  blue: "border-gtf-blue text-gtf-blue-hover bg-gtf-blue/10",
  green: "border-gtf-green text-gtf-green bg-gtf-green/10",
  amber: "border-gtf-amber text-gtf-amber bg-gtf-amber/10",
  red: "border-gtf-red text-gtf-red bg-gtf-red/10",
  muted: "border-gtf-text-muted text-gtf-text-muted bg-gtf-panel-alt",
} as const;

// Heure courante en ms, à appeler côté serveur (page) pour la passer en
// prop à un composant client : évite Date.now() dans un rendu
// (règle react-hooks/purity).
export function serverNowMs(): number {
  return Date.now();
}

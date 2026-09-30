// Mise à jour d'état « seulement si ça a changé », pour les données
// relues périodiquement (sondage des cartes) : si le serveur renvoie
// exactement la même chose, on garde l'ancienne référence, React ne
// re-rend pas et la carte ne redessine pas toutes ses formes.
//
//   setZones(keepIfUnchanged(nouvellesZones));

function snapshot(value: unknown): string {
  return JSON.stringify(value instanceof Map ? [...value.entries()] : value);
}

export function keepIfUnchanged<T>(next: T): (previous: T) => T {
  const nextSnapshot = snapshot(next);
  return (previous) => (snapshot(previous) === nextSnapshot ? previous : next);
}

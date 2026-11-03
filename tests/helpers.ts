import type { Suggestion } from '@entreprise-page/api-client/browser';
import type { SuggestionSource } from '../src/controller.ts';

export const suggestions: Suggestion[] = [
  {
    siren: '443061841',
    nom: 'GOOGLE FRANCE',
    localite: '75009',
    activite: 'Programmation informatique',
    active: true,
    slug: 'google-france-443061841',
  },
  {
    siren: '097380463',
    nom: 'GAIN EMILE <img src=x onerror=alert(1)>',
    localite: '64390',
    activite: 'Construction',
    active: false,
    slug: 'gain-emile-s-a-r-l-097380463',
  },
];

/** Source qui garde les saisies reçues et répond avec `suggestions`. */
export function fakeSource(results: readonly Suggestion[] = suggestions): SuggestionSource & { queries: string[] } {
  const queries: string[] = [];
  const source = async (query: string): Promise<readonly Suggestion[]> => {
    queries.push(query);

    return results;
  };

  return Object.assign(source, { queries });
}

/** Laisse passer les timers à 0 ms et les promesses en attente. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

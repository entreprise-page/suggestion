import { PublicClient, type Fetch, type Suggestion } from '@entreprise-page/api-client/browser';

/** Fournit les suggestions d'une saisie. `signal` est annulé dès que la saisie change. */
export type SuggestionSource = (query: string, signal: AbortSignal) => Promise<readonly Suggestion[]>;

export interface SuggestionOptions {
  /** Client à réutiliser. Sinon, un `PublicClient` est créé avec `baseUrl` et `fetch`. */
  client?: PublicClient | undefined;
  /** `https://api.entreprise.page/v1` par défaut. */
  baseUrl?: string | undefined;
  fetch?: Fetch | undefined;
  /** Remplace l'appel à l'API, par exemple pour passer par un proxy ou ajouter un cache. */
  source?: SuggestionSource | undefined;
  /** Nombre de suggestions, de 1 à 10. 10 par défaut. */
  limit?: number | undefined;
  /** Nombre de caractères à partir duquel l'API est appelée. 3 par défaut. */
  minLength?: number | undefined;
  /** Délai en millisecondes entre la dernière frappe et l'appel à l'API. 150 par défaut. */
  debounce?: number | undefined;
  /** Saisie initiale, sans appel à l'API. */
  query?: string | undefined;
  onSelect?: ((suggestion: Suggestion) => void) | undefined;
  /** Les annulations ne passent pas ici. */
  onError?: ((error: unknown) => void) | undefined;
}

export type SuggestionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SuggestionState {
  readonly query: string;
  /** Dernières suggestions reçues, gardées pendant le chargement des suivantes pour éviter un clignotement. */
  readonly suggestions: readonly Suggestion[];
  readonly status: SuggestionStatus;
  /** Suggestion mise en avant au clavier, -1 si aucune. */
  readonly activeIndex: number;
  /** Vrai quand la liste doit être affichée. */
  readonly open: boolean;
  readonly error: unknown;
}

/**
 * Logique de l'autocomplétion, sans DOM : délai entre les frappes, annulation des requêtes
 * dépassées, navigation au clavier. Les adaptateurs vanilla, Vue et React l'affichent.
 *
 * Chaque changement produit un nouvel objet d'état, ce qui permet de le comparer par référence.
 */
export class SuggestionController {
  readonly #source: SuggestionSource;
  readonly #minLength: number;
  readonly #debounce: number;
  readonly #onSelect: ((suggestion: Suggestion) => void) | undefined;
  readonly #onError: ((error: unknown) => void) | undefined;
  readonly #listeners = new Set<(state: SuggestionState) => void>();

  #state: SuggestionState;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #request: AbortController | undefined;

  constructor(options: SuggestionOptions = {}) {
    const limit = options.limit ?? 10;
    const client = options.client ?? new PublicClient({ baseUrl: options.baseUrl, fetch: options.fetch });

    this.#source = options.source ?? ((query, signal) => client.entreprises().suggest(query, limit, { signal }));
    this.#minLength = options.minLength ?? 3;
    this.#debounce = options.debounce ?? 150;
    this.#onSelect = options.onSelect;
    this.#onError = options.onError;
    this.#state = {
      query: options.query ?? '',
      suggestions: [],
      status: 'idle',
      activeIndex: -1,
      open: false,
      error: undefined,
    };
  }

  /** Fonction fléchée : peut être passée telle quelle, par exemple à `useSyncExternalStore`. */
  readonly getState = (): SuggestionState => this.#state;

  /** Appelle `listener` à chaque changement d'état. Renvoie la fonction de désabonnement. */
  readonly subscribe = (listener: (state: SuggestionState) => void): (() => void) => {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  };

  /** À appeler à chaque frappe : la recherche part après le délai `debounce`. */
  setQuery(query: string): void {
    this.abort();

    if (query.trim().length < this.#minLength) {
      this.#update({ query, suggestions: [], status: 'idle', activeIndex: -1, open: false, error: undefined });

      return;
    }

    this.#update({ query, status: 'loading', activeIndex: -1 });
    this.#timer = setTimeout(() => void this.#load(query), this.#debounce);
  }

  /** Rouvre la liste, par exemple quand le champ reprend le focus. */
  show(): void {
    if (this.#state.suggestions.length > 0 && !this.#state.open) {
      this.#update({ open: true });
    }
  }

  close(): void {
    if (this.#state.open) {
      this.#update({ open: false, activeIndex: -1 });
    }
  }

  next(): void {
    this.#move(1);
  }

  previous(): void {
    this.#move(-1);
  }

  /** Met en avant une suggestion, par exemple au survol. */
  activate(index: number): void {
    if (index >= -1 && index < this.#state.suggestions.length && index !== this.#state.activeIndex) {
      this.#update({ activeIndex: index });
    }
  }

  /** Choisit la suggestion `index`, ou celle mise en avant. Sans effet si aucune ne correspond. */
  select(index: number = this.#state.activeIndex): void {
    const suggestion = this.#state.suggestions[index];
    if (suggestion === undefined) {
      return;
    }

    this.abort();
    this.#update({ query: suggestion.nom, status: 'ready', activeIndex: -1, open: false });
    this.#onSelect?.(suggestion);
  }

  /**
   * Traite une touche du champ (`KeyboardEvent.key`). Renvoie vrai si elle a été utilisée :
   * l'appelant doit alors appeler `preventDefault()`. Entrée sans suggestion mise en avant
   * n'est pas utilisée, pour laisser le formulaire se soumettre.
   */
  handleKey(key: string): boolean {
    switch (key) {
      case 'ArrowDown':
        if (!this.#state.open) {
          this.show();

          return this.#state.open;
        }
        this.next();

        return true;
      case 'ArrowUp':
        if (!this.#state.open) {
          return false;
        }
        this.previous();

        return true;
      case 'Enter':
        if (!this.#state.open || this.#state.activeIndex < 0) {
          return false;
        }
        this.select();

        return true;
      case 'Escape':
        if (!this.#state.open) {
          return false;
        }
        this.close();

        return true;
      default:
        return false;
    }
  }

  /** Annule la recherche en attente ou en cours. Le contrôleur reste utilisable. */
  abort(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#request?.abort();
    this.#request = undefined;
  }

  /** Annule la recherche en cours et retire tous les abonnés. */
  destroy(): void {
    this.abort();
    this.#listeners.clear();
  }

  async #load(query: string): Promise<void> {
    const request = new AbortController();
    this.#request = request;

    try {
      const suggestions = await this.#source(query.trim(), request.signal);
      if (request.signal.aborted) {
        return;
      }

      this.#update({ suggestions, status: 'ready', activeIndex: -1, open: suggestions.length > 0, error: undefined });
    } catch (error) {
      if (request.signal.aborted) {
        return;
      }

      this.#update({ suggestions: [], status: 'error', activeIndex: -1, open: false, error });
      this.#onError?.(error);
    } finally {
      if (this.#request === request) {
        this.#request = undefined;
      }
    }
  }

  #move(step: 1 | -1): void {
    const count = this.#state.suggestions.length;
    if (!this.#state.open || count === 0) {
      return;
    }

    // Depuis aucune sélection (-1), la flèche du bas va à la première, celle du haut à la dernière.
    const from = this.#state.activeIndex < 0 && step < 0 ? count : this.#state.activeIndex;
    this.#update({ activeIndex: (from + step + count) % count });
  }

  #update(changes: Partial<SuggestionState>): void {
    this.#state = { ...this.#state, ...changes };
    for (const listener of this.#listeners) {
      listener(this.#state);
    }
  }
}

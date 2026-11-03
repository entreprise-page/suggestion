/**
 * Adaptateur React 18+ : le hook `useSuggestion()` et le composant `EntrepriseSuggestion`.
 *
 * Écrit avec `createElement` plutôt qu'en JSX pour que les sources s'exécutent telles quelles
 * sous Node, comme le reste du paquet.
 *
 * @module
 */

import type { Suggestion } from '@entreprise-page/api-client/browser';
import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { SuggestionController, type SuggestionOptions, type SuggestionState } from './controller.ts';

export * from './controller.ts';
export type { Suggestion } from '@entreprise-page/api-client/browser';

export interface UseSuggestion {
  readonly controller: SuggestionController;
  readonly state: SuggestionState;
}

/**
 * Crée un contrôleur pour la durée de vie du composant. `onSelect` et `onError` peuvent changer
 * à chaque rendu ; les autres options ne sont lues qu'au premier.
 */
export function useSuggestion(options: SuggestionOptions = {}): UseSuggestion {
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  const [controller] = useState(
    () =>
      new SuggestionController({
        ...options,
        onSelect: (suggestion) => callbacks.current.onSelect?.(suggestion),
        onError: (error) => callbacks.current.onError?.(error),
      }),
  );
  // abort() et non destroy() : en StrictMode, l'effet est rejoué sur le même contrôleur.
  useEffect(() => () => controller.abort(), [controller]);

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  return { controller, state };
}

export interface EntrepriseSuggestionProps extends SuggestionOptions {
  /** Appelé à chaque changement de la saisie, frappe ou sélection. */
  onQueryChange?: ((query: string) => void) | undefined;
  renderOption?: ((suggestion: Suggestion, active: boolean) => ReactNode) | undefined;
  /** Attributs de l'`<input>` (`name`, `placeholder`, `className`…). */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> | undefined;
  className?: string | undefined;
}

/**
 * Champ d'autocomplétion. Le conteneur reçoit la classe `suggestion-open` quand la liste est ouverte.
 *
 * ```tsx
 * <EntrepriseSuggestion inputProps={{ placeholder: 'SIREN, nom…' }} onSelect={(s) => navigate(`/${s.slug}`)} />
 * ```
 */
export function EntrepriseSuggestion(props: EntrepriseSuggestionProps): ReactElement {
  const { onQueryChange, renderOption, inputProps, className, ...options } = props;
  const id = useId();
  const { controller, state } = useSuggestion(options);
  const { open, suggestions, activeIndex, query } = state;
  const optionId = (index: number): string => `${id}-${index}`;

  const lastQuery = useRef(query);
  useEffect(() => {
    if (lastQuery.current !== query) {
      lastQuery.current = query;
      onQueryChange?.(query);
    }
  });

  return createElement(
    'div',
    { className: ['entreprise-suggestion', open ? 'suggestion-open' : '', className ?? ''].join(' ').trim() },
    createElement('input', {
      type: 'search',
      ...inputProps,
      value: query,
      autoComplete: 'off',
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-controls': id,
      'aria-expanded': open,
      'aria-activedescendant': activeIndex >= 0 ? optionId(activeIndex) : undefined,
      onChange: (event) => {
        controller.setQuery(event.target.value);
        inputProps?.onChange?.(event);
      },
      onKeyDown: (event) => {
        if (!event.nativeEvent.isComposing && controller.handleKey(event.key)) {
          event.preventDefault();
        }
        inputProps?.onKeyDown?.(event);
      },
      onFocus: (event) => {
        controller.show();
        inputProps?.onFocus?.(event);
      },
      onBlur: (event) => {
        controller.close();
        inputProps?.onBlur?.(event);
      },
    }),
    open
      ? createElement(
          'ul',
          { id, role: 'listbox', className: 'suggestions', onMouseDown: (event) => event.preventDefault() },
          suggestions.map((suggestion, index) =>
            createElement(
              'li',
              {
                key: suggestion.siren,
                id: optionId(index),
                role: 'option',
                'aria-selected': index === activeIndex,
                className: [index === activeIndex ? 'active' : '', suggestion.active ? '' : 'inactive']
                  .join(' ')
                  .trim(),
                onClick: () => controller.select(index),
                onMouseMove: () => controller.activate(index),
              },
              renderOption !== undefined
                ? renderOption(suggestion, index === activeIndex)
                : [
                    createElement('b', { key: 'nom' }, suggestion.nom),
                    ' ',
                    createElement('span', { key: 'localite' }, suggestion.localite),
                    ' ',
                    createElement('i', { key: 'activite' }, suggestion.activite),
                  ],
            ),
          ),
        )
      : null,
  );
}

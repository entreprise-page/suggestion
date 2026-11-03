import type { Suggestion } from '@entreprise-page/api-client/browser';
import { SuggestionController, type SuggestionOptions, type SuggestionState } from './controller.ts';

export interface SuggestionClasses {
  /** Ajoutée au parent du champ quand la liste est ouverte. `suggestion-open` par défaut. */
  open?: string | undefined;
  /** `suggestions` par défaut. */
  list?: string | undefined;
  /** Suggestion mise en avant. `active` par défaut. */
  active?: string | undefined;
  /** Entreprise cessée. `inactive` par défaut. */
  inactive?: string | undefined;
}

export interface AttachOptions extends SuggestionOptions {
  /**
   * Remplit l'élément d'une suggestion. Par défaut : `<b>nom</b> <span>localité</span> <i>activité</i>`.
   * Utiliser `textContent` plutôt que `innerHTML` : les noms viennent des registres publics.
   */
  render?: ((suggestion: Suggestion, option: HTMLLIElement) => void) | undefined;
  classes?: SuggestionClasses | undefined;
}

export interface SuggestionWidget {
  readonly controller: SuggestionController;
  /** Retire la liste et les écouteurs ajoutés au champ. */
  destroy(): void;
}

let instances = 0;

/**
 * Branche l'autocomplétion sur un champ existant. La liste est insérée juste après le champ,
 * avec les rôles ARIA du motif combobox.
 */
export function attach(input: HTMLInputElement, options: AttachOptions = {}): SuggestionWidget {
  const controller = new SuggestionController({ ...options, query: options.query ?? input.value });
  const render = options.render ?? renderSuggestion;
  const classes = {
    open: options.classes?.open ?? 'suggestion-open',
    list: options.classes?.list ?? 'suggestions',
    active: options.classes?.active ?? 'active',
    inactive: options.classes?.inactive ?? 'inactive',
  };
  const document = input.ownerDocument;
  const id = `entreprise-suggestion-${++instances}`;

  const list = document.createElement('ul');
  list.id = id;
  list.className = classes.list;
  list.setAttribute('role', 'listbox');
  // Garde le focus dans le champ au clic, sinon le blur fermerait la liste avant le click.
  list.addEventListener('mousedown', (event) => event.preventDefault());

  const previousAutocomplete = input.getAttribute('autocomplete');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');

  let rendered: readonly Suggestion[] = [];
  let elements: HTMLLIElement[] = [];

  const update = (state: SuggestionState): void => {
    if (input.value !== state.query) {
      input.value = state.query;
    }

    if (state.suggestions !== rendered) {
      rendered = state.suggestions;
      elements = rendered.map((suggestion, index) => {
        const option = document.createElement('li');
        option.id = `${id}-${index}`;
        option.setAttribute('role', 'option');
        option.classList.toggle(classes.inactive, !suggestion.active);
        option.addEventListener('click', () => controller.select(index));
        option.addEventListener('mousemove', () => controller.activate(index));
        render(suggestion, option);

        return option;
      });
      list.replaceChildren(...elements);
    }

    elements.forEach((option, index) => {
      const active = index === state.activeIndex;
      option.classList.toggle(classes.active, active);
      option.setAttribute('aria-selected', String(active));
    });

    const active = elements[state.activeIndex];
    if (active !== undefined) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView?.({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }

    input.setAttribute('aria-expanded', String(state.open));
    input.parentElement?.classList.toggle(classes.open, state.open);
    if (state.open && !list.isConnected) {
      input.after(list);
    } else if (!state.open && list.isConnected) {
      list.remove();
    }
  };

  const onInput = (): void => controller.setQuery(input.value);
  const onKeydown = (event: KeyboardEvent): void => {
    if (!event.isComposing && controller.handleKey(event.key)) {
      event.preventDefault();
    }
  };
  const onFocus = (): void => controller.show();
  const onBlur = (): void => controller.close();

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', onBlur);
  const unsubscribe = controller.subscribe(update);

  return {
    controller,
    destroy() {
      unsubscribe();
      controller.destroy();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      for (const attribute of [
        'role',
        'aria-autocomplete',
        'aria-controls',
        'aria-expanded',
        'aria-activedescendant',
      ]) {
        input.removeAttribute(attribute);
      }
      if (previousAutocomplete === null) {
        input.removeAttribute('autocomplete');
      } else {
        input.setAttribute('autocomplete', previousAutocomplete);
      }
      input.parentElement?.classList.remove(classes.open);
      list.remove();
    },
  };
}

/** Rendu par défaut d'une suggestion : `<b>nom</b> <span>localité</span> <i>activité</i>`. */
export function renderSuggestion(suggestion: Suggestion, option: HTMLLIElement): void {
  const document = option.ownerDocument;
  const parts: [string, string][] = [
    ['b', suggestion.nom],
    ['span', suggestion.localite],
    ['i', suggestion.activite],
  ];

  option.replaceChildren(
    ...parts.map(([tag, text]) => {
      const element = document.createElement(tag);
      element.textContent = text;

      return element;
    }),
  );
}

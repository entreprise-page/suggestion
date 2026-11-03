/**
 * Adaptateur Vue 3.5+ : le composable `useSuggestion()` et le composant `EntrepriseSuggestion`.
 *
 * @module
 */

import type { PublicClient, Suggestion } from '@entreprise-page/api-client/browser';
import {
  defineComponent,
  getCurrentScope,
  h,
  onScopeDispose,
  shallowRef,
  useId,
  watch,
  type PropType,
  type ShallowRef,
  type SlotsType,
  type VNodeChild,
} from 'vue';
import {
  SuggestionController,
  type SuggestionOptions,
  type SuggestionSource,
  type SuggestionState,
} from './controller.ts';

export * from './controller.ts';
export type { Suggestion } from '@entreprise-page/api-client/browser';

export interface UseSuggestion {
  readonly controller: SuggestionController;
  /** Remplacé à chaque changement d'état. */
  readonly state: Readonly<ShallowRef<SuggestionState>>;
}

/**
 * Crée un contrôleur dont l'état est exposé en ref. Le contrôleur est détruit avec le scope
 * courant (composant ou `effectScope`).
 */
export function useSuggestion(options: SuggestionOptions = {}): UseSuggestion {
  const controller = new SuggestionController(options);
  const state = shallowRef(controller.getState());
  controller.subscribe((next) => (state.value = next));

  if (getCurrentScope() !== undefined) {
    onScopeDispose(() => controller.destroy());
  }

  return { controller, state };
}

/**
 * Champ d'autocomplétion. Les attributs (`name`, `placeholder`, `class`…) vont sur l'`<input>`,
 * le conteneur reçoit la classe `suggestion-open` quand la liste est ouverte.
 *
 * ```vue
 * <EntrepriseSuggestion v-model="saisie" placeholder="SIREN, nom…" @select="(s) => router.push(`/${s.slug}`)">
 *   <template #option="{ suggestion }">{{ suggestion.nom }}</template>
 * </EntrepriseSuggestion>
 * ```
 *
 * Les props sont lues au montage : changer `client`, `source` ou `limit` ensuite n'a pas d'effet.
 */
export const EntrepriseSuggestion = defineComponent({
  name: 'EntrepriseSuggestion',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    client: { type: Object as PropType<PublicClient>, default: undefined },
    baseUrl: { type: String, default: undefined },
    source: { type: Function as PropType<SuggestionSource>, default: undefined },
    limit: { type: Number, default: undefined },
    minLength: { type: Number, default: undefined },
    debounce: { type: Number, default: undefined },
  },
  emits: {
    'update:modelValue': (value: string) => typeof value === 'string',
    select: (suggestion: Suggestion) => suggestion !== undefined,
    error: (error: unknown) => error !== undefined,
  },
  slots: Object as SlotsType<{ option: { suggestion: Suggestion; active: boolean } }>,
  setup(props, { attrs, emit, slots }) {
    const id = useId();
    const { controller, state } = useSuggestion({
      client: props.client,
      baseUrl: props.baseUrl,
      source: props.source,
      limit: props.limit,
      minLength: props.minLength,
      debounce: props.debounce,
      query: props.modelValue,
      onSelect: (suggestion) => emit('select', suggestion),
      onError: (error) => emit('error', error),
    });

    watch(
      () => state.value.query,
      (query) => emit('update:modelValue', query),
    );
    watch(
      () => props.modelValue,
      (value) => value !== state.value.query && controller.setQuery(value),
    );

    return (): VNodeChild => {
      const { open, suggestions, activeIndex, query } = state.value;
      const optionId = (index: number): string => `${id}-${index}`;

      return h('div', { class: ['entreprise-suggestion', { 'suggestion-open': open }] }, [
        h('input', {
          type: 'search',
          ...attrs,
          value: query,
          autocomplete: 'off',
          role: 'combobox',
          'aria-autocomplete': 'list',
          'aria-controls': id,
          'aria-expanded': String(open),
          'aria-activedescendant': activeIndex >= 0 ? optionId(activeIndex) : undefined,
          onInput: (event: Event) => controller.setQuery((event.target as HTMLInputElement).value),
          onKeydown: (event: KeyboardEvent) => {
            if (!event.isComposing && controller.handleKey(event.key)) {
              event.preventDefault();
            }
          },
          onFocus: () => controller.show(),
          onBlur: () => controller.close(),
        }),
        open
          ? h(
              'ul',
              { id, role: 'listbox', class: 'suggestions', onMousedown: (event: Event) => event.preventDefault() },
              suggestions.map((suggestion, index) =>
                h(
                  'li',
                  {
                    key: suggestion.siren,
                    id: optionId(index),
                    role: 'option',
                    'aria-selected': String(index === activeIndex),
                    class: { active: index === activeIndex, inactive: !suggestion.active },
                    onClick: () => controller.select(index),
                    onMousemove: () => controller.activate(index),
                  },
                  slots.option?.({ suggestion, active: index === activeIndex }) ?? [
                    h('b', suggestion.nom),
                    ' ',
                    h('span', suggestion.localite),
                    ' ',
                    h('i', suggestion.activite),
                  ],
                ),
              ),
            )
          : null,
      ]);
    };
  },
});

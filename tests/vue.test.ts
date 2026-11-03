import { key, type } from './dom.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp, effectScope, h, nextTick, ref } from 'vue';
import { EntrepriseSuggestion, useSuggestion } from '../src/vue.ts';
import { fakeSource, flush } from './helpers.ts';
import type { Suggestion } from '@entreprise-page/api-client/browser';

async function settle(): Promise<void> {
  await flush();
  await nextTick();
}

test('useSuggestion expose l’état en ref et se détruit avec son scope', async () => {
  const scope = effectScope();
  const { controller, state } = scope.run(() => useSuggestion({ source: fakeSource(), debounce: 0 }))!;

  controller.setQuery('google');
  await flush();
  assert.equal(state.value.suggestions.length, 2);

  scope.stop();
  controller.close();
  assert.equal(state.value.open, true, 'plus d’abonné après la fin du scope');
});

test('le composant affiche les suggestions, émet select et met à jour v-model', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const saisie = ref('');
  const selected: Suggestion[] = [];
  const app = createApp({
    render: () =>
      h(EntrepriseSuggestion, {
        source: fakeSource(),
        debounce: 0,
        name: 'entreprise',
        modelValue: saisie.value,
        'onUpdate:modelValue': (value: string) => (saisie.value = value),
        onSelect: (suggestion: Suggestion) => selected.push(suggestion),
      }),
  });
  app.mount('#app');

  const input = document.querySelector('input')!;
  assert.equal(input.name, 'entreprise', 'les attributs vont sur l’input');
  assert.equal(input.type, 'search');

  type(input, 'google');
  await settle();
  assert.equal(saisie.value, 'google');
  assert.equal(document.querySelectorAll('li').length, 2);
  assert.ok(document.querySelector('.entreprise-suggestion')!.classList.contains('suggestion-open'));
  assert.equal(input.getAttribute('aria-controls'), document.querySelector('ul')!.id);
  assert.equal(document.querySelectorAll('li')[1]!.querySelector('img'), null);

  key(input, 'ArrowDown');
  await nextTick();
  assert.equal(input.getAttribute('aria-activedescendant'), document.querySelector('li.active')!.id);
  assert.equal(key(input, 'Enter').defaultPrevented, true);
  await nextTick();

  assert.equal(selected[0]?.siren, '443061841');
  assert.equal(saisie.value, 'GOOGLE FRANCE');
  assert.equal(input.value, 'GOOGLE FRANCE');
  assert.equal(document.querySelector('ul'), null);
  app.unmount();
});

test('le slot option remplace le rendu par défaut', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = createApp({
    render: () =>
      h(
        EntrepriseSuggestion,
        { source: fakeSource(), debounce: 0 },
        { option: ({ suggestion }: { suggestion: Suggestion }) => `${suggestion.nom} (${suggestion.siren})` },
      ),
  });
  app.mount('#app');

  type(document.querySelector('input')!, 'google');
  await settle();

  assert.equal(document.querySelector('li')!.textContent, 'GOOGLE FRANCE (443061841)');
  app.unmount();
});

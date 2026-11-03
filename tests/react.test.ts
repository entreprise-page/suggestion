import { key, type } from './dom.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EntrepriseSuggestion } from '../src/react.ts';
import { fakeSource, flush } from './helpers.ts';
import type { Suggestion } from '@entreprise-page/api-client/browser';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('le composant affiche les suggestions et choisit au clavier', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const root = createRoot(document.getElementById('app')!);
  const selected: Suggestion[] = [];
  const queries: string[] = [];

  await act(() =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(EntrepriseSuggestion, {
          source: fakeSource(),
          debounce: 0,
          inputProps: { name: 'entreprise' },
          onSelect: (suggestion) => selected.push(suggestion),
          onQueryChange: (query) => queries.push(query),
        }),
      ),
    ),
  );

  const input = document.querySelector('input')!;
  assert.equal(input.name, 'entreprise');

  await act(async () => {
    type(input, 'google');
    await flush();
  });
  assert.equal(document.querySelectorAll('li').length, 2);
  assert.ok(document.querySelector('.entreprise-suggestion')!.classList.contains('suggestion-open'));
  assert.equal(input.getAttribute('aria-controls'), document.querySelector('ul')!.id);
  assert.equal(document.querySelectorAll('li')[1]!.querySelector('img'), null);
  assert.ok(document.querySelectorAll('li')[1]!.classList.contains('inactive'));

  await act(() => key(input, 'ArrowDown'));
  assert.equal(input.getAttribute('aria-activedescendant'), document.querySelector('li.active')!.id);
  let enter: KeyboardEvent | undefined;
  await act(() => {
    enter = key(input, 'Enter');
  });

  assert.equal(enter?.defaultPrevented, true);
  assert.equal(selected[0]?.siren, '443061841');
  assert.equal(input.value, 'GOOGLE FRANCE');
  assert.deepEqual(queries, ['google', 'GOOGLE FRANCE']);
  assert.equal(document.querySelector('ul'), null);

  await act(() => root.unmount());
});

test('renderOption remplace le rendu par défaut et suit les derniers callbacks', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const root = createRoot(document.getElementById('app')!);
  const calls: string[] = [];
  const render = (label: string) =>
    root.render(
      createElement(EntrepriseSuggestion, {
        source: fakeSource(),
        debounce: 0,
        renderOption: (suggestion) => createElement('em', null, suggestion.siren),
        onSelect: () => calls.push(label),
      }),
    );

  await act(() => render('premier'));
  await act(() => render('second'));
  await act(async () => {
    type(document.querySelector('input')!, 'google');
    await flush();
  });

  assert.equal(document.querySelector('li')!.innerHTML, '<em>443061841</em>');
  await act(() => (document.querySelector('li') as HTMLElement).click());
  assert.deepEqual(calls, ['second']);

  await act(() => root.unmount());
});

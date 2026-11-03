import { key, type } from './dom.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attach } from '../src/index.ts';
import { fakeSource, flush } from './helpers.ts';

function setup(): { form: HTMLFormElement; input: HTMLInputElement } {
  document.body.innerHTML = '<form class="search"><input type="search" name="entreprise"></form>';

  return { form: document.querySelector('form')!, input: document.querySelector('input')! };
}

test('affiche les suggestions après le champ, avec les rôles ARIA', async () => {
  const { form, input } = setup();
  attach(input, { source: fakeSource(), debounce: 0 });

  type(input, 'google');
  await flush();

  const list = input.nextElementSibling!;
  assert.equal(list.tagName, 'UL');
  assert.equal(list.className, 'suggestions');
  assert.equal(list.getAttribute('role'), 'listbox');
  assert.equal(input.getAttribute('role'), 'combobox');
  assert.equal(input.getAttribute('aria-controls'), list.id);
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(input.getAttribute('autocomplete'), 'off');
  assert.ok(form.classList.contains('suggestion-open'));

  const options = list.querySelectorAll('li');
  assert.equal(options.length, 2);
  assert.equal(options[0]!.innerHTML, '<b>GOOGLE FRANCE</b><span>75009</span><i>Programmation informatique</i>');
  assert.ok(options[1]!.classList.contains('inactive'));
});

test('n’interprète pas le HTML contenu dans les noms', async () => {
  const { input } = setup();
  attach(input, { source: fakeSource(), debounce: 0 });

  type(input, 'gain');
  await flush();

  const option = document.querySelectorAll('li')[1]!;
  assert.equal(option.querySelector('img'), null);
  assert.equal(option.querySelector('b')!.textContent, 'GAIN EMILE <img src=x onerror=alert(1)>');
});

test('choisit au clavier et remplit le champ', async () => {
  const { form, input } = setup();
  const selected: string[] = [];
  attach(input, { source: fakeSource(), debounce: 0, onSelect: (s) => selected.push(s.slug) });

  type(input, 'google');
  await flush();
  assert.equal(key(input, 'ArrowDown').defaultPrevented, true);
  assert.equal(input.getAttribute('aria-activedescendant'), document.querySelector('li')!.id);
  assert.equal(document.querySelector('li')!.getAttribute('aria-selected'), 'true');
  assert.equal(key(input, 'Enter').defaultPrevented, true);

  assert.deepEqual(selected, ['google-france-443061841']);
  assert.equal(input.value, 'GOOGLE FRANCE');
  assert.equal(document.querySelector('ul'), null);
  assert.ok(!form.classList.contains('suggestion-open'));
});

test('choisit au clic', async () => {
  const { input } = setup();
  const selected: string[] = [];
  attach(input, { source: fakeSource(), debounce: 0, onSelect: (s) => selected.push(s.siren) });

  type(input, 'gain');
  await flush();
  (document.querySelectorAll('li')[1] as HTMLElement).click();

  assert.deepEqual(selected, ['097380463']);
});

test('destroy() rend le champ dans son état d’origine', async () => {
  const { input } = setup();
  input.setAttribute('autocomplete', 'organization');
  const widget = attach(input, { source: fakeSource(), debounce: 0 });
  type(input, 'google');
  await flush();

  widget.destroy();
  type(input, 'googl');
  await flush();

  assert.equal(document.querySelector('ul'), null);
  assert.equal(input.getAttribute('autocomplete'), 'organization');
  assert.equal(input.hasAttribute('role'), false);
});

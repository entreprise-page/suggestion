import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { SuggestionController } from '../src/controller.ts';
import { fakeSource, flush, suggestions } from './helpers.ts';

test('appelle l’endpoint de suggestion du SDK avec la limite', async () => {
  const urls: string[] = [];
  const controller = new SuggestionController({
    baseUrl: 'https://api.test/v1',
    limit: 5,
    debounce: 0,
    fetch: async (input) => {
      urls.push(input);

      return new Response(JSON.stringify(suggestions));
    },
  });

  controller.setQuery('google ');
  await flush();

  assert.deepEqual(urls, ['https://api.test/v1/organisation/suggestion?query=google&limit=5']);
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().open, true);
  assert.equal(controller.getState().suggestions[0]?.siren, '443061841');
});

test('n’appelle pas l’API sous le nombre minimal de caractères', async () => {
  const source = fakeSource();
  const controller = new SuggestionController({ source, debounce: 0 });

  controller.setQuery('go');
  await flush();

  assert.deepEqual(source.queries, []);
  assert.equal(controller.getState().status, 'idle');
});

test('n’envoie que la dernière saisie d’une rafale de frappes', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const source = fakeSource();
    const controller = new SuggestionController({ source, debounce: 150 });

    controller.setQuery('goo');
    mock.timers.tick(100);
    controller.setQuery('goog');
    mock.timers.tick(100);
    assert.deepEqual(source.queries, []);
    assert.equal(controller.getState().status, 'loading');

    mock.timers.tick(50);
    assert.deepEqual(source.queries, ['goog']);
  } finally {
    mock.timers.reset();
  }
});

test('annule la requête dépassée et ignore sa réponse', async () => {
  const signals: AbortSignal[] = [];
  let respond: (value: typeof suggestions) => void = () => {};
  const controller = new SuggestionController({
    debounce: 0,
    source: (query, signal) => {
      signals.push(signal);

      return query === 'goo' ? new Promise((resolve) => (respond = resolve)) : Promise.resolve(suggestions.slice(1));
    },
  });

  controller.setQuery('goo');
  await flush();
  controller.setQuery('gain');
  await flush();
  respond(suggestions);
  await flush();

  assert.equal(signals[0]?.aborted, true);
  assert.deepEqual(
    controller.getState().suggestions.map((s) => s.siren),
    ['097380463'],
  );
});

test('passe en erreur sans ouvrir la liste', async () => {
  const errors: unknown[] = [];
  const controller = new SuggestionController({
    debounce: 0,
    source: () => Promise.reject(new Error('réseau')),
    onError: (error) => errors.push(error),
  });

  controller.setQuery('google');
  await flush();

  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().open, false);
  assert.equal((errors[0] as Error).message, 'réseau');
});

test('navigue au clavier en boucle et choisit la suggestion mise en avant', async () => {
  const selected: string[] = [];
  const controller = new SuggestionController({
    source: fakeSource(),
    debounce: 0,
    onSelect: (s) => selected.push(s.slug),
  });
  controller.setQuery('google');
  await flush();

  assert.equal(controller.handleKey('Enter'), false, 'Entrée sans sélection laisse soumettre le formulaire');
  assert.equal(controller.handleKey('ArrowUp'), true);
  assert.equal(controller.getState().activeIndex, 1);
  controller.handleKey('ArrowDown');
  assert.equal(controller.getState().activeIndex, 0);
  controller.handleKey('ArrowDown');
  controller.handleKey('ArrowDown');
  assert.equal(controller.getState().activeIndex, 0);

  assert.equal(controller.handleKey('Enter'), true);
  assert.deepEqual(selected, ['google-france-443061841']);
  assert.equal(controller.getState().query, 'GOOGLE FRANCE');
  assert.equal(controller.getState().open, false);
});

test('Échap ferme la liste, flèche du bas la rouvre', async () => {
  const controller = new SuggestionController({ source: fakeSource(), debounce: 0 });
  controller.setQuery('google');
  await flush();

  assert.equal(controller.handleKey('Escape'), true);
  assert.equal(controller.getState().open, false);
  assert.equal(controller.handleKey('Escape'), false);
  assert.equal(controller.handleKey('ArrowDown'), true);
  assert.equal(controller.getState().open, true);
});

test('produit un nouvel état à chaque changement et désabonne', async () => {
  const controller = new SuggestionController({ source: fakeSource(), debounce: 0 });
  const states: unknown[] = [];
  const unsubscribe = controller.subscribe((state) => states.push(state));

  const initial = controller.getState();
  controller.setQuery('google');
  await flush();
  unsubscribe();
  controller.close();

  assert.equal(states.length, 2);
  assert.notEqual(states[0], initial);
  assert.equal(states.at(-1), states[1]);
});

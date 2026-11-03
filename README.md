# @entreprise-page/suggestion

Autocomplétion d'entreprises françaises par nom, SIREN ou SIRET, comme sur la page d'accueil d'[entreprise.page](https://entreprise.page). Pour JavaScript natif, Vue 3.5+ et React 18+.

- S'appuie sur [`@entreprise-page/api-client`](https://github.com/entreprise-page/api-client-js) : aucune clé d'API, les requêtes restent des requêtes CORS simples.
- Délai entre les frappes, annulation des requêtes dépassées, navigation au clavier (flèches, Entrée, Échap).
- Accessible : rôles ARIA du motif [combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
- Les noms d'entreprises sont insérés en texte, jamais en HTML.
- Paquet ESM. Vue et React sont facultatifs : n'installez que celui que vous utilisez.

## Installation

```bash
npm install @entreprise-page/suggestion
```

Un style minimal est fourni, à importer si besoin :

```js
import '@entreprise-page/suggestion/style.css';
```

## JavaScript natif

```html
<form class="search">
  <input type="search" name="entreprise" placeholder="Dénomination sociale, SIREN, SIRET" />
</form>
```

```js
import { attach } from '@entreprise-page/suggestion';

const widget = attach(document.querySelector('input[name="entreprise"]'), {
  onSelect: (suggestion) => (window.location.href = `https://entreprise.page/${suggestion.slug}`),
});

// widget.destroy() retire la liste et les écouteurs.
```

La liste `<ul class="suggestions">` est insérée juste après le champ, et le parent du champ reçoit la classe `suggestion-open` tant qu'elle est ouverte. Chaque `<li>` contient `<b>nom</b><span>localité</span><i>activité</i>` ; l'option `render(suggestion, li)` remplace ce contenu, et `classes` renomme les classes.

## Vue

```vue
<script setup>
import { ref } from 'vue';
import { EntrepriseSuggestion } from '@entreprise-page/suggestion/vue';

const saisie = ref('');
</script>

<template>
  <EntrepriseSuggestion
    v-model="saisie"
    name="entreprise"
    placeholder="SIREN, nom…"
    @select="(s) => $router.push(`/${s.slug}`)"
  >
    <!-- facultatif -->
    <template #option="{ suggestion, active }">
      <strong>{{ suggestion.nom }}</strong> {{ suggestion.localite }}
    </template>
  </EntrepriseSuggestion>
</template>
```

Les attributs non déclarés (`name`, `placeholder`, `class`…) vont sur l'`<input>`. Pour un rendu entièrement personnalisé, le composable `useSuggestion(options)` renvoie `{ controller, state }`, où `state` est une ref.

## React

```tsx
import { EntrepriseSuggestion } from '@entreprise-page/suggestion/react';

<EntrepriseSuggestion
  inputProps={{ name: 'entreprise', placeholder: 'SIREN, nom…' }}
  onSelect={(s) => navigate(`/${s.slug}`)}
  renderOption={(s) => <strong>{s.nom}</strong>} // facultatif
/>;
```

Pour un rendu entièrement personnalisé, le hook `useSuggestion(options)` renvoie `{ controller, state }`.

## Options

Communes aux trois intégrations (props du composant en Vue et React) :

| Option      | Défaut                           | Rôle                                                             |
| ----------- | -------------------------------- | ---------------------------------------------------------------- |
| `limit`     | `10`                             | nombre de suggestions, de 1 à 10                                 |
| `minLength` | `3`                              | nombre de caractères à partir duquel l'API est appelée           |
| `debounce`  | `150`                            | délai en ms entre la dernière frappe et l'appel                  |
| `client`    |                                  | `PublicClient` à réutiliser                                      |
| `baseUrl`   | `https://api.entreprise.page/v1` | URL de l'API, si `client` n'est pas fourni                       |
| `fetch`     | `globalThis.fetch`               | pour ajouter du cache, des retries ou des logs                   |
| `source`    |                                  | `(query, signal) => Promise<Suggestion[]>`, remplace l'appel API |
| `onSelect`  |                                  | appelé avec la `Suggestion` choisie                              |
| `onError`   |                                  | appelé si l'appel échoue (pas pour une annulation)               |

Une `Suggestion` contient `siren`, `nom`, `localite`, `activite`, `active` (fausse pour une entreprise cessée, qui reçoit la classe `inactive`) et `slug`.

## Sans DOM

`SuggestionController` contient toute la logique et sert de base aux trois intégrations. Il permet d'en écrire une autre (Svelte, Web Component…) :

```js
import { SuggestionController } from '@entreprise-page/suggestion';

const controller = new SuggestionController({ onSelect: console.log });
controller.subscribe((state) => render(state)); // { query, suggestions, status, activeIndex, open, error }

input.addEventListener('input', () => controller.setQuery(input.value));
input.addEventListener('keydown', (e) => controller.handleKey(e.key) && e.preventDefault());
```

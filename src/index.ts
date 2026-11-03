/**
 * Point d'entrée JavaScript natif : le contrôleur sans DOM et `attach()`, qui le branche sur un champ.
 *
 * @module
 */

export {
  SuggestionController,
  type SuggestionOptions,
  type SuggestionSource,
  type SuggestionState,
  type SuggestionStatus,
} from './controller.ts';
export { attach, renderSuggestion, type AttachOptions, type SuggestionClasses, type SuggestionWidget } from './dom.ts';
export { PublicClient, type Suggestion } from '@entreprise-page/api-client/browser';

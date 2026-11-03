import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Importé en tête des tests qui ont besoin d'un DOM.
if (typeof globalThis.document === 'undefined') {
  GlobalRegistrator.register({ url: 'https://entreprise.test/' });
}

export function key(element: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);

  return event;
}

/** Saisit `value` comme un utilisateur, en passant par le setter natif (que React surveille). */
export function type(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Test-only shim: jsdom has no HTMLDialogElement.showModal/close.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
}

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
});

import { signal, WritableSignal } from '@angular/core';

import { getFieldServerError, isFieldInvalid } from '@app/shared/utils/form-field.util';

export { getFieldServerError, isFieldInvalid };

export function createPasswordToggle(): {
  show: WritableSignal<boolean>;
  toggle: () => void;
} {
  const show = signal(false);
  return { show, toggle: () => show.update(value => !value) };
}

/** Sync national phone digits into the tel input so password managers save the login identifier. */
export function syncTelInputValueForCredentialSave(
  inputId: string,
  phoneUsername: string | null | undefined
): void {
  if (!phoneUsername) {
    return;
  }

  const input = document.getElementById(inputId);
  if (input instanceof HTMLInputElement) {
    input.value = phoneUsername;
  }
}
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

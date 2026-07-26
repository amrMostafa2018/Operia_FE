import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';

import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';

@Component({
  selector: 'app-auth-phone-field',
  standalone: true,
  imports: [ReactiveFormsModule, NgxIntlTelInputModule, TranslatePipe],
  templateUrl: './auth-phone-field.component.html',
  styleUrl: './auth-phone-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true }),
    },
  ],
})
export class AuthPhoneFieldComponent {
  readonly controlName = input('phone');
  readonly inputId = input.required<string>();
  readonly labelKey = input.required<string>();
  readonly placeholderKey = input.required<string>();
  readonly invalid = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly showWhatsappHint = input(false);

  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = PHONE_INPUT_DEFAULT_COUNTRY;
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;
}

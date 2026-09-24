import { computed, inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/services/language.service';
import { AuthStore } from '@core/store/auth.store';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private readonly authStore = inject(AuthStore);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  readonly currencyCode = computed(() => {
    const code = this.authStore.currencyCode();
    return code?.trim() ? code : null;
  });

  readonly hasCurrency = computed(() => this.currencyCode() !== null);

  readonly currencyLabel = computed(() => {
    const code = this.currencyCode();
    if (!code) {
      return '';
    }

    this.languageService.currentLang();

    const key = `COMMON.CURRENCY_SYMBOLS.${code}`;
    const translated = this.translate.instant(key);
    return translated === key ? code : translated;
  });
}

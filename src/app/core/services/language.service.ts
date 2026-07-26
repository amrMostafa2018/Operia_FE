import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNGConfig } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

import { getPrimeNgLocale } from '@core/config/primeng-locale';

export type AppLanguage = 'en' | 'ar';

const STORAGE_KEY = 'operia_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);
  private readonly primeConfig = inject(PrimeNGConfig);

  readonly supportedLanguages: AppLanguage[] = ['ar', 'en'];
  readonly currentLang = signal<AppLanguage>('ar');

  async init(): Promise<void> {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    const lang = saved && this.supportedLanguages.includes(saved) ? saved : 'ar';
    await this.applyLanguage(lang);
  }

  get current(): AppLanguage {
    return this.currentLang();
  }

  setLanguage(lang: AppLanguage): void {
    if (!this.supportedLanguages.includes(lang) || lang === this.current) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, lang);
    void this.applyLanguage(lang);
  }

  private applyLanguage(lang: AppLanguage): Promise<void> {
    this.currentLang.set(lang);
    const html = this.document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    this.configurePrimeNg(lang);

    return firstValueFrom(this.translate.use(lang)).then(() => undefined);
  }

  private configurePrimeNg(lang: AppLanguage): void {
    this.primeConfig.setTranslation(getPrimeNgLocale(lang));
  }
}

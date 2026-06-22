import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AppLanguage, LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  private readonly languageService = inject(LanguageService);

  readonly languages: AppLanguage[] = this.languageService.supportedLanguages;
  readonly current = computed(() => this.languageService.currentLang());

  setLanguage(lang: AppLanguage): void {
    this.languageService.setLanguage(lang);
  }
}

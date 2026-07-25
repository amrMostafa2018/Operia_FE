import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { AuthStore } from '@core/store/auth.store';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { OnboardingStateService } from '@core/services/onboarding-state.service';
import { LanguageSwitcherComponent } from '@app/shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly onboardingState = inject(OnboardingStateService);
  readonly authStore = inject(AuthStore);

  toggleSidebar = output<void>();

  private readonly onboardingStatus = toSignal(
    this.onboardingService.getStatus().pipe(catchError(() => of(null))),
    { initialValue: null }
  );

  readonly businessName = computed(
    () =>
      this.authStore.currentUser()?.businessName ??
      this.onboardingStatus()?.business?.businessName ??
      this.onboardingState.businessSetup()?.businessName ??
      ''
  );

  readonly userName = computed(() => this.authStore.currentUser()?.name?.trim() ?? '');

  readonly userInitials = computed(() =>
    this.userName()
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase()
  );

  readonly currentDate = computed(() => {
    this.languageService.currentLang();
    const now = new Date();
    return now.toLocaleDateString(this.languageService.currentLang() === 'ar' ? 'ar-EG' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });

  logout(): void {
    this.authService.logout();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }
}

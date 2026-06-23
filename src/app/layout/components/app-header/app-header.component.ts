import { Component, inject, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthStore } from '../../../core/store/auth.store';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);
  readonly authStore = inject(AuthStore);

  toggleSidebar = output<void>();

  get userName(): string {
    const user = this.authStore.currentUser();
    return user?.name ?? user?.email ?? '';
  }

  get userInitials(): string {
    const name = this.userName;
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }

  get currentDate(): string {
    const now = new Date();
    return now.toLocaleDateString(
      this.languageService.currentLang() === 'ar' ? 'ar-EG' : 'en-GB',
      { day: '2-digit', month: '2-digit', year: 'numeric' }
    );
  }

  logout(): void {
    this.authService.logout();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }
}

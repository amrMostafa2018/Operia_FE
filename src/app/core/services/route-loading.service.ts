import { inject, Injectable, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter } from 'rxjs';

const MIN_VISIBLE_MS = 250;

@Injectable({ providedIn: 'root' })
export class RouteLoadingService {
  private readonly router = inject(Router);
  private hideTimer?: ReturnType<typeof setTimeout>;
  private shownAt = 0;

  readonly navigating = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter(
          event =>
            event instanceof NavigationStart ||
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError
        )
      )
      .subscribe(event => {
        if (event instanceof NavigationStart) {
          this.onNavigationStart(event.url);
          return;
        }

        this.scheduleHide();
      });
  }

  private onNavigationStart(targetUrl: string): void {
    if (!this.isPathChange(this.router.url, targetUrl)) {
      return;
    }

    this.clearHideTimer();
    if (!this.navigating()) {
      this.shownAt = Date.now();
      this.navigating.set(true);
    }
  }

  private scheduleHide(): void {
    this.clearHideTimer();

    if (!this.navigating()) {
      return;
    }

    const remaining = MIN_VISIBLE_MS - (Date.now() - this.shownAt);
    if (remaining <= 0) {
      this.navigating.set(false);
      return;
    }

    this.hideTimer = setTimeout(() => this.navigating.set(false), remaining);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  private isPathChange(currentUrl: string, targetUrl: string): boolean {
    return this.pathOf(currentUrl) !== this.pathOf(targetUrl);
  }

  private pathOf(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    return path.replace(/\/+$/, '') || '/';
  }
}

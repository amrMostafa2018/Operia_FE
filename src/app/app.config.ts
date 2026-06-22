import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { catchError, firstValueFrom, of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';

/**
 * On startup: try to exchange a stored refresh token for a new access token.
 * The app continues loading regardless of whether this succeeds or fails.
 */
function initAuth(authService: AuthService): () => Promise<boolean> {
  return () =>
    firstValueFrom(authService.restoreSession().pipe(catchError(() => of(false))));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // errorInterceptor must be outer (registered first) so jwtInterceptor
    // (inner, closer to the backend) handles 401s with token refresh before
    // errorInterceptor sees the error.
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, jwtInterceptor])
    ),
    provideAnimationsAsync(),
    MessageService,
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};

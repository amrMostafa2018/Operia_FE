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
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError, firstValueFrom, of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { routes } from '@app/app.routes';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { jwtInterceptor } from '@core/interceptors/jwt.interceptor';
import { languageInterceptor } from '@core/interceptors/language.interceptor';

function initAuth(authService: AuthService): () => Promise<boolean> {
  return () =>
    firstValueFrom(authService.restoreSession().pipe(catchError(() => of(false))));
}

function initLanguage(languageService: LanguageService): () => Promise<void> {
  return () => languageService.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([languageInterceptor, errorInterceptor, jwtInterceptor])
    ),
    provideAnimationsAsync(),
    provideTranslateService({
      lang: 'ar',
      fallbackLang: 'en',
    }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
      useHttpBackend: true,
    }),
    MessageService,
    {
      provide: APP_INITIALIZER,
      useFactory: initLanguage,
      deps: [LanguageService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};

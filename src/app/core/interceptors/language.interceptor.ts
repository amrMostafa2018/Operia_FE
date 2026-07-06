import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { LanguageService } from '@core/services/language.service';

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const languageService = inject(LanguageService);
  const lang = languageService.currentLang();

  return next(
    req.clone({
      setHeaders: {
        'Accept-Language': lang,
      },
    })
  );
};

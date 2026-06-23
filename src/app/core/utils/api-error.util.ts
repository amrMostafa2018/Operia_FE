import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  title?: string;
  errors?: Record<string, string[]>;
}

export function extractApiError(error: HttpErrorResponse): string {
  const body = error.error as ApiErrorBody | null;

  if (body?.errors) {
    const messages = Object.values(body.errors).flat();
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return body?.title ?? 'Request failed.';
}

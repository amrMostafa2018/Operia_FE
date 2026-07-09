import { environment } from '@env/environment';

export function resolveUploadUrl(path: string | null | undefined): string {
  if (!path || path.startsWith('data:') || path.startsWith('http')) {
    return path ?? '';
  }

  const origin = environment.apiUrl.replace(/\/api\/?$/, '');
  return `${origin}${path}`;
}

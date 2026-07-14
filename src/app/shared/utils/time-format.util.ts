import { AppLanguage } from '@core/services/language.service';

const localeByLang: Record<AppLanguage, string> = {
  ar: 'ar-EG',
  en: 'en-US',
};

export function formatAppTime(
  date: Date | null | undefined,
  lang: AppLanguage
): string {
  if (!date) {
    return '';
  }

  if (lang === 'ar') {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const isPm = hours >= 12;
    const hour12 = hours % 12 || 12;
    const minutePart = String(minutes).padStart(2, '0');
    const hourPart = String(hour12).padStart(2, '0');
    return `${hourPart}:${minutePart} ${isPm ? 'م' : 'ص'}`;
  }

  return new Intl.DateTimeFormat(localeByLang[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    numberingSystem: 'latn',
  }).format(date);
}

export function parseAppTimeInput(
  text: string,
  fallbackPm = false
): Date | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '--:--') {
    return null;
  }

  const meridiemMatch = trimmed.match(/\s*(ص|م|AM|PM|am|pm)\s*$/);
  const meridiemToken = meridiemMatch?.[1];
  const timePart = meridiemToken
    ? trimmed.slice(0, meridiemMatch!.index).trim()
    : trimmed;

  const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return null;
  }

  let hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59 || hour < 1 || hour > 12) {
    return null;
  }

  let isPm = fallbackPm;
  if (meridiemToken === 'م' || meridiemToken?.toUpperCase() === 'PM') {
    isPm = true;
  } else if (meridiemToken === 'ص' || meridiemToken?.toUpperCase() === 'AM') {
    isPm = false;
  }

  if (isPm && hour !== 12) {
    hour += 12;
  } else if (!isPm && hour === 12) {
    hour = 0;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

import { AppLanguage } from '@core/services/language.service';

const localeByLang: Record<AppLanguage, string> = {
  ar: 'ar-EG',
  en: 'en-US',
};

export function getAppDateLocale(lang: AppLanguage): string {
  return localeByLang[lang];
}

export function formatAppTime(date: Date | null | undefined, lang: AppLanguage): string {
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

/** Formats a 24h `HH:mm` string for display with AM/PM (or ص/م in Arabic). */
export function formatAppTimeString(time: string | null | undefined, lang: AppLanguage): string {
  if (!time) {
    return '';
  }

  const [hoursPart, minutesPart] = time.split(':');
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatAppTime(date, lang);
}

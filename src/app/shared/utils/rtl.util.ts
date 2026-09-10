export function getSubmitArrowIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right';
}

export function getSubmitIconPos(lang: string): 'left' | 'right' {
  return lang === 'ar' ? 'left' : 'right';
}

/** PrimeNG renders the icon before the label; in RTL, iconPos "right" adds the inner gap. */
export function getLeadingIconPos(lang: string): 'left' | 'right' {
  return lang === 'ar' ? 'right' : 'left';
}

export function getPrevArrowIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-arrow-right' : 'pi pi-arrow-left';
}

export function getNextArrowIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right';
}

export function getPrevChevronIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-chevron-right' : 'pi pi-chevron-left';
}

export function getNextChevronIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-chevron-left' : 'pi pi-chevron-right';
}

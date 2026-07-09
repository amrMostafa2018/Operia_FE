export function getSubmitArrowIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right';
}

export function getSubmitIconPos(lang: string): 'left' | 'right' {
  return lang === 'ar' ? 'left' : 'right';
}

export function getPrevArrowIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-arrow-right' : 'pi pi-arrow-left';
}

export function getPrevIconPos(lang: string): 'left' | 'right' {
  return lang === 'ar' ? 'right' : 'left';
}

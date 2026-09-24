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

export function getCarouselPrevIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-chevron-right' : 'pi pi-chevron-left';
}

export function getCarouselNextIcon(lang: string): string {
  return lang === 'ar' ? 'pi pi-chevron-left' : 'pi pi-chevron-right';
}

export type RtlScrollType = 'default' | 'negative' | 'reverse';

let cachedRtlScrollType: RtlScrollType | null = null;

/** Detect how the browser maps scrollLeft on overflow:auto + direction:rtl. */
export function getRtlScrollType(): RtlScrollType {
  if (cachedRtlScrollType) {
    return cachedRtlScrollType;
  }

  if (typeof document === 'undefined') {
    cachedRtlScrollType = 'default';
    return cachedRtlScrollType;
  }

  const outer = document.createElement('div');
  outer.appendChild(document.createElement('div'));
  outer.style.cssText =
    'width:1px;height:1px;overflow:scroll;position:absolute;top:-9999px;direction:rtl';
  const inner = outer.firstElementChild as HTMLElement;
  inner.style.width = '2px';
  document.body.appendChild(outer);

  if (outer.scrollLeft > 0) {
    cachedRtlScrollType = 'reverse';
  } else {
    outer.scrollLeft = -1;
    cachedRtlScrollType = outer.scrollLeft < 0 ? 'negative' : 'default';
  }

  document.body.removeChild(outer);
  return cachedRtlScrollType;
}

export function getRtlAwareScrollDelta(direction: -1 | 1, step: number, isRtl: boolean): number {
  if (!isRtl) {
    return direction * step;
  }

  const type = getRtlScrollType();
  return type === 'default' ? direction * step : -direction * step;
}

export function getRtlStartScrollLeft(track: HTMLElement, isRtl: boolean): number {
  if (!isRtl) {
    return 0;
  }

  const type = getRtlScrollType();
  if (type === 'reverse') {
    return Math.max(track.scrollWidth - track.clientWidth, 0);
  }
  return 0;
}

export function getRtlScrollPosition(track: HTMLElement, isRtl: boolean): { position: number; maxScroll: number } {
  const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0);
  if (!isRtl) {
    return { position: track.scrollLeft, maxScroll };
  }

  const type = getRtlScrollType();
  if (type === 'negative') {
    return { position: Math.abs(track.scrollLeft), maxScroll };
  }
  if (type === 'reverse') {
    return { position: Math.max(maxScroll - track.scrollLeft, 0), maxScroll };
  }
  return { position: track.scrollLeft, maxScroll };
}

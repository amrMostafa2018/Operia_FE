import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/**
 * ngx-intl-tel-input hardcodes autocomplete="off" on its inner input.
 * This directive marks the phone field as the credential username for password managers.
 */
@Directive({
  selector: 'ngx-intl-tel-input[appPhoneUsernameAutocomplete]',
  standalone: true,
})
export class PhoneUsernameAutocompleteDirective implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    this.apply();
  }

  private apply(): void {
    const input = this.host.nativeElement.querySelector('.iti__tel-input');
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    input.autocomplete = 'username';
    input.name = 'username';
  }
}

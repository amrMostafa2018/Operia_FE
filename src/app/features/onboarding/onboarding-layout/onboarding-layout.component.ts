import { Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-onboarding-layout',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './onboarding-layout.component.html',
  styleUrl: './onboarding-layout.component.scss',
})
export class OnboardingLayoutComponent {
  currentStep = input(2);
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { RouteLoadingService } from '@core/services/route-loading.service';

@Component({
  selector: 'app-route-loading-overlay',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './route-loading-overlay.component.html',
  styleUrl: './route-loading-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteLoadingOverlayComponent {
  readonly routeLoading = inject(RouteLoadingService);
}

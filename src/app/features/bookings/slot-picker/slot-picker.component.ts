import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { AvailabilitySlot } from '../models/booking.model';

@Component({
  selector: 'app-slot-picker',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlotPickerComponent {
  readonly slots = input<AvailabilitySlot[]>([]);
  readonly loading = input(false);
  readonly selectedStart = input<string | null>(null);
  readonly selectedEnd = input<string | null>(null);

  readonly slotSelected = output<{ start: string; end: string }>();

  readonly availableSlots = computed(() => this.slots().filter(s => s.isAvailable));

  selectSlot(slot: AvailabilitySlot): void {
    if (!slot.isAvailable) return;
    this.slotSelected.emit({ start: slot.start, end: slot.end });
  }

  isSelected(slot: AvailabilitySlot): boolean {
    return this.selectedStart() === slot.start && this.selectedEnd() === slot.end;
  }
}

/** Covers slot building, working hours, bookings, and active hold conflicts. */
import {
  AppointmentAvailabilityBlock,
  BookingRecord,
  buildAvailableSlots,
  buildSlotGrid,
  buildSlotRows,
  calendarDayRange,
  EmployeeOption,
  EmployeeWorkingHours,
} from './booking.model';

describe('buildAvailableSlots', () => {
  const date = new Date(2026, 8, 20);
  const workingDays: EmployeeWorkingHours[] = [
    { day: 'sun', enabled: true, fromMinutes: 9 * 60, toMinutes: 12 * 60 },
  ];

  it('rebuilds the slot boundaries when the duration changes', () => {
    const thirtyMinuteSlots = buildAvailableSlots([], 'employee-1', date, 30, workingDays);
    const fortyFiveMinuteSlots = buildAvailableSlots([], 'employee-1', date, 45, workingDays);

    expect(thirtyMinuteSlots).toEqual([
      { startMinutes: 540, endMinutes: 570 },
      { startMinutes: 570, endMinutes: 600 },
      { startMinutes: 600, endMinutes: 630 },
      { startMinutes: 630, endMinutes: 660 },
      { startMinutes: 660, endMinutes: 690 },
      { startMinutes: 690, endMinutes: 720 },
    ]);
    expect(fortyFiveMinuteSlots).toEqual([
      { startMinutes: 540, endMinutes: 585 },
      { startMinutes: 585, endMinutes: 630 },
      { startMinutes: 630, endMinutes: 675 },
      { startMinutes: 675, endMinutes: 720 },
    ]);
  });

  it('offers 30-minute slot-first starts before a customer or package is selected', () => {
    const slots = buildAvailableSlots([], 'employee-1', date, 0, workingDays);
    const grid = buildSlotGrid([], 'employee-1', date, 0, workingDays, 540, 720);

    expect(slots).toHaveSize(6);
    expect(slots[0]).toEqual({ startMinutes: 540, endMinutes: 570 });
    expect(grid.filter(cell => cell.selectable)).toHaveSize(6);
  });

  it('starts new full-duration slots after occupied time', () => {
    const booking = {
      employeeId: 'employee-1',
      scheduledDate: date,
      startMinutes: 585,
      slotDurationMinutes: 30,
      status: 'booked',
    } as BookingRecord;
    const hold: AppointmentAvailabilityBlock = {
      id: 'hold-1',
      employeeId: 'employee-1',
      scheduledDate: date,
      startMinutes: 675,
      endMinutes: 690,
    };

    expect(buildAvailableSlots([booking], 'employee-1', date, 45, workingDays, [hold])).toEqual([
      { startMinutes: 540, endMinutes: 585 },
      { startMinutes: 615, endMinutes: 660 },
    ]);
  });

  it('keeps the full calendar day visible around shorter staff hours', () => {
    const employee = { workingDays } as EmployeeOption;

    expect(calendarDayRange([{ employee, date }])).toEqual({
      startMinutes: 8 * 60,
      endMinutes: 18 * 60,
    });
  });

  it('includes the final 20:30–21:00 appointment when staff work until 21:00', () => {
    const eveningHours: EmployeeWorkingHours[] = [
      { day: 'sun', enabled: true, fromMinutes: 9 * 60, toMinutes: 21 * 60 },
    ];
    const employee = { workingDays: eveningHours } as EmployeeOption;
    const range = calendarDayRange([{ employee, date }]);
    const slots = buildAvailableSlots([], 'employee-1', date, 30, eveningHours);

    expect(range.endMinutes).toBe(21 * 60);
    expect(buildSlotRows(range.startMinutes, range.endMinutes).at(-1)).toBe(20 * 60 + 30);
    expect(slots.at(-1)).toEqual({ startMinutes: 20 * 60 + 30, endMinutes: 21 * 60 });
  });
});

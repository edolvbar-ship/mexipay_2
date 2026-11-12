import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { CalendarComponent } from './calendar.component';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarComponent, FormsModule, DatePickerModule]
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with last 90 days', () => {
    const today = new Date();
    const past90Days = new Date();
    past90Days.setDate(today.getDate() - 90);
    expect(component.rangeDates[0].getTime()).toBeCloseTo(past90Days.getTime(), -3);
    expect(component.rangeDates[1].getTime()).toBeCloseTo(today.getTime(), -3);
  });

  it('should emit formatted date range on valid selection', () => {
    const spy = spyOn(component.dateEmitted, 'emit');
    component.rangeDates = [new Date('2025-01-01'), new Date('2025-01-10')];
    component.onDateSelect();
    expect(spy).toHaveBeenCalledWith({
      initial: '2025-01-01',
      final: '2025-01-10'
    });
  });

  it('should not emit if dates are incomplete', () => {
    const spy = spyOn(component.dateEmitted, 'emit');
    component.rangeDates = [new Date()];
    component.onDateSelect();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should swap dates if start is after end', () => {
    const spy = spyOn(component.dateEmitted, 'emit');
    component.rangeDates = [new Date('2025-01-10'), new Date('2025-01-01')];
    component.onDateSelect();
    expect(spy).toHaveBeenCalledWith({
      initial: '2025-01-01',
      final: '2025-01-10'
    });
  });
});

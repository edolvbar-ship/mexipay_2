import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';

@Component({
    selector: 'app-annual-calendar',
    imports: [DatePicker, FormsModule],
    templateUrl: './annual-calendar.component.html',
    styleUrl: './annual-calendar.component.css'
})
export class AnnualCalendarComponent {
  constructor() {
    this.maxDate = new Date();
  }

  @Output() dateSelected: EventEmitter<Date> = new EventEmitter<Date>();

  selectedDate: Date | null = this.getCurrentDate();
  options: any = {
    numberOfMonths: 12,
    view: 'year'
  };
  maxDate: Date;

  getCurrentDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  onDateSelect(event: Date | Event) {
    if (event instanceof Date) {
      this.dateSelected.emit(event);
    } else {
      return;
    }
  }

}

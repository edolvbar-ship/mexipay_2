import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { DateRange } from '../../interfaces/types-interface';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FormsModule, DatePickerModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit {
  @Input() disabled: boolean = false;
  @Input() rangeDates: Date[] = [];
  @Output() dateEmitted: EventEmitter<DateRange> = new EventEmitter<DateRange>();
  today: Date = new Date();

  ngOnInit(): void {
    // Only set default range if no range was provided via input
    if (!this.rangeDates || this.rangeDates.length === 0) {
      this.rangeDates = this.getLastMonth();
      this.onDateSelect();
    }
  }

  onDateSelect(): void {
    if (this.rangeDates?.length === 2 && this.rangeDates[0] && this.rangeDates[1]) {
      if (this.rangeDates[0] > this.rangeDates[1]) {
        [this.rangeDates[0], this.rangeDates[1]] = [this.rangeDates[1], this.rangeDates[0]];
      }
      const dateRange: DateRange = {
        initial: this.formatDateToYYYYMMDD(this.rangeDates[0]),
        final: this.formatDateToYYYYMMDD(this.rangeDates[1])
      };
      this.dateEmitted.emit(dateRange);
    }
  }

  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getLastMonth(): Date[] {
    const today = new Date();
    const past90Days = new Date();
    past90Days.setDate(today.getDate() - 90);
    return [past90Days, today];
  }
}

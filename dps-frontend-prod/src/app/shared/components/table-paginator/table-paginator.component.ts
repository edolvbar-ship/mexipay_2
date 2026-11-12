import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PaginatorModule } from 'primeng/paginator';

interface PageEvent {
  page?: number;
  first?: number;
  rows?: number;
  pageCount?: number;
}

@Component({
    selector: 'table-paginator',
    imports: [PaginatorModule],
    templateUrl: './table-paginator.component.html',
    styleUrl: './table-paginator.component.css'
})
export class TablePaginatorComponent implements OnChanges{

  @Input() rows: number = 10;
  @Input() totalRecords: number = 0;

  @Output() pageChanged: EventEmitter<PageEvent> = new EventEmitter<PageEvent>();
  @Output() rowsChanged: EventEmitter<PageEvent> = new EventEmitter<PageEvent>();

  first: number = 0;
  currentPage: number = 0;

    onPageChange(event: PageEvent) {
      this.first = event.first ?? 0;
      this.rows = event.rows ?? this.rows;
      this.currentPage = event.page ?? 0;
      this.pageChanged.emit(event);
    }

    ngOnChanges(changes: SimpleChanges) {
      if (changes['rows']) {
        
        this.updateData()
      }
    }

    updateData(): void {
      const pageEvent: PageEvent = {
        rows: this.rows,
        page: this.currentPage,
        first: this.first
      };
      this.rowsChanged.emit(pageEvent);
    }

}

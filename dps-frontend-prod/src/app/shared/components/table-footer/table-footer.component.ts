import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TablePaginatorComponent } from '../table-paginator/table-paginator.component';
import { TableCountElementComponent } from '../table-count-element/table-count-element.component';
import { CommonModule } from '@angular/common';

interface Items {
  name: string;
  code: number;
}

interface PageEvent {
  page?: number;
  first?: number;
  rows?: number;
  pageCount?: number;
}
@Component({
    selector: 'table-footer',
    imports: [TablePaginatorComponent, TableCountElementComponent, CommonModule],
    templateUrl: './table-footer.component.html',
    styleUrl: './table-footer.component.css'
})
export class TableFooterComponent implements OnChanges {

  itemsPerPage: number = 10;
  @Input() data: any[] = []

  @Output() paginationData: EventEmitter<PageEvent> = new EventEmitter<PageEvent>
  @Output() updatePaginationData: EventEmitter<PageEvent> = new EventEmitter<PageEvent>


  get totalRecords() {
    return this.data.length
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itemsPerPage']) {
    }
  }
  
  handleSelectionChange(itemsPerPage: Items ): number {
    return this.itemsPerPage = itemsPerPage?.code
  }

  handlePageSelection(paginationData: PageEvent):void{
    this.paginationData.emit(paginationData)
  }

  updatedPagination(newRows: PageEvent) {
    this.updatePaginationData.emit(newRows)
  }

}
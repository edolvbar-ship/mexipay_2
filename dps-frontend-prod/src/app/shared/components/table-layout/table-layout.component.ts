import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { HeaderTableSearchComponent } from '../header-table-search/header-table-search.component';
import { BasicTableComponent } from '../basic-table/basic-table.component';
import { TableFooterComponent } from '../table-footer/table-footer.component';
import { DataTablePageEventInterface } from '@/app/shared/interfaces/data-table.interface'
import { CustomTableAction } from '../../interfaces/types-interface';
import { ActionButtonComponent } from "../action-button/action-button.component";
import { ButtonFilterComponent } from "../button-filter/button-filter.component";
import { CommonModule } from '@angular/common';

@Component({
    selector: 'table-layout',
    imports: [HeaderTableSearchComponent, BasicTableComponent, TableFooterComponent, ButtonFilterComponent, CommonModule],
    templateUrl: './table-layout.component.html',
    styleUrl: './table-layout.component.css'
})
export class TableLayoutComponent<T extends {}>  implements OnChanges {

  constructor(private cdr: ChangeDetectorRef) {

  }

  @Input() dataTable: T[] = [];
  @Input() actions: any[] = [];
  @Input() showActions: boolean = false;
  @Input() customActions: CustomTableAction<T>[] = [];
  @Input() actionsColumnIndex: number | null = null;
  @Input() hiddenColumns: string[] = []
  @Input() filter: boolean = false;
  @Input() columnsWithSum: string[] = []


  @Output() rowData = new EventEmitter <any>()


  dataList: string[] = ['']
  rows: number = 10;
  first: number = 0;
  page: number = 0;

  onRowSelected(event: Event) {
    this.rowData.emit(event)
  }

  handlePaginationTable(data: DataTablePageEventInterface): void {
    this.rows = data?.rows ?? 0;
    this.first = data?.first ?? 0;
    this.page = data?.page ?? 0;
    this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.dataTable && this.dataTable.length > 0 && this.dataTable[0]) {
      this.dataList = Object.keys(this.dataTable[0]);
    }
  }

  handleSelectionChange(selectedItems: string[]) {
    this.hiddenColumns = selectedItems
  }

}

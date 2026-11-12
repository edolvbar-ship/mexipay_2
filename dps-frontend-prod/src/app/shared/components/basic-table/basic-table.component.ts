import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, TemplateRef, ViewChild  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { PaginatorModule } from 'primeng/paginator';
import { ButtonModule } from 'primeng/button';
import { PaginatorPipe } from '../../pipes/paginator/paginator.pipe';
import { CustomTableAction } from '../../interfaces/types-interface';

@Component({
    selector: 'basic-table',
    imports: [CommonModule, TableModule, PaginatorModule, ButtonModule, PaginatorPipe],
    templateUrl: './basic-table.component.html',
    styleUrl: './basic-table.component.css'
})
export class BasicTableComponent<T extends {}> implements OnChanges{

  @Input() values: Record<string, any>[] = [];
  @Input() first: number = 0;
  @Input() rows: number = 10;
  @Input() page: number = 0;
  @Input() actions: any[] = [];
  @Input() showActions: boolean = false; 
  @Input() customActions: CustomTableAction<T>[] = [];
  @Input() actionsColumnIndex: number | null = null;
  @Input() hiddenColumns: string[] = ['terminal_device_idterm_device', 'smart_device_idsmtdevice'];
  

  @Output() rowSelected = new EventEmitter <any>()
  
  toggleAction: boolean = false;
  selectedRowIndex: number | null = null;
  activeButtons: boolean= false; 
  @Input() columnsWithSum: string[] = [];

  // Debugging methods
  debugToggleClick(index: number, row: any) {
    console.log('Toggle clicked for row:', index, 'row:', row);
  }

  debugEditClick(row: any) {
    console.log('Edit clicked for row:', row);
  }

  debugDeleteClick(row: any) {
    console.log('Delete clicked for row:', row);
  }

  debugViewClick(row: any) {
    console.log('View clicked for row:', row);
  }


  ngOnChanges(changes: SimpleChanges) {
    if (changes['page']) {
      this.first = this.page * this.rows;
    }
  }

  switchToggle(index: number, isHovered: boolean): void{
    if(!this.toggleAction) {
      this.selectedRowIndex = this.selectedRowIndex === index ? null : index;
      this.toggleAction = isHovered;
      setTimeout (() => {
        this.toggleAction = false;
      }, 4000)
    } else {
      this.toggleAction = true;
      this.selectedRowIndex = this.selectedRowIndex === index ? null : index;
      setTimeout (() => {
        this.toggleAction = false;
      }, 4000)
    }
  }

  switchViewToggle(index: number): void {
    console.log('switchViewToggle called with index:', index, 'current selectedRowIndex:', this.selectedRowIndex, 'current toggleAction:', this.toggleAction);
    
    if (this.selectedRowIndex === index) {
        this.selectedRowIndex = null;
        this.toggleAction = false;
        console.log('Closing menu for index:', index);
    } else {
        this.selectedRowIndex = index;
        this.toggleAction = true;
        console.log('Opening menu for index:', index);
    }
    
    console.log('After toggle - selectedRowIndex:', this.selectedRowIndex, 'toggleAction:', this.toggleAction);
  }

  clientStatus: string[] = [
    'Aprobado',
    'Error',
    'Procesado',
    'Procesando',
    'Pagado',
    'En Espera',
    'Activo',
    'Inactivo',
    'Pendiente',
    'Liquidado',
    'Expirado'
  ];

  get headers() {
    if (this.values.length <= 0) {
      return ['No se encontró información'];
    } else {
      const headerNames = Object.keys(this.values[0]).filter( (header) => header != "metadata" && !this.hiddenColumns.includes(header) );
      return headerNames;
    }
  }

  getTotal(column: string): number {
    return parseFloat(
        this.values.reduce((sum: number, row) => {
            const value = row[column];
            if (typeof value === 'number') {
                return sum + value;
            }
            if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                return sum + parseFloat(value);
            }
            return sum;  // Keep sum as number
        }, 0).toFixed(2)
    );
}

  isStatusCell(cell: string): boolean {
    let word = this.clientStatus.filter((status) => status.includes(cell))
    if(word) {
      return true
    } else {
      return false
    }
  }

  getStatusClass(cell: string): string {
    const statusClasses: { [key: string]: string } = {
        'Liquidado': 'bg-green',
        'Aprobado': 'bg-green',
        'Procesado': 'bg-green',
        'Pagado': 'bg-green',
        'Activo': 'bg-green',
        'Expirado': 'bg-red',
        'Rechazada': 'bg-red',
        'Error': 'bg-red',
        'Inactivo': 'bg-red',
        'Devolución': 'bg-yellow',
        'Pendiente': 'bg-yellow',
        'En Espera': 'bg-yellow',
        'Procesando': 'bg-blue'
    };

    return statusClasses[cell] || '';
  }

  getURL(url: string): string {
    if (url.startsWith("https://")) {
        return url;
    } else {
        return "https://" + url.trim();
    }
}


  onRowClick(row: any) {
    this.rowSelected.emit(row);
  }
  
}

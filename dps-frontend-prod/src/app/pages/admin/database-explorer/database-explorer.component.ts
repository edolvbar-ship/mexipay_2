import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService, MessageService } from 'primeng/api';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { PanelModule } from 'primeng/panel';
import { MenuModule } from 'primeng/menu';
import { TreeModule } from 'primeng/tree';
import { DividerModule } from 'primeng/divider';
import { AccordionModule } from 'primeng/accordion';
import { ChipModule } from 'primeng/chip';
import { ToolbarModule } from 'primeng/toolbar';
import { FileUploadModule } from 'primeng/fileupload';

import { DatabaseExplorerService, TableInfo, ColumnInfo, TableSchema, RecordsResponse, QueryRecordsRequest } from '@/app/services/admin/database-explorer/database-explorer.service';
import { RecordEditorComponent } from './record-editor/record-editor.component';
import { TableBrowserComponent } from './table-browser/table-browser.component';
import { DatabaseStatsComponent } from './database-stats/database-stats.component';

interface FilterState {
  [key: string]: any;
}

@Component({
  selector: 'app-database-explorer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule,
    BadgeModule,
    TagModule,
    InputNumberModule,
    CheckboxModule,
    MultiSelectModule,
    ProgressSpinnerModule,
    SkeletonModule,
    PanelModule,
    MenuModule,
    TreeModule,
    DividerModule,
    ChipModule,
    ToolbarModule,
    FileUploadModule,
    RecordEditorComponent,
    TableBrowserComponent,
    DatabaseStatsComponent
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './database-explorer.component.html',
  styleUrls: ['./database-explorer.component.css']
})
export default class DatabaseExplorerComponent implements OnInit {
  @ViewChild('recordEditor') recordEditor!: RecordEditorComponent;

  private destroy$ = new Subject<void>();

  // Tables
  tables: TableInfo[] = [];
  selectedTable: TableInfo | null = null;
  tableSchema: TableSchema | null = null;

  // Records
  records: any[] = [];
  columns: ColumnInfo[] = [];
  visibleColumns: string[] = [];
  selectedRecords: any[] = [];

  // Pagination
  totalRecords = 0;
  page = 1;
  limit = 50;
  loading = false;
  rowsPerPageOptions = [10, 25, 50, 100, 250];

  // Sorting
  sortField = '';
  sortOrder: 'ASC' | 'DESC' = 'ASC';

  // Filters
  globalSearch = '';
  filters: FilterState = {};
  showFilters = false;

  // Dialogs
  showRecordDialog = false;
  dialogMode: 'create' | 'edit' | 'view' = 'view';
  currentRecord: any = null;
  showSchemaDialog = false;

  // Batch operations
  showBatchOperations = false;

  // Export
  exportLoading = false;

  // UI State
  sidebarVisible = true;
  activeTab = 0;
  showStats = false;

  // Expose Object for template
  Object = Object;

  constructor(
    public dbService: DatabaseExplorerService,
    private toastr: ToastrService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================================
  // TABLE MANAGEMENT
  // ============================================================================

  loadTables(): void {
    this.loading = true;
    this.dbService.getTables()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tables) => {
          this.tables = tables.sort((a, b) => a.tableName.localeCompare(b.tableName));
          this.loading = false;
        },
        error: (err) => {
          this.toastr.error('Error al cargar tablas: ' + err.message, 'Error');
          this.loading = false;
        }
      });
  }

  onTableSelect(table: TableInfo): void {
    this.selectedTable = table;
    this.selectedRecords = [];
    this.page = 1;
    this.globalSearch = '';
    this.filters = {};
    this.sortField = '';
    
    this.loadTableSchema(table.tableName);
    this.loadRecords();
  }

  loadTableSchema(tableName: string): void {
    this.dbService.getTableSchema(tableName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (schema) => {
          this.tableSchema = schema;
          this.columns = schema.columns;
          this.visibleColumns = schema.columns.map(c => c.columnName);
        },
        error: (err) => {
          this.toastr.error('Error al cargar esquema: ' + err.message, 'Error');
        }
      });
  }

  // ============================================================================
  // RECORD OPERATIONS
  // ============================================================================

  loadRecords(event?: any): void {
    if (!this.selectedTable) return;

    this.loading = true;

    if (event) {
      this.page = event.first / event.rows + 1;
      this.limit = event.rows;
      if (event.sortField) {
        this.sortField = event.sortField;
        this.sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';
      }
    }

    const request: QueryRecordsRequest = {
      page: this.page,
      limit: this.limit,
      sortBy: this.sortField || undefined,
      sortOrder: this.sortOrder,
      filters: Object.keys(this.filters).length > 0 ? this.filters : undefined,
      search: this.globalSearch || undefined,
      columns: this.visibleColumns
    };

    this.dbService.getRecords(this.selectedTable.tableName, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.records = response.records;
          this.totalRecords = response.pagination.total;
          this.loading = false;
        },
        error: (err) => {
          this.toastr.error('Error al cargar registros: ' + err.message, 'Error');
          this.loading = false;
        }
      });
  }

  createRecord(): void {
    if (!this.selectedTable) return;
    this.dialogMode = 'create';
    this.currentRecord = null;
    this.showRecordDialog = true;
  }

  editRecord(record: any): void {
    this.dialogMode = 'edit';
    this.currentRecord = { ...record };
    this.showRecordDialog = true;
  }

  viewRecord(record: any): void {
    this.dialogMode = 'view';
    this.currentRecord = { ...record };
    this.showRecordDialog = true;
  }

  onRecordSaved(record: any): void {
    this.showRecordDialog = false;
    this.loadRecords();
    
    const message = this.dialogMode === 'create' 
      ? 'Registro creado exitosamente' 
      : 'Registro actualizado exitosamente';
    
    this.toastr.success(message, 'Éxito');
  }

  onRecordDialogClose(): void {
    this.showRecordDialog = false;
    this.currentRecord = null;
  }

  confirmDelete(record: any): void {
    if (!this.selectedTable || !this.tableSchema?.primaryKey) return;

    const recordId = record[this.tableSchema.primaryKey];

    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar el registro con ID ${recordId}?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.deleteRecord(recordId);
      }
    });
  }

  deleteRecord(id: string | number, force: boolean = false): void {
    if (!this.selectedTable) return;

    this.dbService.deleteRecord(this.selectedTable.tableName, id, force)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastr.success('Registro eliminado exitosamente', 'Éxito');
          this.loadRecords();
        },
        error: (err) => {
          if (err.error?.data?.relatedRecords) {
            this.confirmForceDelete(id, err.error.data.relatedRecords);
          } else {
            this.toastr.error('Error al eliminar: ' + err.message, 'Error');
          }
        }
      });
  }

  confirmForceDelete(id: string | number, relatedRecords: any[]): void {
    this.confirmationService.confirm({
      message: `Este registro tiene ${relatedRecords.length} registros relacionados. ¿Deseas forzar la eliminación?`,
      header: 'Confirmar Eliminación Forzada',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.deleteRecord(id, true);
      }
    });
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  onRecordsSelected(event: any): void {
    this.selectedRecords = event;
  }

  deleteSelected(): void {
    if (!this.selectedTable || this.selectedRecords.length === 0) return;

    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar ${this.selectedRecords.length} registros seleccionados?`,
      header: 'Confirmar Eliminación Masiva',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.batchDelete();
      }
    });
  }

  batchDelete(): void {
    if (!this.selectedTable || !this.tableSchema?.primaryKey) return;

    const records = this.selectedRecords.map(r => ({
      [this.tableSchema!.primaryKey!]: r[this.tableSchema!.primaryKey!]
    }));

    this.dbService.batchOperation(this.selectedTable.tableName, 'delete', records)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const { success, failed } = result.data;
          this.toastr.success(
            `${success.length} registros eliminados. ${failed.length} fallidos.`,
            'Operación Completada'
          );
          this.selectedRecords = [];
          this.loadRecords();
        },
        error: (err) => {
          this.toastr.error('Error en operación batch: ' + err.message, 'Error');
        }
      });
  }

  // ============================================================================
  // FILTERS
  // ============================================================================

  onFilterChange(column: string, value: any): void {
    if (value === null || value === undefined || value === '') {
      delete this.filters[column];
    } else {
      this.filters[column] = { value };
    }
  }

  onDateFilterChange(column: string, mode: 'from' | 'to', value: string | Date): void {
    if (!this.filters[column]) {
      this.filters[column] = {};
    }
    // Handle both string (from datetime-local input) and Date objects
    if (value) {
      const dateValue = typeof value === 'string' ? new Date(value) : value;
      this.filters[column][mode] = isNaN(dateValue.getTime()) ? value : dateValue.toISOString();
    } else {
      this.filters[column][mode] = undefined;
    }
    
    // Clean up if both are undefined
    if (!this.filters[column].from && !this.filters[column].to) {
      delete this.filters[column];
    }
  }

  onNumberFilterChange(column: string, mode: 'min' | 'max', value: number | null): void {
    if (!this.filters[column]) {
      this.filters[column] = {};
    }
    this.filters[column][mode] = value ?? undefined;
    
    // Clean up if both are undefined
    if (!this.filters[column].min && !this.filters[column].max) {
      delete this.filters[column];
    }
  }

  getFilterValue(column: string, key: string): any {
    return this.filters[column]?.[key] ?? null;
  }

  applyFilters(): void {
    this.page = 1;
    this.loadRecords();
  }

  clearFilters(): void {
    this.filters = {};
    this.globalSearch = '';
    this.applyFilters();
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  exportDatabase(format: 'json' | 'csv'): void {
    this.exportLoading = true;
    
    this.dbService.exportDatabase(format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `db-export-${timestamp}.${format === 'json' ? 'zip' : 'zip'}`;
          this.dbService.downloadExport(blob, filename);
          this.exportLoading = false;
          this.toastr.success('Exportación completada', 'Éxito');
        },
        error: (err) => {
          this.toastr.error('Error al exportar: ' + err.message, 'Error');
          this.exportLoading = false;
        }
      });
  }

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  getDataTypeSeverity(dataType: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | null | undefined {
    const type = dataType.toLowerCase();
    if (type.includes('int')) return 'info';
    if (type.includes('decimal') || type.includes('float')) return 'success';
    if (type.includes('varchar') || type.includes('text')) return 'warn';
    if (type.includes('date') || type.includes('time')) return 'danger';
    return 'secondary';
  }

  getVisibleColumnsInfo(): ColumnInfo[] {
    return this.columns.filter(col => this.visibleColumns.includes(col.columnName));
  }

  formatValue(value: any, column: ColumnInfo): string {
    if (value === null || value === undefined) return '';
    
    if (this.dbService.isDateType(column.dataType) && value) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toLocaleString();
    }
    
    if (this.dbService.isBooleanType(column.dataType)) {
      return value ? 'Sí' : 'No';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  toggleColumn(columnName: string): void {
    const index = this.visibleColumns.indexOf(columnName);
    if (index > -1) {
      if (this.visibleColumns.length > 1) {
        this.visibleColumns.splice(index, 1);
      }
    } else {
      this.visibleColumns.push(columnName);
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  viewSchema(): void {
    this.showSchemaDialog = true;
  }

  toggleStats(): void {
    this.showStats = !this.showStats;
  }

  onStatsClose(): void {
    this.showStats = false;
  }

  getPrimaryKeyValue(record: any): any {
    if (!this.tableSchema?.primaryKey) return null;
    return record[this.tableSchema.primaryKey];
  }

  canDeleteSelected(): boolean {
    return this.selectedRecords.length > 0 && !!this.tableSchema?.primaryKey;
  }
}

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

// PrimeNG Imports
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ChipModule } from 'primeng/chip';
import { AccordionModule } from 'primeng/accordion';
import { SkeletonModule } from 'primeng/skeleton';

import { 
  DatabaseExplorerService, 
  TableSchema, 
  ColumnInfo,
  RelationshipInfo 
} from '@/app/services/admin/database-explorer/database-explorer.service';

interface RelatedOption {
  label: string;
  value: any;
  data: any;
}

@Component({
  selector: 'app-record-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    ButtonModule,
    ProgressSpinnerModule,
    TooltipModule,
    DividerModule,
    ChipModule,
    SkeletonModule
  ],
  template: `
    <form [formGroup]="recordForm" (ngSubmit)="onSubmit()" class="record-form">
      
      <!-- Header Info -->
      <div *ngIf="tableSchema.primaryKey && record" class="mb-3 p-2 surface-50 border-round">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-key text-primary"></i>
          <span class="font-medium">{{ tableSchema.primaryKey }}:</span>
          <span class="font-bold text-primary">{{ record[tableSchema.primaryKey] }}</span>
        </div>
      </div>

      <div class="record-sections">
        <!-- Fields Section -->
        <div class="section mb-3">
          <div class="section-header p-2 surface-100 border-round-top flex align-items-center gap-2">
            <i class="pi pi-list"></i>
            <span class="font-medium">Campos</span>
          </div>
          <div class="section-content p-2 surface-50 border-round-bottom">
          <div class="grid">
            <ng-container *ngFor="let column of editableColumns">
              <div class="col-12 md:col-6 mb-2">
                <label class="block text-sm font-medium mb-1">
                  {{ column.columnName }}
                  <span *ngIf="column.isNullable === 'NO'" class="text-danger">*</span>
                  <i 
                    *ngIf="column.columnName === tableSchema.primaryKey"
                    class="pi pi-key text-primary text-xs ml-1"
                    pTooltip="Clave Primaria">
                  </i>
                </label>
                
                <!-- Text Input -->
                <ng-container *ngIf="isTextType(column.dataType)">
                  <input 
                    pInputText 
                    [formControlName]="column.columnName"
                    [attr.maxlength]="column.maxLength || null"
                    [placeholder]="getPlaceholder(column)"
                    class="w-full">
                </ng-container>

                <!-- Number Input -->
                <ng-container *ngIf="isNumericType(column.dataType)">
                  <p-inputNumber 
                    [formControlName]="column.columnName"
                    [placeholder]="getPlaceholder(column)"
                    [useGrouping]="false"
                    styleClass="w-full"
                    inputStyleClass="w-full">
                  </p-inputNumber>
                </ng-container>

                <!-- Date Input -->
                <ng-container *ngIf="isDateType(column.dataType)">
                  <input 
                    [formControlName]="column.columnName"
                    [type]="column.dataType.includes('time') || column.dataType.includes('datetime') ? 'datetime-local' : 'date'"
                    class="w-full p-inputtext p-component"
                    style="padding: 0.5rem;">
                </ng-container>

                <!-- Boolean Input -->
                <ng-container *ngIf="isBooleanType(column.dataType)">
                  <div class="flex align-items-center gap-2">
                    <p-checkbox 
                      [formControlName]="column.columnName"
                      [binary]="true">
                    </p-checkbox>
                    <span class="text-sm">{{ recordForm.get(column.columnName)?.value ? 'Sí' : 'No' }}</span>
                  </div>
                </ng-container>

                <!-- Enum Input -->
                <ng-container *ngIf="isEnumType(column.dataType)">
                  <select 
                    [formControlName]="column.columnName"
                    class="w-full p-inputtext p-component"
                    style="padding: 0.5rem;">
                    <option value="">Seleccionar {{ column.columnName }}</option>
                    <option *ngFor="let opt of getEnumOptions(column)" [value]="opt.value">{{ opt.label }}</option>
                  </select>
                </ng-container>

                <!-- Foreign Key Input -->
                <ng-container *ngIf="isForeignKey(column.columnName)">
                  <div class="flex gap-2">
                    <select 
                      [formControlName]="column.columnName"
                      class="w-full p-inputtext p-component flex-1"
                      style="padding: 0.5rem;">
                      <option value="">Seleccionar {{ column.columnName }}</option>
                      <option *ngFor="let opt of getRelatedOptions(column.columnName)" [value]="opt.value">{{ opt.label }}</option>
                    </select>
                    <p-button 
                      *ngIf="recordForm.get(column.columnName)?.value"
                      icon="pi pi-eye"
                      (onClick)="viewRelatedRecord(column.columnName)"
                      styleClass="p-button-text p-button-sm">
                    </p-button>
                  </div>
                </ng-container>

                <!-- JSON/JSONB Input -->
                <ng-container *ngIf="isJsonType(column.dataType)">
                  <textarea 
                    [formControlName]="column.columnName"
                    [rows]="5"
                    [placeholder]="'JSON válido...'"
                    class="w-full font-mono text-sm p-inputtext p-component"
                    style="padding: 0.5rem;">
                  </textarea>
                </ng-container>

                <!-- Field Hint -->
                <div class="field-hints">
                  <small class="text-xs text-color-secondary">
                    {{ column.dataType }}
                    <span *ngIf="column.maxLength">({{ column.maxLength }})</span>
                    <span *ngIf="column.isNullable === 'NO'" class="text-danger">requerido</span>
                  </small>
                </div>

                <!-- Error Message -->
                <small 
                  *ngIf="recordForm.get(column.columnName)?.invalid && recordForm.get(column.columnName)?.touched"
                  class="p-error block mt-1">
                  <span *ngIf="recordForm.get(column.columnName)?.errors?.['required']">
                    Este campo es requerido
                  </span>
                  <span *ngIf="recordForm.get(column.columnName)?.errors?.['jsonInvalid']">
                    JSON inválido
                  </span>
                </small>
              </div>
            </ng-container>
          </div>
          </div>
        </div>

        <!-- Relationships Section -->
        <div class="section mb-3" *ngIf="tableSchema.relationships.length > 0">
          <div class="section-header p-2 surface-100 border-round-top flex align-items-center gap-2">
            <i class="pi pi-sitemap"></i>
            <span class="font-medium">Relaciones</span>
          </div>
          <div class="section-content p-2 surface-50 border-round-bottom">
            <div class="relations-list">
              <div *ngFor="let rel of tableSchema.relationships" class="relation-item mb-2 p-2 surface-100 border-round">
                
                <div class="flex flex-column gap-2">
                  <div class="flex justify-content-between">
                    <span class="text-sm text-color-secondary">Columna:</span>
                    <span class="font-medium">{{ rel.columnName }}</span>
                  </div>
                  <div class="flex justify-content-between">
                    <span class="text-sm text-color-secondary">Referencia:</span>
                    <span class="font-medium">{{ rel.referencedTable }}.{{ rel.referencedColumn }}</span>
                  </div>
                  <div class="flex gap-2 mt-2">
                    <p-chip [label]="'Update: ' + rel.updateRule" icon="pi pi-refresh"></p-chip>
                    <p-chip [label]="'Delete: ' + rel.deleteRule" icon="pi pi-trash"></p-chip>
                  </div>
                  <div *ngIf="recordForm.get(rel.columnName)?.value" class="mt-2 p-2 surface-0 border-round">
                    <span class="text-sm text-color-secondary">Valor actual:</span>
                    <span class="font-medium ml-2">{{ recordForm.get(rel.columnName)?.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Raw Data Section -->
        <div class="section mb-3" *ngIf="record">
          <div class="section-header p-2 surface-100 border-round-top flex align-items-center gap-2">
            <i class="pi pi-code"></i>
            <span class="font-medium">Datos Crudos</span>
          </div>
          <div class="section-content p-2 surface-50 border-round-bottom">
            <pre class="surface-0 border-round p-3 overflow-x-auto" style="font-size: 0.75rem;">{{ record | json }}</pre>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-content-end gap-2 mt-4 pt-3 border-top-1 surface-border">
        <p-button 
          type="button"
          label="Cancelar" 
          icon="pi pi-times"
          (onClick)="cancel.emit()"
          styleClass="p-button-secondary">
        </p-button>
        
        <p-button 
          *ngIf="mode !== 'view'"
          type="submit"
          [label]="mode === 'create' ? 'Crear' : 'Guardar'" 
          [icon]="mode === 'create' ? 'pi pi-plus' : 'pi pi-save'"
          [loading]="saving"
          styleClass="p-button-primary">
        </p-button>
      </div>
    </form>
  `,
  styles: [`
    .record-form {
      min-height: 400px;
    }

    :host ::ng-deep .p-accordion .p-accordion-content {
      padding: 1rem;
    }

    .field-hints {
      margin-top: 0.25rem;
    }

    pre {
      margin: 0;
      background-color: var(--surface-100);
      border: 1px solid var(--surface-200);
    }

    select, textarea {
      font-family: inherit;
    }
  `]
})
export class RecordEditorComponent implements OnInit {
  @Input() tableSchema!: TableSchema;
  @Input() record: any = null;
  @Input() mode: 'create' | 'edit' | 'view' = 'create';
  
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  recordForm!: FormGroup;
  saving = false;
  
  relatedData: { [key: string]: RelatedOption[] } = {};
  loadingRelated: { [key: string]: boolean } = {};
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private dbService: DatabaseExplorerService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadRelatedData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get editableColumns(): ColumnInfo[] {
    return this.tableSchema.columns.filter(col => {
      // Skip auto-increment primary key in create mode
      if (this.mode === 'create' && col.columnName === this.tableSchema.primaryKey && col.extra.includes('auto_increment')) {
        return false;
      }
      return true;
    });
  }

  initForm(): void {
    const formControls: { [key: string]: any } = {};

    for (const column of this.editableColumns) {
      const value = this.record ? this.record[column.columnName] : this.getDefaultValue(column);
      const validators = this.getValidators(column);
      
      formControls[column.columnName] = [value, validators];
    }

    this.recordForm = this.fb.group(formControls);
  }

  getDefaultValue(column: ColumnInfo): any {
    // Parse default value
    if (column.defaultValue !== null) {
      // Handle current_timestamp
      if (column.defaultValue.toLowerCase().includes('current_timestamp')) {
        return new Date();
      }
      
      // Try to parse as number
      if (this.isNumericType(column.dataType)) {
        const num = parseFloat(column.defaultValue);
        if (!isNaN(num)) return num;
      }
      
      return column.defaultValue;
    }

    // Null for nullable columns
    if (column.isNullable === 'YES') {
      return null;
    }

    // Type-specific defaults
    if (this.isBooleanType(column.dataType)) {
      return false;
    }
    
    if (this.isNumericType(column.dataType)) {
      return 0;
    }

    return '';
  }

  getValidators(column: ColumnInfo) {
    const validators = [];
    
    if (column.isNullable === 'NO' && !column.extra.includes('auto_increment')) {
      validators.push(Validators.required);
    }

    if (this.isJsonType(column.dataType)) {
      validators.push(this.jsonValidator);
    }

    return validators;
  }

  jsonValidator(control: any) {
    if (!control.value) return null;
    try {
      JSON.parse(control.value);
      return null;
    } catch (e) {
      return { jsonInvalid: true };
    }
  }

  loadRelatedData(): void {
    for (const rel of this.tableSchema.relationships) {
      this.loadingRelated[rel.columnName] = true;
      
      this.dbService.getRelatedData(this.tableSchema.tableName, rel.columnName)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.relatedData[rel.columnName] = result.records.map((r: any) => ({
              label: this.formatRelatedLabel(r, result.column, result.table),
              value: r[result.column],
              data: r
            }));
            this.loadingRelated[rel.columnName] = false;
          },
          error: (err) => {
            console.error('Error loading related data:', err);
            this.loadingRelated[rel.columnName] = false;
          }
        });
    }
  }

  formatRelatedLabel(record: any, idColumn: string, tableName: string): string {
    // Try to find a descriptive field
    const possibleNameFields = ['name', 'nombre', 'description', 'descripcion', 'title', 'titulo', 
                                'fullName', 'razon_social', 'username', 'email', 'mail'];
    
    for (const field of possibleNameFields) {
      if (record[field]) {
        return `${record[field]} (${record[idColumn]})`;
      }
    }
    
    // Fallback to showing all non-null fields
    const fields = Object.entries(record)
      .filter(([k, v]) => v !== null && k !== idColumn)
      .slice(0, 2)
      .map(([k, v]) => `${v}`)
      .join(' - ');
    
    return fields || `ID: ${record[idColumn]}`;
  }

  isTextType(dataType: string): boolean {
    return this.dbService.isTextType(dataType) && !this.isEnumType(dataType) && !this.isJsonType(dataType);
  }

  isNumericType(dataType: string): boolean {
    return this.dbService.isNumericType(dataType);
  }

  isDateType(dataType: string): boolean {
    return this.dbService.isDateType(dataType);
  }

  isBooleanType(dataType: string): boolean {
    return this.dbService.isBooleanType(dataType);
  }

  isEnumType(dataType: string): boolean {
    return dataType.toLowerCase().startsWith('enum(');
  }

  isJsonType(dataType: string): boolean {
    return dataType.toLowerCase().includes('json');
  }

  isForeignKey(columnName: string): boolean {
    return this.tableSchema.relationships.some(r => r.columnName === columnName);
  }

  getRelatedOptions(columnName: string): RelatedOption[] {
    return this.relatedData[columnName] || [];
  }

  getEnumOptions(column: ColumnInfo): { label: string; value: string }[] {
    const match = column.dataType.match(/enum\((.*)\)/i);
    if (!match) return [];
    
    const values = match[1]
      .split(',')
      .map(v => v.trim().replace(/'/g, ''));
    
    return values.map(v => ({ label: v, value: v }));
  }

  getPlaceholder(column: ColumnInfo): string {
    if (column.description) {
      return column.description;
    }
    return `Ingresar ${column.columnName}`;
  }

  viewRelatedRecord(columnName: string): void {
    const relationship = this.tableSchema.relationships.find(r => r.columnName === columnName);
    const value = this.recordForm.get(columnName)?.value;
    
    if (relationship && value) {
      // Open related record in new view - could be enhanced to open modal
      this.toastr.info(`Ver registro ${value} en tabla ${relationship.referencedTable}`, 'Información');
    }
  }

  onSubmit(): void {
    if (this.recordForm.invalid) {
      this.recordForm.markAllAsTouched();
      this.toastr.error('Por favor corrija los errores en el formulario', 'Error de validación');
      return;
    }

    this.saving = true;

    // Prepare data
    const formValue = this.recordForm.value;
    
    // Convert dates to ISO strings
    for (const [key, value] of Object.entries(formValue)) {
      if (value instanceof Date) {
        formValue[key] = value.toISOString().slice(0, 19).replace('T', ' ');
      }
      
      // Handle empty strings -> null for non-string types
      const column = this.tableSchema.columns.find(c => c.columnName === key);
      if (column && value === '' && column.isNullable === 'YES') {
        formValue[key] = null;
      }
    }

    this.save.emit(formValue);
    this.saving = false;
  }
}

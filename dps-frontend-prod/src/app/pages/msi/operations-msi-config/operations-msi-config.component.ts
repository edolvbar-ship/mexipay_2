import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { MatTableDataSource } from '@angular/material/table';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSortModule } from '@angular/material/sort';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import {
  MsiOperationConfig,
  MsiOperationFormData,
  MsiPlan
} from '../../../shared/interfaces/msi.interface';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-operations-msi-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatTabsModule,
    MatChipsModule,
    MatSelectModule,
    MatOptionModule
  ],
  providers: [DecimalPipe],
  template: `
    <div class="operations-msi-config">
      <div class="config-header">
        <div class="header-content">
          <button mat-icon-button (click)="goBack()" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="header-info">
            <h1>Configuración MSI por Operación</h1>
            <p *ngIf="operationInfo">{{ operationInfo.name_operation }} - ID: {{ operationInfo.id_operation }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-button (click)="loadOperations()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
          <button mat-raised-button color="primary"
                  (click)="saveAllConfig()"
                  [disabled]="saving || !hasChanges()">
            <mat-icon>save</mat-icon>
            Guardar Todo
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="loading-spinner">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!loading && operations.length > 0" class="config-content">
        <mat-tab-group>
          <!-- Operations Configuration Tab -->
          <mat-tab label="Configuración de Operaciones">
            <div class="tab-content">
              <!-- Global MSI Settings -->
              <mat-card class="global-settings-card">
                <mat-card-header>
                  <mat-card-title>Configuración Global MSI</mat-card-title>
                  <mat-card-subtitle>Configuración aplicable a todas las operaciones</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="global-settings-grid">
                    <div class="setting-item">
                      <mat-slide-toggle [(ngModel)]="globalSettings.msi_enabled" (change)="onGlobalMsiToggle()">
                        MSI Habilitado Globalmente
                      </mat-slide-toggle>
                      <p class="setting-description">Habilitar MSI para todas las operaciones por defecto</p>
                    </div>

                    <div class="setting-item">
                      <mat-slide-toggle [(ngModel)]="globalSettings.national_only" disabled>
                        Solo Tarjetas Nacionales
                      </mat-slide-toggle>
                      <p class="setting-description">Aplicar restricción de tarjetas nacionales</p>
                    </div>
                  </div>

                  <div class="default-plans">
                    <h3>Planes MSI por Defecto</h3>
                    <p class="plans-description">Estos planes se aplicarán a nuevas operaciones</p>
                    <div class="default-plans-grid">
                      <div *ngFor="let plan of defaultPlans" class="default-plan-item">
                        <span class="plan-months">{{ plan.months }} Meses</span>
                        <mat-form-field appearance="outline" class="amount-field">
                          <mat-label>Monto Mínimo</mat-label>
                          <input matInput
                                 type="number"
                                 [(ngModel)]="plan.min_amount"
                                 [disabled]="!globalSettings.msi_enabled"
                                 placeholder="0.00">
                          <span matPrefix>$</span>
                        </mat-form-field>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Operations Table -->
              <mat-card class="operations-table-card">
                <mat-card-header>
                  <mat-card-title>Operaciones con Configuración MSI</mat-card-title>
                  <mat-card-subtitle>Configuración individual por operación</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="table-container">
                    <table mat-table [dataSource]="dataSource" matSort>
                      <!-- Operation ID Column -->
                      <ng-container matColumnDef="id_operation">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>ID</th>
                        <td mat-cell *matCellDef="let operation">{{ operation.id_operation }}</td>
                      </ng-container>

                      <!-- Operation Name Column -->
                      <ng-container matColumnDef="name_operation">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre</th>
                        <td mat-cell *matCellDef="let operation">{{ operation.name_operation }}</td>
                      </ng-container>

                      <!-- MSI Status Column -->
                      <ng-container matColumnDef="msi_enabled">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>MSI</th>
                        <td mat-cell *matCellDef="let operation">
                          <mat-slide-toggle
                            [(ngModel)]="operation.msi_enabled"
                            (change)="onOperationMsiToggle(operation)"
                            color="primary">
                            {{ operation.msi_enabled ? 'Sí' : 'No' }}
                          </mat-slide-toggle>
                        </td>
                      </ng-container>

                      <!-- Available Plans Column -->
                      <ng-container matColumnDef="months_options">
                        <th mat-header-cell *matHeaderCellDef>Planes</th>
                        <td mat-cell *matCellDef="let operation">
                          <mat-chip *ngFor="let month of operation.months_options"
                             [color]="operation.msi_enabled ? 'primary' : 'default'">
                          {{ month }}M
                        </mat-chip>
                        </td>
                      </ng-container>

                      <!-- Min Amounts Column -->
                      <ng-container matColumnDef="min_amounts_display">
                        <th mat-header-cell *matHeaderCellDef>Montos Mínimos</th>
                        <td mat-cell *matCellDef="let operation">
                          <div class="amounts-list">
                            <span *ngFor="let entry of getMinAmountsArray(operation.min_amounts)"
                                  class="amount-item">
                              {{ formatMinAmount(entry[0], entry[1]) }}
                            </span>
                          </div>
                        </td>
                      </ng-container>

                      <!-- Actions Column -->
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef>Acciones</th>
                        <td mat-cell *matCellDef="let operation">
                          <button mat-icon-button
                                  color="primary"
                                  (click)="editOperation(operation)"
                                  [disabled]="!operation.msi_enabled"
                                  matTooltip="Configurar">
                            <mat-icon>settings</mat-icon>
                          </button>
                          <button mat-icon-button
                                  color="accent"
                                  (click)="viewOperationDetails(operation)"
                                  matTooltip="Ver Detalles">
                            <mat-icon>visibility</mat-icon>
                          </button>
                          <button mat-icon-button
                                  color="warn"
                                  (click)="resetOperation(operation)"
                                  matTooltip="Restablecer">
                            <mat-icon>refresh</mat-icon>
                          </button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                    </table>

                    <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]" [pageSize]="25" showFirstLastButtons></mat-paginator>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Operation Editor Tab -->
          <mat-tab label="Editor de Operación" [disabled]="!selectedOperation">
            <div class="tab-content" *ngIf="selectedOperation">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Configurar Operación: {{ selectedOperation.name_operation }}</mat-card-title>
                  <mat-card-subtitle>ID: {{ selectedOperation.id_operation }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="operationForm" class="operation-form">
                    <!-- MSI Status -->
                    <div class="form-section">
                      <h3>Estado MSI</h3>
                      <mat-form-field appearance="outline">
                        <mat-label>Estado MSI</mat-label>
                        <mat-select formControlName="msi_enabled">
                          <mat-option [value]="true">Habilitado</mat-option>
                          <mat-option [value]="false">Deshabilitado</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Available Months -->
                    <div class="form-section" *ngIf="operationForm.get('msi_enabled')?.value">
                      <h3>Meses Disponibles</h3>
                      <div class="months-grid">
                        <mat-checkbox *ngFor="let month of availableMonths"
                                      [formControlName]="'month_' + month">
                          {{ month }} Meses
                        </mat-checkbox>
                      </div>
                    </div>

                    <!-- Minimum Amounts -->
                    <div class="form-section" *ngIf="operationForm.get('msi_enabled')?.value">
                      <h3>Montos Mínimos</h3>
                      <div class="amounts-grid">
                        <div *ngFor="let month of availableMonths"
                             class="amount-field-item"
                             [class.disabled]="!isMonthSelected(month)">
                          <mat-form-field appearance="outline">
                            <mat-label>{{ month }} Meses - Monto Mínimo</mat-label>
                            <input matInput
                                   type="number"
                                   [formControlName]="'amount_' + month"
                                   [disabled]="!isMonthSelected(month)"
                                   placeholder="0.00">
                            <span matPrefix>$</span>
                            <mat-hint>Monto mínimo para {{ month }} meses</mat-hint>
                          </mat-form-field>
                        </div>
                      </div>
                    </div>

                    <!-- Form Actions -->
                    <div class="form-actions">
                      <button mat-button type="button" (click)="cancelEdit()">
                        Cancelar
                      </button>
                      <button mat-raised-button color="primary" type="button"
                              (click)="saveOperationConfig()"
                              [disabled]="!operationForm.valid || saving">
                        <mat-icon>save</mat-icon>
                        Guardar Configuración
                      </button>
                    </div>
                  </form>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Statistics Tab -->
          <mat-tab label="Estadísticas">
            <div class="tab-content">
              <div class="stats-grid">
                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Operaciones con MSI</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-value">{{ stats.operationsWithMsi }}</div>
                    <div class="stat-label">de {{ stats.totalOperations }} operaciones totales</div>
                  </mat-card-content>
                </mat-card>

                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Promedio de Planes</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-value">{{ stats.averagePlans }}</div>
                    <div class="stat-label">planes por operación</div>
                  </mat-card-content>
                </mat-card>

                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Monto Mínimo Promedio</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-value">{{ stats.averageMinAmount | number:'1.0-0' }}</div>
                    <div class="stat-label">promedio across all operations</div>
                  </mat-card-content>
                </mat-card>

                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Operaciones Activas</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-value">{{ stats.activeOperations }}</div>
                    <div class="stat-label">operaciones configuradas y activas</div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Error Message -->
      <div *ngIf="error" class="error-message">
        <mat-icon color="warn">error</mat-icon>
        <span>{{ error }}</span>
        <button mat-icon-button (click)="error = null">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Success Message -->
      <div *ngIf="success" class="success-message">
        <mat-icon color="primary">check_circle</mat-icon>
        <span>{{ success }}</span>
        <button mat-icon-button (click)="success = null">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .operations-msi-config {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .operations-msi-config .mat-mdc-icon-button,
    .mat-mdc-icon-button.mat-mdc-icon-button {
      width: 40px !important;
      height: 40px !important;
      padding: 8px !important;
      min-width: 40px !important;
      max-width: 40px !important;
      min-height: 40px !important;
      max-height: 40px !important;

      mat-icon {
        font-size: 20px !important;
        width: 20px !important;
        height: 20px !important;
        line-height: 20px !important;
      }
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .back-button {
      width: 48px;
      height: 48px;
    }

    .header-info h1 {
      margin: 0 0 4px 0;
      color: #1976d2;
      font-size: 28px;
    }

    .header-info p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .global-settings-card,
    .operations-table-card {
      margin-bottom: 24px;
    }

    .global-settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .setting-item {
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .setting-description {
      margin: 8px 0 0 0;
      color: #666;
      font-size: 14px;
    }

    .default-plans h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .plans-description {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
    }

    .default-plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .default-plan-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #f9f9f9;
    }

    .plan-months {
      font-weight: 600;
      min-width: 60px;
    }

    .amount-field {
      flex: 1;
    }

    .table-container {
      overflow-x: auto;
    }

    .amounts-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .amount-item {
      font-size: 12px;
      background-color: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .operation-form {
      max-width: 800px;
    }

    .form-section {
      margin-bottom: 32px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .form-section h3 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 18px;
    }

    .months-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }

    .amounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .amount-field-item {
      transition: opacity 0.3s ease;
    }

    .amount-field-item.disabled {
      opacity: 0.5;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
    }

    .stat-card {
      text-align: center;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #1976d2;
      margin: 16px 0 8px 0;
    }

    .stat-label {
      color: #666;
      font-size: 14px;
    }

    .error-message,
    .success-message {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-top: 24px;
    }

    .error-message {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
    }

    .success-message {
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
    }

    @media (max-width: 768px) {
      .operations-msi-config {
        padding: 16px;
      }

      .config-header {
        flex-direction: column;
        align-items: stretch;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .header-actions {
        justify-content: flex-start;
      }

      .global-settings-grid {
        grid-template-columns: 1fr;
      }

      .default-plans-grid {
        grid-template-columns: 1fr;
      }

      .months-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .amounts-grid {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class OperationsMsiConfigComponent implements OnInit, OnDestroy, AfterViewInit {
  idOperation: number = 0;
  operationInfo: any = null;

  displayedColumns: string[] = [
    'id_operation',
    'name_operation',
    'msi_enabled',
    'months_options',
    'min_amounts_display',
    'actions'
  ];
  dataSource = new MatTableDataSource<MsiOperationConfig>();
  operations: MsiOperationConfig[] = [];

  selectedOperation: MsiOperationConfig | null = null;
  operationForm!: FormGroup;

  globalSettings = {
    msi_enabled: true,
    national_only: true
  };

  defaultPlans: MsiPlan[] = [];
  availableMonths: number[] = [3, 6, 9, 12, 18];

  stats = {
    totalOperations: 0,
    operationsWithMsi: 0,
    averagePlans: 0,
    averageMinAmount: 0,
    activeOperations: 0
  };

  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  private destroy$ = new Subject<void>();
  private apiUrl = '/api';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    this.initializeDefaultPlans();
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.idOperation = +params['id'];
      if (this.idOperation) {
        this.loadOperationInfo();
      }
      this.loadOperations();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit() {
    // Connect paginator and sort to dataSource after ViewChild elements are available
    if (this.dataSource && this.paginator && this.sort) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }
  }

  private initializeDefaultPlans() {
    this.defaultPlans = this.availableMonths.map(months => ({
      months,
      min_amount: this.getDefaultMinAmount(months),
      enabled: true
    }));
  }

  private getDefaultMinAmount(months: number): number {
    const defaults: { [key: number]: number } = {
      3: 301,
      6: 601,
      9: 901,
      12: 1201,
      18: 1801
    };
    return defaults[months] || 0;
  }

  private loadOperationInfo() {
    // This would load specific operation information
    this.operationInfo = {
      id_operation: this.idOperation,
      name_operation: `Operación ${this.idOperation}`
    };
  }

  loadOperations() {
    this.loading = true;

    this.http.get<MsiOperationConfig[]>(`${this.apiUrl}/msi/operations`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operations) => {
          this.operations = operations;
          this.dataSource.data = operations;

          if (this.paginator && this.sort) {
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;
          }

          this.updateStatistics();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading operations:', error);
          this.snackBar.open('Error al cargar las operaciones', 'Cerrar', {
            duration: 3000
          });
          this.operations = [];
          this.dataSource.data = [];
          this.updateStatistics();
          this.loading = false;
        }
      });
  }

  private updateStatistics() {
    this.stats.totalOperations = this.operations.length;
    this.stats.operationsWithMsi = this.operations.filter(op => op.msi_enabled).length;
    this.stats.activeOperations = this.stats.operationsWithMsi;

    const enabledOperations = this.operations.filter(op => op.msi_enabled);
    if (enabledOperations.length > 0) {
      const totalPlans = enabledOperations.reduce((sum, op) => sum + op.months_options.length, 0);
      this.stats.averagePlans = Math.round(totalPlans / enabledOperations.length);

      const allAmounts = enabledOperations.flatMap(op => Object.values(op.min_amounts));
      const totalAmount = allAmounts.reduce((sum, amount) => sum + amount, 0);
      this.stats.averageMinAmount = Math.round(totalAmount / allAmounts.length);
    } else {
      this.stats.averagePlans = 0;
      this.stats.averageMinAmount = 0;
    }
  }

  onGlobalMsiToggle() {
    // Apply global MSI setting to all operations
    this.operations.forEach(operation => {
      if (this.globalSettings.msi_enabled && !operation.msi_enabled) {
        // Enable MSI with default settings
        operation.msi_enabled = true;
        operation.months_options = [...this.availableMonths];
        operation.min_amounts = {};
        this.availableMonths.forEach(month => {
          operation.min_amounts[month] = this.getDefaultMinAmount(month);
        });
      } else if (!this.globalSettings.msi_enabled && operation.msi_enabled) {
        // Disable MSI
        operation.msi_enabled = false;
        operation.months_options = [];
        operation.min_amounts = {};
      }
    });

    this.dataSource.data = [...this.operations];
    this.updateStatistics();
  }

  onOperationMsiToggle(operation: MsiOperationConfig) {
    if (operation.msi_enabled) {
      // Enable with default settings
      operation.months_options = [...this.availableMonths];
      operation.min_amounts = {};
      this.availableMonths.forEach(month => {
        operation.min_amounts[month] = this.getDefaultMinAmount(month);
      });
    } else {
      // Disable MSI
      operation.months_options = [];
      operation.min_amounts = {};
    }

    this.dataSource.data = [...this.operations];
    this.updateStatistics();
  }

  editOperation(operation: MsiOperationConfig) {
    this.selectedOperation = operation;
    this.initializeOperationForm();
  }

  private initializeOperationForm() {
    if (!this.selectedOperation) return;

    const formGroup: any = {
      msi_enabled: [this.selectedOperation.msi_enabled]
    };

    // Add month checkboxes
    this.availableMonths.forEach(month => {
      formGroup[`month_${month}`] = [this.selectedOperation?.months_options.includes(month) || false];
    });

    // Add amount fields
    this.availableMonths.forEach(month => {
      formGroup[`amount_${month}`] = [this.selectedOperation?.min_amounts[month] || this.getDefaultMinAmount(month)];
    });

    this.operationForm = this.fb.group(formGroup);
  }

  isMonthSelected(month: number): boolean {
    return this.operationForm.get(`month_${month}`)?.value || false;
  }

  saveOperationConfig() {
    if (!this.operationForm.valid || !this.selectedOperation) return;

    this.saving = true;

    // Update operation with form values
    this.selectedOperation!.msi_enabled = this.operationForm.get('msi_enabled')?.value;

    if (this.selectedOperation!.msi_enabled) {
      this.selectedOperation!.months_options = [];
      this.selectedOperation!.min_amounts = {};

      this.availableMonths.forEach(month => {
        if (this.isMonthSelected(month)) {
          this.selectedOperation!.months_options.push(month);
          this.selectedOperation!.min_amounts[month] = parseFloat(
            this.operationForm.get(`amount_${month}`)?.value || 0
          );
        }
      });
    } else {
      this.selectedOperation!.months_options = [];
      this.selectedOperation!.min_amounts = {};
    }

    // Update data source
    const index = this.operations.findIndex(op => op.id_operation === this.selectedOperation!.id_operation);
    if (index !== -1) {
      this.operations[index] = this.selectedOperation;
      this.dataSource.data = [...this.operations];
    }

    this.updateStatistics();
    this.saving = false;
    this.success = 'Configuración de operación guardada exitosamente';

    this.snackBar.open('Configuración guardada exitosamente', 'Cerrar', {
      duration: 3000
    });
  }

  cancelEdit() {
    this.selectedOperation = null;
    this.operationForm = undefined as any;
  }

  viewOperationDetails(operation: MsiOperationConfig) {
    console.log('View operation details:', operation);
    this.snackBar.open(`Viendo detalles de ${operation.name_operation}`, 'Cerrar', {
      duration: 3000
    });
  }

  resetOperation(operation: MsiOperationConfig) {
    if (confirm(`¿Restablecer configuración de ${operation.name_operation} a valores por defecto?`)) {
      operation.msi_enabled = true;
      operation.months_options = [...this.availableMonths];
      operation.min_amounts = {};
      this.availableMonths.forEach(month => {
        operation.min_amounts[month] = this.getDefaultMinAmount(month);
      });

      this.dataSource.data = [...this.operations];
      this.updateStatistics();

      this.snackBar.open('Configuración restablecida', 'Cerrar', {
        duration: 3000
      });
    }
  }

  saveAllConfig() {
    this.saving = true;

    // Simulate saving all configurations
    setTimeout(() => {
      this.saving = false;
      this.success = 'Todas las configuraciones guardadas exitosamente';

      this.snackBar.open('Configuraciones guardadas exitosamente', 'Cerrar', {
        duration: 3000
      });
    }, 1000);
  }

  hasChanges(): boolean {
    // This would check if there are unsaved changes
    return true; // Simplified for now
  }

  goBack() {
    this.router.navigate(['/catalogos/mcc-operations']);
  }

  getMinAmountsArray(minAmounts: { [key: number]: number }): Array<[number, number]> {
    return Object.entries(minAmounts).map(([key, value]) => [parseInt(key), value]);
  }

  formatMinAmount(month: number, amount: number): string {
    return `${month}M: $${amount}`;
  }
}

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MsiConfigService } from '../../../services/msi-config.service';
import { MsiBinesService } from '../../../services/msi-bines.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import {
  MsiConfig,
  MsiUpdate,
  MsiOperationConfig,
  MsiSystemConfig,
  ComponentMsiConfig,
  MsiPlan
} from '../../../shared/interfaces/msi.interface';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-msi-config-page',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    RouterModule,
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
    MatDialogModule,
    MatCardModule,
    MatTabsModule
  ],
  providers: [DecimalPipe],
  template: `
    <div class="msi-config-page">
      <div class="page-header">
        <h1>Configuración MSI</h1>
        <p>Administración de Meses Sin Intereses a nivel del sistema</p>
      </div>

      <mat-tab-group>
        <!-- System Configuration Tab -->
        <mat-tab label="Configuración del Sistema">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Configuración Global MSI</mat-card-title>
                <mat-card-subtitle>Configuración general del sistema MSI</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <form [formGroup]="systemConfigForm" class="system-config-form">
                  <div class="config-grid">
                    <div class="config-item">
                      <mat-slide-toggle
                        [(ngModel)]="systemConfig.national_only"
                        [disabled]="true"
                        color="primary">
                        Solo Tarjetas Nacionales
                      </mat-slide-toggle>
                      <p class="config-description">Limitar MSI a tarjetas nacionales mexicanas</p>
                    </div>

                    <div class="config-item">
                      <mat-slide-toggle
                        [(ngModel)]="systemConfig.token_q6_supported"
                        [disabled]="true"
                        color="primary">
                        Token Q6 Soportado
                      </mat-slide-toggle>
                      <p class="config-description">Soporte para Token Q6 en procesamiento</p>
                    </div>
                  </div>

                  <div class="default-plans">
                    <h3>Planes MSI por Defecto</h3>
                    <div class="plans-grid">
                      <div *ngFor="let plan of defaultPlans" class="plan-item">
                        <span class="plan-label">{{ plan.months }} Meses</span>
                        <mat-form-field appearance="outline" class="amount-field">
                          <mat-label>Monto Mínimo</mat-label>
                          <input matInput
                                 type="number"
                                 [(ngModel)]="plan.min_amount"
                                 [disabled]="true"
                                 placeholder="0.00">
                          <span matPrefix>$</span>
                        </mat-form-field>
                      </div>
                    </div>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Merchants Configuration Tab -->
        <mat-tab label="Comercios con MSI">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Comercios Configurados para MSI</mat-card-title>
                <mat-card-subtitle>Lista de comercios con MSI habilitado</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="merchants-table">
                  <div class="table-container">
                    <table mat-table [dataSource]="merchantsDataSource" matSort>
                      <!-- Merchant ID Column -->
                      <ng-container matColumnDef="id_merchant">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>ID</th>
                        <td mat-cell *matCellDef="let merchant">{{ merchant.id_merchant }}</td>
                      </ng-container>

                      <!-- Merchant Name Column -->
                      <ng-container matColumnDef="name_merchant">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre del Comercio</th>
                        <td mat-cell *matCellDef="let merchant">{{ merchant.name_merchant }}</td>
                      </ng-container>

                      <!-- MSI Status Column -->
                      <ng-container matColumnDef="msi_enabled">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>MSI Habilitado</th>
                        <td mat-cell *matCellDef="let merchant">
                          <mat-icon [color]="merchant.msi_config?.length > 0 ? 'primary' : 'warn'">
                            {{ merchant.msi_config?.length > 0 ? 'check_circle' : 'cancel' }}
                          </mat-icon>
                          {{ merchant.msi_config?.length > 0 ? 'Sí' : 'No' }}
                        </td>
                      </ng-container>

                      <!-- Plans Count Column -->
                      <ng-container matColumnDef="plans_count">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Planes</th>
                        <td mat-cell *matCellDef="let merchant">
                          <span class="plans-badge">{{ merchant.msi_config?.length || 0 }} planes</span>
                        </td>
                      </ng-container>

                      <!-- Last Updated Column -->
                      <ng-container matColumnDef="last_updated">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Última Actualización</th>
                        <td mat-cell *matCellDef="let merchant">
                          {{ formatLastUpdated(merchant.last_updated) }}
                        </td>
                      </ng-container>

                      <!-- Actions Column -->
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef>Acciones</th>
                        <td mat-cell *matCellDef="let merchant">
                          <button mat-icon-button color="primary"
                                  [routerLink]="['/comercios', merchant.id_merchant, 'msi-config']"
                                  matTooltip="Configurar MSI">
                            <mat-icon>settings</mat-icon>
                          </button>
                          <button mat-icon-button color="accent"
                                  (click)="viewMerchantMsiConfig(merchant)"
                                  matTooltip="Ver Configuración">
                            <mat-icon>visibility</mat-icon>
                          </button>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="merchantsDisplayedColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: merchantsDisplayedColumns;"></tr>
                    </table>

                    <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]" [pageSize]="25" showFirstLastButtons></mat-paginator>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Statistics Tab -->
        <mat-tab label="Estadísticas MSI">
          <div class="tab-content">
            <div class="stats-grid">
              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Comercios con MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ msiStats.merchantsWithMsi }}</div>
                  <div class="stat-label">de {{ msiStats.totalMerchants }} comercios totales</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Transacciones MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ msiStats.msiTransactions }}</div>
                  <div class="stat-label">en el último mes</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Monto Total MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ msiStats.totalMsiAmount | number:'1.0-0' }}</div>
                  <div class="stat-label">procesado vía MSI</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Tarjetas Nacionales</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ msiStats.nationalCards }}</div>
                  <div class="stat-label">rangos de BIN configurados</div>
                </mat-card-content>
              </mat-card>
            </div>

            <mat-card class="usage-chart">
              <mat-card-header>
                <mat-card-title>Uso de MSI por Mes</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="chart-placeholder">
                  <mat-icon>bar_chart</mat-icon>
                  <p>Gráfico de uso de MSI (en implementación)</p>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Loading Overlay -->
      <div *ngIf="loading" class="loading-overlay">
        <mat-spinner></mat-spinner>
      </div>
    </div>
  `,
  styles: [`
    .msi-config-page {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 32px;
      text-align: center;
    }

    .msi-config-page .mat-mdc-icon-button,
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

    .page-header h1 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-size: 32px;
    }

    .page-header p {
      margin: 0;
      color: #666;
      font-size: 16px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .system-config-form {
      max-width: 800px;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }

    .config-item {
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .config-description {
      margin: 8px 0 0 0;
      color: #666;
      font-size: 14px;
    }

    .default-plans {
      margin-top: 32px;
    }

    .default-plans h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .plan-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .plan-label {
      font-weight: 600;
      min-width: 80px;
    }

    .amount-field {
      flex: 1;
    }

    .merchants-table {
      margin-top: 16px;
    }

    .table-container {
      overflow-x: auto;
    }

    .plans-badge {
      background-color: #e3f2fd;
      color: #1976d2;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
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

    .usage-chart {
      margin-top: 24px;
    }

    .chart-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: #666;
    }

    .chart-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .mat-spinner {
      width: 50px;
      height: 50px;
    }

    @media (max-width: 768px) {
      .msi-config-page {
        padding: 16px;
      }

      .config-grid {
        grid-template-columns: 1fr;
      }

      .plans-grid {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MsiConfigPageComponent implements OnInit, OnDestroy {
  // System configuration
  systemConfigForm: FormGroup;
  systemConfig: MsiSystemConfig = {
    national_only: true,
    token_q6_supported: true,
    default_months: [3, 6, 9, 12, 18],
    default_min_amounts: {
      3: 301,
      6: 601,
      9: 901,
      12: 1201,
      18: 1801
    },
    bin_ranges: []
  };

  defaultPlans: MsiPlan[] = [];

  // Merchants table
  merchantsDisplayedColumns: string[] = [
    'id_merchant',
    'name_merchant',
    'msi_enabled',
    'plans_count',
    'last_updated',
    'actions'
  ];
  merchantsDataSource = new MatTableDataSource<any>();

  // Statistics
  msiStats = {
    merchantsWithMsi: 0,
    totalMerchants: 0,
    msiTransactions: 1247,
    totalMsiAmount: 2847650,
    nationalCards: 3
  };

  loading = false;
  private destroy$ = new Subject<void>();
  private apiUrl = '/api';

  @ViewChild(MatPaginator) merchantsPaginator!: MatPaginator;
  @ViewChild(MatSort) merchantsSort!: MatSort;

  constructor(
    private msiConfigService: MsiConfigService,
    private msiBinesService: MsiBinesService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    this.systemConfigForm = this.fb.group({
      national_only: [true],
      token_q6_supported: [true]
    });
  }

  ngOnInit() {
    this.initializeDefaultPlans();
    this.loadSystemData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeDefaultPlans() {
    this.defaultPlans = this.systemConfig.default_months.map(months => ({
      months,
      min_amount: this.systemConfig.default_min_amounts[months],
      enabled: true
    }));
  }

  private loadSystemData() {
    this.loading = true;

    // Load merchants with MSI
    this.loadMerchantsWithMsi();

    // Load BIN statistics
    this.loadBinStatistics();

    this.loading = false;
  }

  private loadMerchantsWithMsi() {
    this.http.get<any[]>(`${this.apiUrl}/msi/merchants`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (merchants) => {
          this.merchantsDataSource.data = merchants;
          this.merchantsDataSource.paginator = this.merchantsPaginator;
          this.merchantsDataSource.sort = this.merchantsSort;

          // Update statistics
          this.msiStats.merchantsWithMsi = merchants.filter(m => m.msi_config?.length > 0).length;
          this.msiStats.totalMerchants = merchants.length;
        },
        error: (error) => {
          console.error('Error loading merchants with MSI:', error);
          this.snackBar.open('Error al cargar comercios con MSI', 'Cerrar', {
            duration: 3000
          });
          this.merchantsDataSource.data = [];
          this.msiStats.merchantsWithMsi = 0;
          this.msiStats.totalMerchants = 0;
        }
      });
  }

  private loadBinStatistics() {
    this.msiBinesService.getBinStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          console.log('BIN Statistics:', stats);
          // Update statistics with real data
        },
        error: (error) => {
          console.error('Error loading BIN statistics:', error);
        }
      });
  }

  viewMerchantMsiConfig(merchant: any) {
    // This would open a dialog or navigate to merchant MSI configuration
    console.log('View MSI config for merchant:', merchant);
    this.snackBar.open(`Viendo configuración MSI de ${merchant.name_merchant}`, 'Cerrar', {
      duration: 3000
    });
  }

  formatLastUpdated(dateString: string): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;

    return date.toLocaleDateString('es-MX');
  }
}

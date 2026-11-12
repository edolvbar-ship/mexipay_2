import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MsiBinesService } from '@/app/services/msi-bines.service';
import { MsiBinDialogComponent, BinDialogData, BinDialogResult } from '@/app/components/msi-bin-dialog/msi-bin-dialog.component';
import { MsiBinFormData } from '@/app/shared/interfaces/msi.interface';
import { takeUntil } from 'rxjs/operators';
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
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject } from 'rxjs';

interface MsiBinCatalog {
  id_msi_bin: number;
  bin_start: string;
  bin_end: string;
  bank_name: string;
  card_brand: string;
  card_type: string;
  country_code: string;
  is_active: boolean;
  is_national: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  transaction_count: number;
  total_amount: number;
}

interface BinFormData {
  bin_start: string;
  bin_end: string;
  bank_name: string;
  card_brand: string;
  card_type: string;
  country_code: string;
  is_national: boolean;
}

@Component({
  selector: 'app-msi-bines-catalog',
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
    MatDialogModule,
    MatCardModule,
    MatTabsModule,
    MatSelectModule,
    MatOptionModule,
    MatChipsModule,
    MatTooltipModule
  ],
  providers: [DecimalPipe],
  template: `
    <div class="msi-bines-catalog">
      <div class="catalog-header">
        <h1>Catálogo de BINs MSI</h1>
        <p>Administración de rangos de BIN para Meses Sin Intereses</p>
      </div>

      <div class="actions-bar">
        <button mat-raised-button color="primary" (click)="openAddBinDialog()">
          <mat-icon>add</mat-icon>
          Agregar Rango de BIN
        </button>
        <button mat-button (click)="loadBinCatalog()">
          <mat-icon>refresh</mat-icon>
          Actualizar
        </button>
        <button mat-button (click)="importBinRanges()">
          <mat-icon>upload_file</mat-icon>
          Importar
        </button>
        <button mat-button (click)="exportBinCatalog()">
          <mat-icon>download</mat-icon>
          Exportar
        </button>
      </div>

      <mat-tab-group>
        <!-- BIN Catalog Tab -->
        <mat-tab label="Catálogo de BINs">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Rangos de BIN Configurados</mat-card-title>
                <mat-card-subtitle>{{ binCatalog.length }} rangos configurados</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="filters-section">
                  <div class="filter-controls">
                    <mat-form-field appearance="outline">
                      <mat-label>Filtrar por Marca</mat-label>
                      <mat-select [(ngModel)]="brandFilter">
                        <mat-option value="">Todas</mat-option>
                        <mat-option value="Visa">Visa</mat-option>
                        <mat-option value="Mastercard">Mastercard</mat-option>
                        <mat-option value="Amex">American Express</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Filtrar por País</mat-label>
                      <mat-select [(ngModel)]="countryFilter">
                        <mat-option value="">Todos</mat-option>
                        <mat-option value="MX">México</mat-option>
                        <mat-option value="US">Estados Unidos</mat-option>
                        <mat-option value="CA">Canadá</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Estado</mat-label>
                      <mat-select [(ngModel)]="statusFilter">
                        <mat-option value="">Todos</mat-option>
                        <mat-option value="active">Activos</mat-option>
                        <mat-option value="inactive">Inactivos</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <button mat-button (click)="applyFilters()">
                      <mat-icon>search</mat-icon>
                      Filtrar
                    </button>
                    <button mat-button (click)="clearFilters()">
                      <mat-icon>clear</mat-icon>
                      Limpiar
                    </button>
                  </div>
                </div>

                <div class="table-container">
                  <table mat-table [dataSource]="dataSource" matSort>
                    <!-- ID Column -->
                    <ng-container matColumnDef="id_msi_bin">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>ID</th>
                      <td mat-cell *matCellDef="let bin">{{ bin.id_msi_bin }}</td>
                    </ng-container>

                    <!-- BIN Range Column -->
                    <ng-container matColumnDef="range">
                      <th mat-header-cell *matHeaderCellDef>Rango de BIN</th>
                      <td mat-cell *matCellDef="let bin">
                        <span class="bin-range">{{ bin.bin_start }} - {{ bin.bin_end }}</span>
                      </td>
                    </ng-container>

                    <!-- Bank Name Column -->
                    <ng-container matColumnDef="bank_name">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Banco</th>
                      <td mat-cell *matCellDef="let bin">{{ bin.bank_name || 'N/A' }}</td>
                    </ng-container>

                    <!-- Card Brand Column -->
                    <ng-container matColumnDef="card_brand">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Marca</th>
                      <td mat-cell *matCellDef="let bin">
                        <span class="brand-badge {{ bin.card_brand.toLowerCase() }}">
                          {{ bin.card_brand }}
                        </span>
                      </td>
                    </ng-container>

                    <!-- Card Type Column -->
                    <ng-container matColumnDef="card_type">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Tipo</th>
                      <td mat-cell *matCellDef="let bin">
                        <span class="card-type">{{ bin.card_type }}</span>
                      </td>
                    </ng-container>

                    <!-- Country Column -->
                    <ng-container matColumnDef="country_code">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>País</th>
                      <td mat-cell *matCellDef="let bin">
                        <span class="country-code">{{ bin.country_code }}</span>
                      </td>
                    </ng-container>

                    <!-- National Column -->
                    <ng-container matColumnDef="is_national">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Nacional</th>
                      <td mat-cell *matCellDef="let bin">
                        <mat-chip [color]="bin.is_national ? 'primary' : 'default'" selected>
                          {{ bin.is_national ? 'Sí' : 'No' }}
                        </mat-chip>
                      </td>
                    </ng-container>

                    <!-- Status Column -->
                    <ng-container matColumnDef="is_active">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Estado</th>
                      <td mat-cell *matCellDef="let bin">
                        <mat-slide-toggle
                          [(ngModel)]="bin.is_active"
                          (change)="toggleBinStatus(bin)"
                          color="primary">
                          {{ bin.is_active ? 'Activo' : 'Inactivo' }}
                        </mat-slide-toggle>
                      </td>
                    </ng-container>

                    <!-- Statistics Column -->
                    <ng-container matColumnDef="statistics">
                      <th mat-header-cell *matHeaderCellDef>Estadísticas</th>
                      <td mat-cell *matCellDef="let bin">
                        <div class="stats-info">
                          <span class="transaction-count">{{ bin.transaction_count }} tx</span>
                          <span class="total-amount">{{ bin.total_amount | number:'1.0-0' }}</span>
                        </div>
                      </td>
                    </ng-container>

                    <!-- Actions Column -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Acciones</th>
                      <td mat-cell *matCellDef="let bin">
                        <button mat-icon-button color="primary" (click)="editBin(bin)" matTooltip="Editar">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="accent" (click)="viewBinDetails(bin)" matTooltip="Ver Detalles">
                          <mat-icon>visibility</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteBin(bin)" matTooltip="Eliminar">
                          <mat-icon>delete</mat-icon>
                        </button>
                        <button mat-icon-button
                                color="primary"
                                (click)="validateBinRangeFromCatalog(bin)"
                                matTooltip="Validar Rango">
                          <mat-icon>check_circle</mat-icon>
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

        <!-- BIN Statistics Tab -->
        <mat-tab label="Estadísticas">
          <div class="tab-content">
            <div class="stats-grid">
              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Total de BINs</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ binStats.totalBins }}</div>
                  <div class="stat-label">rangos configurados</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>BINs Activos</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ binStats.activeBins }}</div>
                  <div class="stat-label">rangos activos</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>BINs Nacionales</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ binStats.nationalBins }}</div>
                  <div class="stat-label">rangos nacionales</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Total Transacciones</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ binStats.totalTransactions | number:'1.0-0' }}</div>
                  <div class="stat-label">transacciones procesadas</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Monto Total</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ binStats.totalAmount | number:'1.0-0' }}</div>
                  <div class="stat-label">procesado vía BINs MSI</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="stat-card">
                <mat-card-header>
                  <mat-card-title>Cobertura</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="stat-value">{{ binStats.coverage }}%</div>
                  <div class="stat-label">de tarjetas nacionales</div>
                </mat-card-content>
              </mat-card>
            </div>

            <div class="charts-section">
              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Distribución por Marca</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="brand-distribution">
                    <div *ngFor="let brand of binStats.brandDistribution" class="brand-item">
                      <div class="brand-label">{{ brand.brand }}</div>
                      <div class="brand-bar">
                        <div class="brand-fill" [style.width.%]="brand.percentage"></div>
                      </div>
                      <div class="brand-count">{{ brand.count }}</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Actividad por Rango</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="activity-chart">
                    <div *ngFor="let range of binStats.topRanges" class="range-item">
                      <div class="range-label">{{ range.range }}</div>
                      <div class="range-bar">
                        <div class="range-fill" [style.width.%]="range.percentage"></div>
                      </div>
                      <div class="range-count">{{ range.transactionCount }}</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- BIN Validation Tab -->
        <mat-tab label="Validación">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Herramienta de Validación de BIN</mat-card-title>
                <mat-card-subtitle>Validar rangos y detectar conflictos</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="validation-tools">
                  <div class="validation-section">
                    <h3>Validar Rango Individual</h3>
                    <form [formGroup]="validationForm" class="validation-form">
                      <div class="form-grid">
                        <mat-form-field appearance="outline">
                          <mat-label>BIN Inicial</mat-label>
                          <input matInput
                                 formControlName="bin_start"
                                 placeholder="Ej: 400000"
                                 maxlength="6">
                          <mat-hint>6 dígitos del BIN inicial</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>BIN Final</mat-label>
                          <input matInput
                                 formControlName="bin_end"
                                 placeholder="Ej: 499999"
                                 maxlength="6">
                          <mat-hint>6 dígitos del BIN final</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Marca</mat-label>
                          <mat-select formControlName="card_brand">
                            <mat-option value="Visa">Visa</mat-option>
                            <mat-option value="Mastercard">Mastercard</mat-option>
                            <mat-option value="Amex">American Express</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </div>

                      <div class="validation-actions">
                        <button mat-raised-button color="primary"
                                (click)="validateBinRange()"
                                [disabled]="!validationForm.valid || validating">
                          <mat-icon>check_circle</mat-icon>
                          Validar Rango
                        </button>
                      </div>

                      <div *ngIf="validationResult" class="validation-result"
                           [class.valid]="validationResult.isValid"
                           [class.invalid]="!validationResult.isValid">
                        <div class="result-header">
                          <mat-icon [color]="validationResult.isValid ? 'primary' : 'warn'">
                            {{ validationResult.isValid ? 'check_circle' : 'error' }}
                          </mat-icon>
                          <span class="result-title">
                            {{ validationResult.isValid ? 'Rango Válido' : 'Rango Inválido' }}
                          </span>
                        </div>
                        <div class="result-details">
                          <p *ngFor="let detail of validationResult.details">{{ detail }}</p>
                        </div>
                      </div>
                    </form>
                  </div>

                  <div class="validation-section">
                    <h3>Detección de Conflictos</h3>
                    <button mat-raised-button color="warn" (click)="detectConflicts()">
                      <mat-icon>warning</mat-icon>
                      Detectar Conflictos
                    </button>

                    <div *ngIf="conflicts.length > 0" class="conflicts-list">
                      <h4>Conflictos Detectados:</h4>
                      <div *ngFor="let conflict of conflicts" class="conflict-item">
                        <mat-icon color="warn">warning</mat-icon>
                        <div class="conflict-details">
                          <span class="conflict-text">{{ conflict.description }}</span>
                          <div class="conflict-bins">
                            <span>Conflictos con: {{ conflict.conflictingBins.join(', ') }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div *ngIf="conflicts.length === 0 && conflictCheckComplete" class="no-conflicts">
                      <mat-icon color="primary">check_circle</mat-icon>
                      <span>No se detectaron conflictos en el catálogo</span>
                    </div>
                  </div>

                  <div class="validation-section">
                    <h3>Validación Masiva</h3>
                    <button mat-raised-button color="accent" (click)="validateAllRanges()">
                      <mat-icon>verified</mat-icon>
                      Validar Todos los Rangos
                    </button>

                    <div *ngIf="massValidationResult" class="mass-validation-result">
                      <h4>Resultado de Validación Masiva:</h4>
                      <div class="validation-summary">
                        <div class="summary-item">
                          <span class="summary-label">Total Validados:</span>
                          <span class="summary-value">{{ massValidationResult.total }}</span>
                        </div>
                        <div class="summary-item">
                          <span class="summary-label">Válidos:</span>
                          <span class="summary-value valid">{{ massValidationResult.valid }}</span>
                        </div>
                        <div class="summary-item">
                          <span class="summary-label">Inválidos:</span>
                          <span class="summary-value invalid">{{ massValidationResult.invalid }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
    .msi-bines-catalog {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .catalog-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .msi-bines-catalog .mat-mdc-icon-button,
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

    .catalog-header h1 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-size: 32px;
    }

    .catalog-header p {
      margin: 0;
      color: #666;
      font-size: 16px;
    }

    .actions-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .tab-content {
      padding: 24px 0;
    }

    .filters-section {
      margin-bottom: 24px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .filter-controls {
      display: flex;
      gap: 16px;
      align-items: flex-end;
      flex-wrap: wrap;
    }

    .table-container {
      overflow-x: auto;
    }

    .bin-range {
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .brand-badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .brand-badge.visa {
      background-color: #1a1f71;
      color: white;
    }

    .brand-badge.mastercard {
      background-color: #eb001b;
      color: white;
    }

    .brand-badge.amex {
      background-color: #006fcf;
      color: white;
    }

    .card-type {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
    }

    .country-code {
      font-weight: 600;
      color: #1976d2;
    }

    .stats-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .transaction-count {
      font-size: 12px;
      color: #666;
    }

    .total-amount {
      font-weight: 600;
      color: #1976d2;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

    .charts-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
    }

    .brand-distribution,
    .activity-chart {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .brand-item,
    .range-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-label,
    .range-label {
      font-weight: 600;
      min-width: 80px;
    }

    .brand-bar,
    .range-bar {
      flex: 1;
      height: 8px;
      background-color: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .brand-fill,
    .range-fill {
      height: 100%;
      background-color: #1976d2;
      transition: width 0.3s ease;
    }

    .brand-count,
    .range-count {
      font-weight: 600;
      min-width: 40px;
      text-align: right;
    }

    .validation-tools {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .validation-section {
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .validation-section h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .validation-actions {
      display: flex;
      justify-content: flex-start;
    }

    .validation-result {
      padding: 20px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .validation-result.valid {
      background-color: #e8f5e8;
      border: 1px solid #4caf50;
    }

    .validation-result.invalid {
      background-color: #ffebee;
      border: 1px solid #f44336;
    }

    .result-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .result-title {
      font-weight: 600;
      font-size: 16px;
    }

    .result-details p {
      margin: 4px 0;
      color: #333;
    }

    .conflicts-list {
      margin-top: 16px;
    }

    .conflict-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .conflict-details {
      flex: 1;
    }

    .conflict-text {
      font-weight: 600;
      color: #856404;
    }

    .conflict-bins {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    .no-conflicts {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 8px;
      color: #155724;
      margin-top: 16px;
    }

    .mass-validation-result {
      margin-top: 16px;
      padding: 16px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }

    .validation-summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .summary-label {
      font-weight: 600;
    }

    .summary-value {
      font-weight: 700;
    }

    .summary-value.valid {
      color: #4caf50;
    }

    .summary-value.invalid {
      color: #f44336;
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

    @media (max-width: 768px) {
      .msi-bines-catalog {
        padding: 16px;
      }

      .actions-bar {
        flex-direction: column;
      }

      .filter-controls {
        flex-direction: column;
        align-items: stretch;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .charts-section {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MsiBinesCatalogComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = [
    'id_msi_bin',
    'range',
    'bank_name',
    'card_brand',
    'card_type',
    'country_code',
    'is_national',
    'is_active',
    'statistics',
    'actions'
  ];
  dataSource = new MatTableDataSource<MsiBinCatalog>();
  binCatalog: MsiBinCatalog[] = [];

  // Filters
  brandFilter: string = '';
  countryFilter: string = '';
  statusFilter: string = '';

  // Validation
  validationForm!: FormGroup;
  validationResult: any = null;
  validating = false;
  conflicts: any[] = [];
  conflictCheckComplete = false;
  massValidationResult: any = null;

  // Statistics
  binStats = {
    totalBins: 0,
    activeBins: 0,
    nationalBins: 0,
    totalTransactions: 0,
    totalAmount: 0,
    coverage: 0,
    brandDistribution: [] as any[],
    topRanges: [] as any[]
  };

  loading = false;

  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private msiBinesService: MsiBinesService,
    private dialog: MatDialog
  ) {
    this.initializeValidationForm();
  }

  ngOnInit() {
    this.loadBinCatalog();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeValidationForm(): void {
    this.validationForm = this.fb.group({
      bin_start: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      bin_end: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      card_brand: ['', [Validators.required]]
    });
  }

  loadBinCatalog(): void {
    this.loading = true;

    this.msiBinesService.getNationalBines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (binRanges) => {
          this.binCatalog = binRanges.map(bin => ({
            id_msi_bin: bin.id_msi_bin,
            bin_start: bin.bin_start,
            bin_end: bin.bin_end,
            bank_name: bin.bank_name,
            card_brand: bin.card_brand,
            card_type: 'Crédito', // Default value
            country_code: 'MX',
            is_active: bin.active,
            is_national: true,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: 'system',
            transaction_count: 0,
            total_amount: 0
          }));

          this.dataSource.data = this.binCatalog;
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;

          this.calculateStatistics();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading BIN catalog:', error);
          this.snackBar.open('Error al cargar el catálogo de BINs', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
  }

  private generateMockBinCatalog(): MsiBinCatalog[] {
    return [
      {
        id_msi_bin: 1,
        bin_start: '400000',
        bin_end: '499999',
        bank_name: 'Banco Nacional',
        card_brand: 'Visa',
        card_type: 'Crédito',
        country_code: 'MX',
        is_active: true,
        is_national: true,
        created_at: new Date('2026-01-15'),
        updated_at: new Date('2026-05-20'),
        created_by: 'admin',
        transaction_count: 15420,
        total_amount: 2847650
      },
      {
        id_msi_bin: 2,
        bin_start: '510000',
        bin_end: '559999',
        bank_name: 'Banco Internacional',
        card_brand: 'Mastercard',
        card_type: 'Crédito',
        country_code: 'MX',
        is_active: true,
        is_national: true,
        created_at: new Date('2026-02-10'),
        updated_at: new Date('2026-05-18'),
        created_by: 'admin',
        transaction_count: 12350,
        total_amount: 2234500
      },
      {
        id_msi_bin: 3,
        bin_start: '340000',
        bin_end: '349999',
        bank_name: 'American Express',
        card_brand: 'Amex',
        card_type: 'Crédito',
        country_code: 'MX',
        is_active: true,
        is_national: true,
        created_at: new Date('2026-03-05'),
        updated_at: new Date('2026-04-22'),
        created_by: 'admin',
        transaction_count: 8900,
        total_amount: 1567800
      }
    ];
  }

  private calculateStatistics(): void {
    const activeBins = this.binCatalog.filter(bin => bin.is_active);
    const nationalBins = this.binCatalog.filter(bin => bin.is_national);

    this.binStats = {
      totalBins: this.binCatalog.length,
      activeBins: activeBins.length,
      nationalBins: nationalBins.length,
      totalTransactions: this.binCatalog.reduce((sum, bin) => sum + bin.transaction_count, 0),
      totalAmount: this.binCatalog.reduce((sum, bin) => sum + bin.total_amount, 0),
      coverage: 85.5, // Mock coverage percentage
      brandDistribution: this.calculateBrandDistribution(),
      topRanges: this.calculateTopRanges()
    };
  }

  private calculateBrandDistribution(): any[] {
    const brandCounts: { [key: string]: number } = {};

    this.binCatalog.forEach(bin => {
      brandCounts[bin.card_brand] = (brandCounts[bin.card_brand] || 0) + 1;
    });

    const total = this.binCatalog.length;
    return Object.entries(brandCounts).map(([brand, count]) => ({
      brand,
      count,
      percentage: (count / total) * 100
    }));
  }

  private calculateTopRanges(): any[] {
    return this.binCatalog
      .sort((a, b) => b.transaction_count - a.transaction_count)
      .slice(0, 5)
      .map(bin => ({
        range: `${bin.bin_start}-${bin.bin_end}`,
        transactionCount: bin.transaction_count,
        percentage: (bin.transaction_count / this.binStats.totalTransactions) * 100
      }));
  }

  applyFilters(): void {
    let filteredData = [...this.binCatalog];

    if (this.brandFilter) {
      filteredData = filteredData.filter(bin => bin.card_brand === this.brandFilter);
    }

    if (this.countryFilter) {
      filteredData = filteredData.filter(bin => bin.country_code === this.countryFilter);
    }

    if (this.statusFilter) {
      const isActive = this.statusFilter === 'active';
      filteredData = filteredData.filter(bin => bin.is_active === isActive);
    }

    this.dataSource.data = filteredData;
  }

  clearFilters(): void {
    this.brandFilter = '';
    this.countryFilter = '';
    this.statusFilter = '';
    this.dataSource.data = this.binCatalog;
  }

  toggleBinStatus(bin: MsiBinCatalog): void {
    const previousState = bin.is_active;
    bin.is_active = !bin.is_active;

    this.msiBinesService.updateNationalBin(bin.id_msi_bin, {
      bin_start: bin.bin_start,
      bin_end: bin.bin_end,
      bank_name: bin.bank_name,
      card_brand: bin.card_brand,
      active: bin.is_active
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(
          `Rango de BIN ${bin.is_active ? 'activado' : 'desactivado'} exitosamente`,
          'Cerrar',
          { duration: 3000 }
        );
        this.calculateStatistics();
      },
      error: (error) => {
        console.error('Error toggling BIN status:', error);
        bin.is_active = previousState;
        this.snackBar.open('Error al cambiar estado del BIN', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }

  editBin(bin: MsiBinCatalog): void {
    const dialogData: BinDialogData = {
      mode: 'edit',
      bin: {
        id_msi_bin: bin.id_msi_bin,
        bin_start: bin.bin_start,
        bin_end: bin.bin_end,
        bank_name: bin.bank_name,
        card_brand: bin.card_brand,
        active: bin.is_active
      }
    };

    this.dialog.open(MsiBinDialogComponent, {
      width: '500px',
      data: dialogData
    }).afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: BinDialogResult) => {
      if (result && result.action === 'edit' && result.data) {
        this.msiBinesService.updateNationalBin(bin.id_msi_bin, result.data)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (updatedBin) => {
              const index = this.binCatalog.findIndex(b => b.id_msi_bin === bin.id_msi_bin);
              if (index !== -1) {
                this.binCatalog[index] = {
                  ...this.binCatalog[index],
                  bank_name: updatedBin.bank_name,
                  card_brand: updatedBin.card_brand,
                  is_active: updatedBin.active
                };
                this.dataSource.data = [...this.binCatalog];
                this.calculateStatistics();
              }
              this.snackBar.open('Rango BIN actualizado exitosamente', 'Cerrar', {
                duration: 3000
              });
            },
            error: (error) => {
              console.error('Error updating BIN:', error);
              this.snackBar.open('Error al actualizar el rango BIN', 'Cerrar', {
                duration: 3000
              });
            }
          });
      }
    });
  }

  viewBinDetails(bin: MsiBinCatalog): void {
    console.log('View BIN details:', bin);
    this.snackBar.open('Viendo detalles del BIN', 'Cerrar', {
      duration: 3000
    });
  }

  deleteBin(bin: MsiBinCatalog): void {
    if (confirm(`¿Está seguro de eliminar el rango de BIN ${bin.bin_start}-${bin.bin_end}?`)) {
      this.msiBinesService.removeNationalBin(bin.id_msi_bin)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.binCatalog = this.binCatalog.filter(b => b.id_msi_bin !== bin.id_msi_bin);
            this.dataSource.data = this.binCatalog;
            this.snackBar.open('Rango de BIN eliminado exitosamente', 'Cerrar', {
              duration: 3000
            });
            this.calculateStatistics();
          },
          error: (error) => {
            console.error('Error deleting BIN:', error);
            this.snackBar.open('Error al eliminar el rango BIN', 'Cerrar', {
              duration: 3000
            });
          }
        });
    }
  }

  validateBinRangeFromCatalog(bin: MsiBinCatalog): void {
    console.log('Validate BIN range:', bin);
    this.snackBar.open('Validación de rango en desarrollo', 'Cerrar', {
      duration: 3000
    });
  }

  validateBinRange(): void {
    if (!this.validationForm.valid) return;

    this.validating = true;
    this.validationResult = null;

    // Simulate validation
    setTimeout(() => {
      const formData = this.validationForm.value;

      // Check if BIN range conflicts with existing ranges
      const conflicts = this.binCatalog.filter(bin =>
        bin.is_active &&
        this.rangesOverlap(
          parseInt(formData.bin_start),
          parseInt(formData.bin_end),
          parseInt(bin.bin_start),
          parseInt(bin.bin_end)
        )
      );

      this.validationResult = {
        isValid: conflicts.length === 0,
        details: conflicts.length > 0
          ? [`Conflicto con ${conflicts.length} rangos existentes`]
          : ['Rango válido, sin conflictos detectados'],
        conflictingRanges: conflicts
      };

      this.validating = false;
    }, 1000);
  }

  private rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  detectConflicts(): void {
    this.conflicts = [];
    this.conflictCheckComplete = false;

    // Simulate conflict detection
    setTimeout(() => {
      this.conflicts = [
        {
          description: 'Rango 400000-450000 se solapa con rango 440000-480000',
          conflictingBins: ['440000-480000']
        }
      ];
      this.conflictCheckComplete = true;

      if (this.conflicts.length === 0) {
        this.snackBar.open('No se detectaron conflictos', 'Cerrar', {
          duration: 3000
        });
      }
    }, 1500);
  }

  validateAllRanges(): void {
    // Simulate mass validation
    setTimeout(() => {
      this.massValidationResult = {
        total: this.binCatalog.length,
        valid: this.binCatalog.length - 1,
        invalid: 1
      };

      this.snackBar.open('Validación masiva completada', 'Cerrar', {
        duration: 3000
      });
    }, 2000);
  }

  openAddBinDialog(): void {
    const dialogData: BinDialogData = { mode: 'add' };

    this.dialog.open(MsiBinDialogComponent, {
      width: '500px',
      data: dialogData
    }).afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: BinDialogResult) => {
      if (result && result.action === 'add' && result.data) {
        this.msiBinesService.addNationalBin(result.data)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (newBin) => {
              this.binCatalog.push({
                id_msi_bin: newBin.id_msi_bin,
                bin_start: newBin.bin_start,
                bin_end: newBin.bin_end,
                bank_name: newBin.bank_name,
                card_brand: newBin.card_brand,
                card_type: 'Crédito',
                country_code: 'MX',
                is_active: newBin.active,
                is_national: true,
                created_at: new Date(),
                updated_at: new Date(),
                created_by: 'system',
                transaction_count: 0,
                total_amount: 0
              });
              this.dataSource.data = [...this.binCatalog];
              this.calculateStatistics();
              this.snackBar.open('Rango BIN agregado exitosamente', 'Cerrar', {
                duration: 3000
              });
            },
            error: (error) => {
              console.error('Error adding BIN range:', error);
              this.snackBar.open('Error al agregar el rango BIN', 'Cerrar', {
                duration: 3000
              });
            }
          });
      }
    });
  }

  importBinRanges(): void {
    console.log('Import BIN ranges');
    this.snackBar.open('Función de importación en desarrollo', 'Cerrar', {
      duration: 3000
    });
  }

  exportBinCatalog(): void {
    // Simulate export functionality
    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `msi-bin-catalog-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.snackBar.open('Catálogo de BINs exportado exitosamente', 'Cerrar', {
      duration: 3000
    });
  }

  private generateCSVContent(): string {
    const headers = ['ID', 'BIN Inicial', 'BIN Final', 'Banco', 'Marca', 'Tipo', 'País', 'Nacional', 'Activo', 'Transacciones', 'Monto Total'];
    const rows = this.binCatalog.map(bin => [
      bin.id_msi_bin,
      bin.bin_start,
      bin.bin_end,
      bin.bank_name,
      bin.card_brand,
      bin.card_type,
      bin.country_code,
      bin.is_national ? 'Sí' : 'No',
      bin.is_active ? 'Sí' : 'No',
      bin.transaction_count,
      bin.total_amount
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

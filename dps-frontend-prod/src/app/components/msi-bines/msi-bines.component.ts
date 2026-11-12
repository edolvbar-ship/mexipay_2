import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MsiBinesService } from '../../services/msi-bines.service';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import {
  MsiNationalBin
} from '../../shared/interfaces/msi.interface';
import { MsiBinDialogComponent, BinDialogData, BinDialogResult } from '../msi-bin-dialog/msi-bin-dialog.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-msi-bines',
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
    MatCardModule
  ],
  template: `
    <div class="msi-bines-container">
      <div class="bines-header">
        <h2>Gestión de BINs Nacionales MSI</h2>
        <p>Administrar rangos de BIN para tarjetas nacionales elegibles para MSI</p>
      </div>

      <!-- Actions Bar -->
      <div class="toolbar-actions">
        <button mat-raised-button color="primary" (click)="openAddBinDialog()" class="toolbar-btn">
          ➕ Agregar Rango de BIN
        </button>
        <button mat-button (click)="loadBinRanges()" class="toolbar-btn">
          🔄 Actualizar
        </button>
        <button mat-button (click)="exportBinRanges()" class="toolbar-btn">
          📥 Exportar CSV
        </button>
        <button mat-button (click)="showStatistics()" class="toolbar-btn">
          📊 Estadísticas
        </button>
      </div>

      <!-- BIN Validation Tool -->
      <div class="validation-tool">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Herramienta de Validación de BIN</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="validationForm" class="validation-form">
              <mat-form-field appearance="outline" class="bin-input">
                <mat-label>Número de BIN</mat-label>
                <input matInput
                       formControlName="bin"
                       placeholder="Ej: 450123"
                       maxlength="8">
                <mat-icon matSuffix>credit_card</mat-icon>
                <mat-hint>Ingrese los primeros 6-8 dígitos de la tarjeta</mat-hint>
                <mat-error *ngIf="validationForm.get('bin')?.hasError('required')">
                  El BIN es requerido
                </mat-error>
                <mat-error *ngIf="validationForm.get('bin')?.hasError('pattern')">
                  El BIN debe contener solo dígitos
                </mat-error>
              </mat-form-field>
              <button mat-raised-button
                      color="primary"
                      (click)="validateBin()"
                      [disabled]="!validationForm.valid || validating"
                      class="toolbar-btn">
                🔍 Validar
              </button>
            </form>

            <div *ngIf="validationResult" class="validation-result" [class.eligible]="validationResult.is_msi_eligible" [class.not-eligible]="!validationResult.is_msi_eligible">
              <div class="result-header">
                <mat-icon [color]="validationResult.is_msi_eligible ? 'primary' : 'warn'">
                  {{ validationResult.is_msi_eligible ? 'check_circle' : 'cancel' }}
                </mat-icon>
                <span class="result-title">
                  {{ validationResult.is_msi_eligible ? 'BIN Elegible para MSI' : 'BIN No Elegible para MSI' }}
                </span>
              </div>
              <div class="result-details" *ngIf="validationResult.bin_info">
                <p><strong>Marca:</strong> {{ validationResult.bin_info.brand }}</p>
                <p><strong>Rango:</strong> {{ validationResult.bin_info.range }}</p>
                <p *ngIf="validationResult.bin_info.bank_name"><strong>Banco:</strong> {{ validationResult.bin_info.bank_name }}</p>
              </div>
              <div class="result-error" *ngIf="validationResult.error">
                <mat-icon color="warn">error</mat-icon>
                <span>{{ validationResult.error }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- BIN Ranges Table -->
      <div class="bines-table">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Rangos de BIN Configurados</mat-card-title>
            <mat-card-subtitle>{{ binRanges.length }} rangos configurados</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
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
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre del Banco</th>
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

                <!-- Status Column -->
                <ng-container matColumnDef="active">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Estado</th>
                  <td mat-cell *matCellDef="let bin">
                    <mat-slide-toggle
                      [(ngModel)]="bin.active"
                      (change)="toggleBinRange(bin)"
                      color="primary">
                      {{ bin.active ? 'Activo' : 'Inactivo' }}
                    </mat-slide-toggle>
                  </td>
                </ng-container>

                <!-- Actions Column -->
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>Acciones</th>
                  <td mat-cell *matCellDef="let bin">
                    <button mat-button color="primary" (click)="editBinRange(bin)" class="toolbar-btn">
                      ✏️ Editar
                    </button>
                    <button mat-button color="warn" (click)="deleteBinRange(bin)" class="toolbar-btn">
                      🗑️ Eliminar
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>

              <mat-paginator [pageSizeOptions]="[5, 10, 25, 100]" [pageSize]="10" showFirstLastButtons></mat-paginator>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Loading Spinner -->
      <div *ngIf="loading" class="loading-overlay">
        <mat-spinner></mat-spinner>
      </div>
    </div>
  `,
  styles: [`
    .msi-bines-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .msi-bines-container .mat-mdc-icon-button,
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

    .bines-header {
      margin-bottom: 32px;
      text-align: center;
    }

    .bines-header h2 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-size: 28px;
    }

    .bines-header p {
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

    .validation-tool {
      margin-bottom: 32px;
    }

    .validation-form {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .bin-input {
      flex: 1;
      max-width: 300px;
    }

    .validation-result {
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .validation-result.eligible {
      background-color: #e8f5e8;
      border: 1px solid #4caf50;
    }

    .validation-result.not-eligible {
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

    .result-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      margin-top: 8px;
    }

    .bines-table {
      margin-bottom: 32px;
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
      .msi-bines-container {
        padding: 16px;
      }

      .actions-bar {
        flex-direction: column;
      }

      .validation-form {
        flex-direction: column;
      }

      .bin-input {
        max-width: 100%;
      }
    }
  `]
})
export class MsiBinesComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['id_msi_bin', 'range', 'bank_name', 'card_brand', 'active', 'actions'];
  dataSource = new MatTableDataSource<MsiNationalBin>();
  binRanges: MsiNationalBin[] = [];

  validationForm: FormGroup;
  validationResult: any = null;
  validating = false;

  loading = false;
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private msiBinesService: MsiBinesService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.validationForm = this.fb.group({
      bin: ['', [Validators.required, Validators.pattern(/^\d{6,8}$/)]]
    });
  }

  ngOnInit() {
    this.loadBinRanges();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadBinRanges() {
    this.loading = true;
    this.msiBinesService.getNationalBines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (binRanges) => {
          this.binRanges = binRanges;
          this.dataSource.data = binRanges;
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading BIN ranges:', error);
          this.snackBar.open('Error al cargar rangos de BIN', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
  }

  validateBin() {
    if (!this.validationForm.valid) return;

    const bin = this.validationForm.get('bin')?.value;
    this.validating = true;
    this.validationResult = null;

    // Use client-side validation first
    setTimeout(() => {
      this.validationResult = this.msiBinesService.validateBin(bin);
      this.validating = false;
    }, 500);
  }

  toggleBinRange(bin: MsiNationalBin) {
    this.msiBinesService.toggleBinRange(bin.id_msi_bin, bin.active)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedBin) => {
          const index = this.binRanges.findIndex(b => b.id_msi_bin === bin.id_msi_bin);
          if (index !== -1) {
            this.binRanges[index] = updatedBin;
            this.dataSource.data = [...this.binRanges];
          }
          this.snackBar.open(
            `Rango de BIN ${bin.active ? 'activado' : 'desactivado'} exitosamente`,
            'Cerrar',
            { duration: 3000 }
          );
        },
        error: (error) => {
          console.error('Error toggling BIN range:', error);
          this.snackBar.open('Error al cambiar estado del rango de BIN', 'Cerrar', {
            duration: 3000
          });
          // Revert the change
          bin.active = !bin.active;
        }
      });
  }

  openAddBinDialog() {
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
              this.binRanges.push(newBin);
              this.dataSource.data = [...this.binRanges];
              this.snackBar.open('Rango de BIN agregado exitosamente', 'Cerrar', {
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

  editBinRange(bin: MsiNationalBin) {
    const dialogData: BinDialogData = {
      mode: 'edit',
      bin: {
        id_msi_bin: bin.id_msi_bin,
        bin_start: bin.bin_start,
        bin_end: bin.bin_end,
        bank_name: bin.bank_name,
        card_brand: bin.card_brand,
        active: bin.active
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
              const index = this.binRanges.findIndex(b => b.id_msi_bin === bin.id_msi_bin);
              if (index !== -1) {
                this.binRanges[index] = updatedBin;
                this.dataSource.data = [...this.binRanges];
              }
              this.snackBar.open('Rango de BIN actualizado exitosamente', 'Cerrar', {
                duration: 3000
              });
            },
            error: (error) => {
              console.error('Error updating BIN range:', error);
              this.snackBar.open('Error al actualizar el rango BIN', 'Cerrar', {
                duration: 3000
              });
            }
          });
      }
    });
  }

  deleteBinRange(bin: MsiNationalBin) {
    if (confirm(`¿Está seguro de eliminar el rango de BIN ${bin.bin_start}-${bin.bin_end}?`)) {
      this.msiBinesService.removeNationalBin(bin.id_msi_bin)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.binRanges = this.binRanges.filter(b => b.id_msi_bin !== bin.id_msi_bin);
            this.dataSource.data = this.binRanges;
            this.snackBar.open('Rango de BIN eliminado exitosamente', 'Cerrar', {
              duration: 3000
            });
          },
          error: (error) => {
            console.error('Error deleting BIN range:', error);
            this.snackBar.open('Error al eliminar rango de BIN', 'Cerrar', {
              duration: 3000
            });
          }
        });
    }
  }

  exportBinRanges() {
    this.msiBinesService.exportBinRanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `msi-bin-ranges-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.snackBar.open('Rangos de BIN exportados exitosamente', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error exporting BIN ranges:', error);
          this.snackBar.open('Error al exportar rangos de BIN', 'Cerrar', {
            duration: 3000
          });
        }
      });
  }

  showStatistics() {
    this.msiBinesService.getBinStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          console.log('BIN Statistics:', stats);
          this.snackBar.open('Estadísticas de BIN cargadas (ver consola)', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error loading BIN statistics:', error);
          this.snackBar.open('Error al cargar estadísticas de BIN', 'Cerrar', {
            duration: 3000
          });
        }
      });
  }
}

// Add styles to match MSI Templates component
const styles = `
.msi-bines-container .toolbar-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.msi-bines-container .toolbar-btn {
  min-width: auto;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 1.2;
  height: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.msi-bines-container .validation-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.msi-bines-container .bin-input {
  flex: 1;
  max-width: 300px;
}

.msi-bines-container .validation-result {
  margin-top: 16px;
  padding: 16px;
  border-radius: 4px;
}

.msi-bines-container .validation-result.eligible {
  background-color: #e8f5e8;
  border: 1px solid #4caf50;
}

.msi-bines-container .validation-result.not-eligible {
  background-color: #ffebee;
  border: 1px solid #f44336;
}

.msi-bines-container .result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.msi-bines-container .result-title {
  font-weight: 500;
}

.msi-bines-container .result-details p {
  margin: 4px 0;
}
`;

// Apply styles to document head if not already applied
if (typeof document !== 'undefined' && !document.querySelector('#msi-bines-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'msi-bines-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

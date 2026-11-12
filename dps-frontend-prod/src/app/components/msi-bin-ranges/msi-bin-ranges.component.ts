import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MsiConfigService } from '../../services/msi-config.service';
import { MsiBinesService } from '../../services/msi-bines.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

export interface MsiBinRange {
  id_msi_bin: number;
  bin_start: string;
  bin_end: string;
  bank_name: string;
  card_brand: string;
  country_code: string;
  active: number;
}

@Component({
  selector: 'app-msi-bin-ranges',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="msi-bin-ranges-container">
      <!-- Add New BIN Range -->
      <mat-card class="add-range-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>add_circle</mat-icon>
            Agregar Nuevo Rango BIN
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="addRangeForm" class="add-range-form">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>BIN Inicio</mat-label>
                <input matInput
                       formControlName="bin_start"
                       placeholder="400000"
                       maxlength="6">
                <mat-hint>6 dígitos del BIN inicial</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>BIN Fin</mat-label>
                <input matInput
                       formControlName="bin_end"
                       placeholder="499999"
                       maxlength="6">
                <mat-hint>6 dígitos del BIN final</mat-hint>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Banco</mat-label>
                <input matInput
                       formControlName="bank_name"
                       placeholder="Nombre del banco">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Marca Tarjeta</mat-label>
                <mat-select formControlName="card_brand">
                  <mat-option value="Visa">Visa</mat-option>
                  <mat-option value="Mastercard">Mastercard</mat-option>
                  <mat-option value="Amex">American Express</mat-option>
                  <mat-option value="Discover">Discover</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="toolbar-actions">
              <button mat-button type="button" (click)="resetForm()" class="toolbar-btn">
                🧹 Limpiar
              </button>
              <button mat-raised-button
                      color="primary"
                      type="submit"
                      (click)="addBinRange()"
                      [disabled]="!addRangeForm.valid"
                      class="toolbar-btn">
                ➕ Agregar Rango
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Existing BIN Ranges -->
      <mat-card class="ranges-list-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>list</mat-icon>
            Rangos BIN Existentes
          </mat-card-title>
          <mat-card-subtitle>
            {{ binRanges.length }} rangos configurados
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table mat-table [dataSource]="binRanges" class="bin-ranges-table">
              <!-- ID Column -->
              <ng-container matColumnDef="id_msi_bin">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let range">{{ range.id_msi_bin }}</td>
              </ng-container>

              <!-- BIN Range Column -->
              <ng-container matColumnDef="binRange">
                <th mat-header-cell *matHeaderCellDef>Rango BIN</th>
                <td mat-cell *matCellDef="let range">
                  <span class="bin-range">{{ range.bin_start }} - {{ range.bin_end }}</span>
                </td>
              </ng-container>

              <!-- Bank Name Column -->
              <ng-container matColumnDef="bank_name">
                <th mat-header-cell *matHeaderCellDef>Banco</th>
                <td mat-cell *matCellDef="let range">{{ range.bank_name }}</td>
              </ng-container>

              <!-- Card Brand Column -->
              <ng-container matColumnDef="card_brand">
                <th mat-header-cell *matHeaderCellDef>Marca</th>
                <td mat-cell *matCellDef="let range">
                  <span class="brand-badge brand-{{ range.card_brand.toLowerCase() }}">
                    {{ range.card_brand }}
                  </span>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let range">
                  <span class="status-badge" [class.active]="range.active === 1">
                    {{ range.active === 1 ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Acciones</th>
                <td mat-cell *matCellDef="let range">
                  <button mat-button
                          color="warn"
                          (click)="removeBinRange(range.id_msi_bin)"
                          class="toolbar-btn">
                    🗑️ Eliminar
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <div *ngIf="binRanges.length === 0" class="no-data">
            <mat-icon>inbox</mat-icon>
            <p>No hay rangos BIN configurados</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .msi-bin-ranges-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .toolbar-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .toolbar-btn {
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

    .add-range-card {
      margin-bottom: 24px;
    }

    .add-range-form {
      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }
    }

    .ranges-list-card {
      .table-container {
        overflow-x: auto;
      }

      .bin-ranges-table {
        width: 100%;
        min-width: 600px;
      }

      .msi-bin-ranges-container .mat-mdc-icon-button,
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

      .bin-range {
        font-family: monospace;
        font-weight: 500;
        background: #f5f5f5;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .brand-badge {
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 0.8rem;
        font-weight: 500;
        text-transform: uppercase;

        &.brand-visa {
          background: #1a1a1a;
          color: white;
        }

        &.brand-mastercard {
          background: #eb001b;
          color: white;
        }

        &.brand-amex {
          background: #006fcf;
          color: white;
        }

        &.brand-discover {
          background: #ff6000;
          color: white;
        }
      }

      .status-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
        background: #f44336;
        color: white;

        &.active {
          background: #4caf50;
        }
      }
    }

    .no-data {
      text-align: center;
      padding: 48px;
      color: #666;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 1.1rem;
      }
    }

    @media (max-width: 768px) {
      .add-range-form .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MsiBinRangesComponent implements OnInit {
  binRanges: MsiBinRange[] = [];
  displayedColumns: string[] = ['id_msi_bin', 'binRange', 'bank_name', 'card_brand', 'status', 'actions'];
  addRangeForm!: FormGroup;
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(
    private msiConfigService: MsiConfigService,
    private msiBinesService: MsiBinesService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadBinRanges();
  }

  private initializeForm(): void {
    this.addRangeForm = this.fb.group({
      bin_start: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]],
      bin_end: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]],
      bank_name: ['', Validators.required],
      card_brand: ['Visa', Validators.required]
    });
  }

  loadBinRanges(): void {
    this.loading = true;

    this.msiBinesService.getNationalBines()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (binRanges) => {
          this.binRanges = binRanges.map(range => ({
            id_msi_bin: range.id_msi_bin,
            bin_start: range.bin_start,
            bin_end: range.bin_end,
            bank_name: range.bank_name,
            card_brand: range.card_brand,
            country_code: 'MX',
            active: range.active ? 1 : 0
          }));
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading BIN ranges:', error);
          this.snackBar.open('Error al cargar los rangos BIN', 'Cerrar', {
            duration: 3000
          });
          this.binRanges = [];
          this.loading = false;
        }
      });
  }

  addBinRange(): void {
    if (this.addRangeForm.invalid) {
      this.snackBar.open('Por favor complete todos los campos correctamente', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const formData = this.addRangeForm.value;

    this.msiBinesService.addNationalBin(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newRange) => {
          this.binRanges.push({
            id_msi_bin: newRange.id_msi_bin,
            bin_start: newRange.bin_start,
            bin_end: newRange.bin_end,
            bank_name: newRange.bank_name,
            card_brand: newRange.card_brand,
            country_code: 'MX',
            active: newRange.active ? 1 : 0
          });
          this.snackBar.open('Rango BIN agregado exitosamente', 'Cerrar', {
            duration: 3000
          });
          this.resetForm();
        },
        error: (error) => {
          console.error('Error adding BIN range:', error);
          this.snackBar.open('Error al agregar el rango BIN', 'Cerrar', {
            duration: 3000
          });
        }
      });
  }

  removeBinRange(id: number): void {
    if (confirm('¿Está seguro de eliminar este rango BIN?')) {
      this.msiBinesService.removeNationalBin(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.binRanges = this.binRanges.filter(range => range.id_msi_bin !== id);
            this.snackBar.open('Rango BIN eliminado', 'Cerrar', {
              duration: 3000
            });
          },
          error: (error) => {
            console.error('Error removing BIN range:', error);
            this.snackBar.open('Error al eliminar el rango BIN', 'Cerrar', {
              duration: 3000
            });
          }
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  resetForm(): void {
    this.addRangeForm.reset({
      bin_start: '',
      bin_end: '',
      bank_name: '',
      card_brand: 'Visa'
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

export interface MsiSystemConfig {
  national_only: boolean;
  token_q6_supported: boolean;
  default_months: number[];
  min_transaction_amount: number;
  max_months_allowed: number;
  enable_auto_detection: boolean;
  bin_validation_enabled: boolean;
}

@Component({
  selector: 'app-msi-system-config',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
    FormsModule
  ],
  template: `
    <div class="msi-system-config-container">
      <!-- Global Settings -->
      <mat-card class="settings-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>settings</mat-icon>
            Configuración Global del Sistema
          </mat-card-title>
          <mat-card-subtitle>
            Configuraciones que afectan a todo el sistema MSI
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="systemConfigForm" class="config-form">
            <!-- Toggle Settings -->
            <div class="settings-section">
              <h3>Configuraciones Generales</h3>

              <div class="toggle-group">
                <mat-slide-toggle
                  formControlName="national_only"
                  class="setting-toggle">
                  <div class="toggle-content">
                    <span class="toggle-label">Solo Tarjetas Nacionales</span>
                    <span class="toggle-description">Limitar MSI solo a tarjetas emitidas en México</span>
                  </div>
                </mat-slide-toggle>

                <mat-slide-toggle
                  formControlName="token_q6_supported"
                  class="setting-toggle">
                  <div class="toggle-content">
                    <span class="toggle-label">Soporte Token Q6</span>
                    <span class="toggle-description">Habilitar procesamiento con tokens Q6</span>
                  </div>
                </mat-slide-toggle>

                <mat-slide-toggle
                  formControlName="enable_auto_detection"
                  class="setting-toggle">
                  <div class="toggle-content">
                    <span class="toggle-label">Detección Automática</span>
                    <span class="toggle-description">Detectar automáticamente elegibilidad MSI</span>
                  </div>
                </mat-slide-toggle>

                <mat-slide-toggle
                  formControlName="bin_validation_enabled"
                  class="setting-toggle">
                  <div class="toggle-content">
                    <span class="toggle-label">Validación BIN</span>
                    <span class="toggle-description">Validar BIN contra rangos configurados</span>
                  </div>
                </mat-slide-toggle>
              </div>
            </div>

            <!-- Numeric Settings -->
            <div class="settings-section">
              <h3>Límites y Montos</h3>

              <div class="numeric-settings">
                <mat-form-field appearance="outline">
                  <mat-label>Monto Mínimo de Transacción</mat-label>
                  <input matInput
                         type="number"
                         formControlName="min_transaction_amount"
                         placeholder="300.00">
                  <span matPrefix>$</span>
                  <mat-hint>Monto mínimo para considerar transacciones MSI</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Máximo de Meses Permitidos</mat-label>
                  <input matInput
                         type="number"
                         formControlName="max_months_allowed"
                         placeholder="18">
                  <mat-hint>Número máximo de meses MSI permitidos</mat-hint>
                </mat-form-field>
              </div>
            </div>

            <!-- Default Months Configuration -->
            <div class="settings-section">
              <h3>Meses MSI por Defecto</h3>
              <p class="section-description">
                Configure los meses MSI que estarán disponibles por defecto para nuevos comercios
              </p>

              <div class="months-grid">
                <div class="month-option"
                     *ngFor="let month of availableMonths"
                     [class.selected]="defaultMonths.includes(month)"
                     (click)="toggleMonth(month)">
                  <div class="month-checkbox">
                    <mat-icon>{{ defaultMonths.includes(month) ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
                  </div>
                  <span class="month-label">{{ month }} meses</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="form-actions">
              <button mat-button type="button" (click)="resetToDefaults()">
                <mat-icon>restore</mat-icon>
                Restablecer Valores por Defecto
              </button>
              <button mat-raised-button
                      color="primary"
                      type="submit"
                      (click)="saveSystemConfig()"
                      [disabled]="!systemConfigForm.valid">
                <mat-icon>save</mat-icon>
                Guardar Configuración del Sistema
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- System Status -->
      <mat-card class="status-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>monitoring</mat-icon>
            Estado del Sistema MSI
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="status-grid">
            <div class="status-item">
              <div class="status-icon active">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="status-info">
                <span class="status-title">Servicio MSI</span>
                <span class="status-value">Activo</span>
              </div>
            </div>

            <div class="status-item">
              <div class="status-icon active">
                <mat-icon>storage</mat-icon>
              </div>
              <div class="status-info">
                <span class="status-title">Base de Datos</span>
                <span class="status-value">Conectada</span>
              </div>
            </div>

            <div class="status-item">
              <div class="status-icon active">
                <mat-icon>credit_card</mat-icon>
              </div>
              <div class="status-info">
                <span class="status-title">Rangos BIN</span>
                <span class="status-value">16 configurados</span>
              </div>
            </div>

            <div class="status-item">
              <div class="status-icon warning">
                <mat-icon>warning</mat-icon>
              </div>
              <div class="status-info">
                <span class="status-title">Última Sincronización</span>
                <span class="status-value">Hace 2 horas</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .msi-system-config-container {
      padding: 24px;
      max-width: 1000px;
      margin: 0 auto;
    }

    .settings-card {
      margin-bottom: 24px;
    }

    .config-form {
      .settings-section {
        margin-bottom: 32px;

        h3 {
          margin: 0 0 16px 0;
          color: #333;
          font-size: 1.2rem;
          font-weight: 500;
        }

        .section-description {
          margin: 0 0 20px 0;
          color: #666;
          font-size: 0.9rem;
        }
      }

      .toggle-group {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .setting-toggle {
        width: 100%;

        ::ng-deep .mat-mdc-slide-toggle {
          width: 100%;
        }

        .toggle-content {
          display: flex;
          flex-direction: column;
          margin-left: 16px;

          .toggle-label {
            font-weight: 500;
            color: #333;
          }

          .toggle-description {
            font-size: 0.85rem;
            color: #666;
            margin-top: 4px;
          }
        }
      }

      .numeric-settings {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .months-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .month-option {
        display: flex;
        align-items: center;
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          border-color: #1976d2;
          background-color: #f5f9ff;
        }

        &.selected {
          border-color: #1976d2;
          background-color: #e3f2fd;
        }

        .month-checkbox {
          margin-right: 12px;
          color: #1976d2;
        }

        .month-label {
          font-weight: 500;
          color: #333;
        }
      }

      .form-actions {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid #e0e0e0;
      }
    }

    .status-card {
      .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }

      .status-item {
        display: flex;
        align-items: center;
        padding: 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;

        .status-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;

          &.active {
            background-color: #e8f5e8;
            color: #4caf50;
          }

          &.warning {
            background-color: #fff3e0;
            color: #ff9800;
          }

          &.error {
            background-color: #ffebee;
            color: #f44336;
          }
        }

        .status-info {
          flex: 1;

          .status-title {
            display: block;
            font-weight: 500;
            color: #333;
            margin-bottom: 4px;
          }

          .status-value {
            font-size: 0.9rem;
            color: #666;
          }
        }
      }
    }

    @media (max-width: 768px) {
      .numeric-settings {
        grid-template-columns: 1fr;
      }

      .months-grid {
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      }

      .form-actions {
        flex-direction: column;
      }
    }
  `]
})
export class MsiSystemConfigComponent implements OnInit {
  systemConfigForm!: FormGroup;
  availableMonths = [3, 6, 9, 12, 18];
  defaultMonths: number[] = [3, 6, 9, 12, 18];
  loading = false;
  private destroy$ = new Subject<void>();
  private apiUrl = '/api';

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadSystemConfig();
  }

  private initializeForm(): void {
    this.systemConfigForm = this.fb.group({
      national_only: [true],
      token_q6_supported: [false],
      default_months: [[3, 6, 9, 12, 18]],
      min_transaction_amount: [300, [Validators.required, Validators.min(0)]],
      max_months_allowed: [18, [Validators.required, Validators.min(1), Validators.max(24)]],
      enable_auto_detection: [true],
      bin_validation_enabled: [true]
    });
  }

  loadSystemConfig(): void {
    this.loading = true;

    this.http.get<MsiSystemConfig>(`${this.apiUrl}/msi/system-config`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (config) => {
          this.systemConfigForm.patchValue(config);
          this.defaultMonths = config.default_months || [3, 6, 9, 12, 18];
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading system config:', error);
          this.snackBar.open('Error al cargar la configuración del sistema', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
  }

  toggleMonth(month: number): void {
    const index = this.defaultMonths.indexOf(month);
    if (index > -1) {
      this.defaultMonths.splice(index, 1);
    } else {
      this.defaultMonths.push(month);
      this.defaultMonths.sort((a, b) => a - b);
    }
  }

  saveSystemConfig(): void {
    if (this.systemConfigForm.invalid) {
      this.snackBar.open('Por favor complete todos los campos correctamente', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const configData = {
      ...this.systemConfigForm.value,
      default_months: this.defaultMonths
    };

    this.http.put(`${this.apiUrl}/msi/system-config`, configData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Configuración del sistema guardada exitosamente', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error saving system config:', error);
          this.snackBar.open('Error al guardar la configuración del sistema', 'Cerrar', {
            duration: 3000
          });
        }
      });
  }

  resetToDefaults(): void {
    if (confirm('¿Está seguro de restablecer todos los valores a sus configuraciones por defecto?')) {
      const defaultConfig: MsiSystemConfig = {
        national_only: true,
        token_q6_supported: false,
        default_months: [3, 6, 9, 12, 18],
        min_transaction_amount: 300,
        max_months_allowed: 18,
        enable_auto_detection: true,
        bin_validation_enabled: true
      };

      this.systemConfigForm.patchValue(defaultConfig);
      this.defaultMonths = defaultConfig.default_months;

      this.snackBar.open('Configuración restablecida a valores por defecto', 'Cerrar', {
        duration: 3000
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

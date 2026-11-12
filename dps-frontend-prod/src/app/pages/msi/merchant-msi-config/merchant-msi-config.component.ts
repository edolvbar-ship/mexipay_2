import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MsiConfigService } from '../../../services/msi-config.service';
import { MsiBinesService } from '../../../services/msi-bines.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MsiConfig,
  ComponentMsiConfig,
  MsiPlan,
  MsiValidationResult
} from '../../../shared/interfaces/msi.interface';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-merchant-msi-config',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="merchant-msi-config">
      <div class="config-header">
        <div class="header-content">
          <button mat-icon-button (click)="goBack()" class="back-button">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="header-info">
            <h1>Configuración MSI</h1>
            <p *ngIf="merchantInfo">{{ merchantInfo.name_merchant }} - ID: {{ merchantInfo.id_merchant }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-button (click)="loadConfig()">
            <mat-icon>refresh</mat-icon>
            Actualizar
          </button>
          <button mat-raised-button color="primary"
                  (click)="saveConfig()"
                  [disabled]="saving">
            <mat-icon>save</mat-icon>
            Guardar
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="loading-spinner">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!loading && msiConfig" class="config-content">
        <mat-tab-group>
          <!-- MSI Configuration Tab -->
          <mat-tab label="Configuración MSI">
            <div class="tab-content">
              <!-- MSI Status -->
              <mat-card class="status-card">
                <mat-card-header>
                  <mat-card-title>Estado MSI</mat-card-title>
                  <mat-card-subtitle>Configuración general de MSI para este comercio</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="status-grid">
                    <div class="status-item">
                      <mat-slide-toggle [ngModel]="msiConfig.enabled" (ngModelChange)="onEnabledChange($event)">
                        MSI Habilitado
                      </mat-slide-toggle>
                      <p class="status-description">Activar MSI para este comercio</p>
                    </div>

                    <div class="status-item">
                      <mat-slide-toggle [ngModel]="msiConfig.national_only" disabled>
                        Solo Tarjetas Nacionales
                      </mat-slide-toggle>
                      <p class="status-description">Restringir a tarjetas mexicanas</p>
                    </div>

                    <div class="status-item">
                      <mat-slide-toggle [ngModel]="msiConfig.token_q6_supported" disabled>
                        Token Q6 Soportado
                      </mat-slide-toggle>
                      <p class="status-description">Soporte para Token Q6</p>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- MSI Plans Configuration -->
              <mat-card class="plans-card">
                <mat-card-header>
                  <mat-card-title>Planes MSI</mat-card-title>
                  <mat-card-subtitle>Configurar montos mínimos por plan</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="msiForm" class="msi-form">
                    <div class="plans-grid">
                      <div *ngFor="let plan of msiPlans; let i = index" class="plan-card"
                           [class.disabled]="!plan.enabled || !msiConfig.enabled">
                        <div class="plan-header">
                          <mat-slide-toggle
                            [(ngModel)]="plan.enabled"
                            (change)="onPlanChange(i)"
                            [disabled]="!msiConfig.enabled">
                            {{ plan.months }} Meses
                          </mat-slide-toggle>
                          <div class="plan-status">
                            <mat-icon [color]="plan.enabled && msiConfig.enabled ? 'primary' : 'disabled'">
                              {{ plan.enabled && msiConfig.enabled ? 'check_circle' : 'remove_circle' }}
                            </mat-icon>
                          </div>
                        </div>
                        <div class="plan-content">
                          <mat-form-field appearance="outline" class="amount-field">
                            <mat-label>Monto Mínimo</mat-label>
                            <input matInput
                                   type="number"
                                   [formControlName]="'amount_' + plan.months"
                                   [disabled]="!plan.enabled || !msiConfig.enabled"
                                   placeholder="0.00">
                            <span matPrefix>$</span>
                            <mat-hint>Monto mínimo para este plan</mat-hint>
                          </mat-form-field>
                        </div>
                      </div>
                    </div>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- Operations with MSI -->
              <mat-card class="operations-card">
                <mat-card-header>
                  <mat-card-title>Operaciones con MSI</mat-card-title>
                  <mat-card-subtitle>Operaciones habilitadas para MSI</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="operations-list">
                    <div *ngFor="let operation of msiConfig?.enabled_operations" class="operation-item">
                      <mat-checkbox
                        [checked]="operation.msi_enabled"
                        disabled="true"
                        color="primary">
                        {{ operation.name }}
                      </mat-checkbox>
                      <div class="operation-details">
                        <span class="operation-id">ID: {{ operation.id_operation }}</span>
                        <mat-chip [color]="operation.msi_enabled ? 'primary' : 'default'">
                          {{ operation.msi_enabled ? 'Habilitado' : 'Deshabilitado' }}
                        </mat-chip>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- BIN Validation Tab -->
          <mat-tab label="Validación de BIN">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Herramienta de Validación de BIN</mat-card-title>
                  <mat-card-subtitle>Probar elegibilidad de BIN para este comercio</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="binValidationForm" class="validation-form">
                    <mat-form-field appearance="outline" class="bin-input">
                      <mat-label>Número de BIN</mat-label>
                      <input matInput
                             formControlName="bin"
                             placeholder="Ej: 450123"
                             maxlength="8">
                      <mat-icon matSuffix>credit_card</mat-icon>
                      <mat-hint>Ingrese los primeros 6-8 dígitos de la tarjeta</mat-hint>
                      <mat-error *ngIf="binValidationForm.get('bin')?.hasError('required')">
                        El BIN es requerido
                      </mat-error>
                      <mat-error *ngIf="binValidationForm.get('bin')?.hasError('pattern')">
                        El BIN debe contener solo dígitos
                      </mat-error>
                    </mat-form-field>
                    <button mat-raised-button
                            color="primary"
                            (click)="validateBinForMerchant()"
                            [disabled]="!binValidationForm.valid || validating">
                      <mat-icon>search</mat-icon>
                      Validar
                    </button>
                  </form>

                  <div *ngIf="validationResult" class="validation-result"
                       [class.eligible]="validationResult.is_msi_eligible"
                       [class.not-eligible]="!validationResult.is_msi_eligible">
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
          </mat-tab>

          <!-- History Tab -->
          <mat-tab label="Historial de Cambios">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Historial de Configuración MSI</mat-card-title>
                  <mat-card-subtitle>Últimos cambios en la configuración</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="history-timeline">
                    <div *ngFor="let change of configHistory" class="history-item">
                      <div class="history-marker">
                        <mat-icon [color]="change.type === 'update' ? 'primary' : 'accent'">
                          {{ change.type === 'update' ? 'edit' : 'add' }}
                        </mat-icon>
                      </div>
                      <div class="history-content">
                        <div class="history-header">
                          <span class="history-title">{{ change.title }}</span>
                          <span class="history-date">{{ formatDate(change.timestamp) }}</span>
                        </div>
                        <p class="history-description">{{ change.description }}</p>
                        <div class="history-details" *ngIf="change.details">
                          <span *ngFor="let detail of change.details" class="detail-chip">
                            {{ detail }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
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
    .merchant-msi-config {
      padding: 24px;
      max-width: 1200px;
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

    .merchant-msi-config .mat-mdc-icon-button,
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

    .status-card,
    .plans-card,
    .operations-card {
      margin-bottom: 24px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }

    .status-item {
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .status-description {
      margin: 8px 0 0 0;
      color: #666;
      font-size: 14px;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .plan-card {
      padding: 20px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .plan-card:not(.disabled) {
      border-color: #1976d2;
      background-color: #f5f9ff;
    }

    .plan-card.disabled {
      opacity: 0.6;
      background-color: #f5f5f5;
    }

    .plan-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .plan-status mat-icon {
      font-size: 20px;
    }

    .plan-content {
      margin-top: 16px;
    }

    .amount-field {
      width: 100%;
    }

    .operations-list {
      display: grid;
      gap: 12px;
    }

    .operation-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .operation-details {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .operation-id {
      font-size: 12px;
      color: #666;
    }

    .validation-form {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .bin-input {
      flex: 1;
      min-width: 250px;
    }

    .validation-result {
      padding: 20px;
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
      margin-bottom: 16px;
    }

    .result-title {
      font-weight: 600;
      font-size: 18px;
    }

    .result-details p {
      margin: 6px 0;
      color: #333;
    }

    .result-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      margin-top: 12px;
    }

    .history-timeline {
      position: relative;
      padding-left: 32px;
    }

    .history-timeline::before {
      content: '';
      position: absolute;
      left: 12px;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: #e0e0e0;
    }

    .history-item {
      position: relative;
      padding-bottom: 24px;
    }

    .history-marker {
      position: absolute;
      left: -20px;
      top: 0;
      width: 24px;
      height: 24px;
      background-color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #e0e0e0;
    }

    .history-marker mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .history-title {
      font-weight: 600;
      color: #333;
    }

    .history-date {
      font-size: 12px;
      color: #666;
    }

    .history-description {
      margin: 4px 0;
      color: #666;
    }

    .history-details {
      margin-top: 8px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .detail-chip {
      background-color: #e3f2fd;
      color: #1976d2;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
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
      .merchant-msi-config {
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

      .status-grid {
        grid-template-columns: 1fr;
      }

      .plans-grid {
        grid-template-columns: 1fr;
      }

      .validation-form {
        flex-direction: column;
      }

      .operation-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
    }
  `]
})
export class MerchantMsiConfigComponent implements OnInit, OnDestroy {
  idMerchant: number = 0;
  merchantInfo: any = null;

  msiConfig: ComponentMsiConfig | null = null;
  msiPlans: MsiPlan[] = [];
  msiForm!: FormGroup;

  binValidationForm: FormGroup;
  validationResult: MsiValidationResult | null = null;
  validating = false;

  configHistory: any[] = [];

  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  private destroy$ = new Subject<void>();
  private apiUrl = '/api';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private msiConfigService: MsiConfigService,
    private msiBinesService: MsiBinesService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    this.binValidationForm = this.fb.group({
      bin: ['', [Validators.required, Validators.pattern(/^\d{6,8}$/)]]
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.idMerchant = +params['id'];
      if (this.idMerchant) {
        this.loadMerchantInfo();
        this.loadConfig();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    const formGroup: any = {};
    [3, 6, 9, 12, 18].forEach(months => {
      formGroup[`amount_${months}`] = ['', [Validators.required, Validators.min(0)]];
    });

    this.msiForm = this.fb.group(formGroup);
  }

  private loadMerchantInfo() {
    // This would load merchant information
    this.merchantInfo = {
      id_merchant: this.idMerchant,
      name_merchant: `Comercio ${this.idMerchant}`
    };
  }

  loadConfig() {
    if (!this.idMerchant) return;

    this.loading = true;
    this.error = null;

    this.msiConfigService.getMsiConfig(this.idMerchant).pipe(takeUntil(this.destroy$)).subscribe({
      next: (config: MsiConfig) => {
        this.msiConfig = this.transformServiceResponse(config);
        this.initializePlans();
        this.loadConfigHistory();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading MSI config:', error);
        this.error = 'Error al cargar configuración MSI';
        this.loading = false;
      }
    });
  }

  private transformServiceResponse(serviceConfig: MsiConfig): ComponentMsiConfig {
    return {
      enabled: serviceConfig.msi_config && serviceConfig.msi_config.length > 0,
      national_only: serviceConfig.national_only,
      token_q6_supported: serviceConfig.token_q6_supported,
      months_options: serviceConfig.months_options || [3, 6, 9, 12, 18],
      min_amounts: serviceConfig.min_amounts || {},
      enabled_operations: serviceConfig.enabled_operations || []
    };
  }

  private initializePlans() {
    if (!this.msiConfig) return;

    this.msiPlans = this.msiConfig.months_options.map(months => ({
      months,
      min_amount: this.msiConfig!.min_amounts[months] || 0,
      enabled: this.msiConfig!.enabled
    }));

    this.initializeForm();

    // Update form values
    this.msiPlans.forEach(plan => {
      this.msiForm.get(`amount_${plan.months}`)?.setValue(plan.min_amount);
    });
  }

  private loadConfigHistory() {
    this.http.get<any[]>(`${this.apiUrl}/msi/merchants/${this.idMerchant}/history`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.configHistory = history;
        },
        error: (error) => {
          console.error('Error loading config history:', error);
          this.configHistory = [];
        }
      });
  }

  onEnabledChange(enabled: boolean) {
    if (!this.msiConfig) return;

    this.msiConfig.enabled = enabled;

    // Enable/disable all plans when MSI is toggled
    this.msiPlans.forEach(plan => {
      plan.enabled = enabled;
    });
  }

  onPlanChange(index: number) {
    const plan = this.msiPlans[index];
    if (!plan.enabled) {
      this.msiForm.get(`amount_${plan.months}`)?.setValue(0);
    }
  }

  saveConfig() {
    this.saving = true;
    this.error = null;
    this.success = null;

    const updates = this.msiPlans
      .filter(plan => plan.enabled)
      .map(plan => ({
        months: plan.months,
        min_amount: parseFloat(this.msiForm.get(`amount_${plan.months}`)?.value || 0)
      }));

    // Also include disabled plans with 0 amount to ensure they are properly disabled
    const disabledPlans = this.msiPlans
      .filter(plan => !plan.enabled)
      .map(plan => ({
        months: plan.months,
        min_amount: 0
      }));

    const allUpdates = [...updates, ...disabledPlans];

    this.msiConfigService.updateMsiConfig(this.idMerchant, allUpdates).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.success = 'Configuración MSI guardada exitosamente';
        this.saving = false;
        this.snackBar.open('Configuración MSI guardada exitosamente', 'Cerrar', {
          duration: 3000
        });

        // Reload config to get latest data
        setTimeout(() => {
          this.loadConfig();
        }, 1000);
      },
      error: (error) => {
        console.error('Error saving MSI config:', error);
        this.error = 'Error al guardar configuración MSI';
        this.saving = false;
      }
    });
  }

  validateBinForMerchant() {
    if (!this.binValidationForm.valid) return;

    const bin = this.binValidationForm.get('bin')?.value;
    this.validating = true;
    this.validationResult = null;

    // Use client-side validation for now
    setTimeout(() => {
      this.validationResult = this.msiBinesService.validateBin(bin);
      this.validating = false;
    }, 500);
  }

  goBack() {
    this.router.navigate(['/comercios']);
  }

  formatDate(date: Date): string {
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

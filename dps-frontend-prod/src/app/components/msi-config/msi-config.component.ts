import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MsiConfigService, MsiConfig } from '../../services/msi-config.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Component-specific interface for internal use
export interface ComponentMsiConfig {
  id_merchant: number;
  name_merchant: string;
  msi_config: Array<{
    type: string;
    min_mount: string;
    percent: string;
  }>;
  enabled: boolean;
  national_only: boolean;
  token_q6_supported: boolean;
  months_options: number[];
  min_amounts: { [key: number]: number };
  enabled_operations: Array<{
    id_operation: number;
    name: string;
    msi_enabled: number;
  }>;
}

export interface MsiPlan {
  months: number;
  min_amount: number;
  enabled: boolean;
}

@Component({
  selector: 'app-msi-config',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="msi-config-container" id="msiConfigContainer">
      <div class="config-header">
        <h3>Configuración MSI</h3>
        <div style="display: flex; align-items: center; gap: 10px;">
          <p id="statusText">Configurar Meses Sin Intereses para el comercio</p>
          <button id="refreshBtn" onclick="loadConfig()" disabled>
            🔄 Forzar Carga MSI
          </button>
        </div>
      </div>

      <div id="loadingSpinner" class="loading-spinner" style="display: none;">
        <div class="spinner"></div>
      </div>

      <div id="debugInfo" style="background: #ffeb3b; padding: 10px; margin: 10px 0; border: 2px solid #f44336; display: none;">
        <h4>🔍 DEBUG INFO:</h4>
        <p><strong>Loading:</strong> <span id="debugLoading">false</span></p>
        <p><strong>MSI Config exists:</strong> <span id="debugConfigExists">NO</span></p>
        <p><strong>MSI Config enabled:</strong> <span id="debugConfigEnabled">false</span></p>
        <p><strong>Merchant ID:</strong> <span id="debugMerchantId">0</span></p>
        <p><strong>Error:</strong> <span id="debugError">none</span></p>
        <p><strong>MSI Plans count:</strong> <span id="debugPlansCount">0</span></p>
      </div>

      <div id="configContent" style="background: #e8f5e8; padding: 20px; margin: 10px 0; border: 2px solid #4caf50; display: none;">
        <h3>✅ MSI CONFIGURATION CONTENT</h3>
        <p><strong>Merchant:</strong> <span id="merchantName">N/A</span></p>
        <p><strong>MSI Enabled:</strong> <span id="msiEnabled">NO</span></p>
        <p><strong>Plans Available:</strong> <span id="plansAvailable">0</span></p>

        <h4>MSI Plans:</h4>
        <div id="plansContainer"></div>

        <h4>Operations:</h4>
        <div id="operationsContainer"></div>
      </div>

      <div id="fullConfigContent" class="config-content" style="display: none;">
        <div class="config-section">
          <h4>Estado MSI</h4>
          <div class="status-grid">
            <div class="status-item">
              <span class="status-label">MSI Habilitado:</span>
              <input type="checkbox" id="msiEnabledToggle" onchange="onEnabledChange()">
              <label for="msiEnabledToggle" id="msiEnabledLabel">No</label>
            </div>
            <div class="status-item">
              <span class="status-label">Solo Tarjetas Nacionales:</span>
              <input type="checkbox" id="nationalOnlyToggle" disabled>
              <label for="nationalOnlyToggle" id="nationalOnlyLabel">No</label>
            </div>
            <div class="status-item">
              <span class="status-label">Token Q6 Soportado:</span>
              <input type="checkbox" id="tokenQ6Toggle" disabled>
              <label for="tokenQ6Toggle" id="tokenQ6Label">No</label>
            </div>
          </div>
        </div>

        <div class="config-section">
          <h4>Planes MSI</h4>
          <div class="plans-grid" id="plansGrid"></div>
        </div>

        <div class="config-section">
          <h4>Operaciones con MSI</h4>
          <div class="operations-list" id="operationsList"></div>
        </div>

        <div class="toolbar-actions">
          <button onclick="loadConfig()" class="toolbar-btn">🔄 Recargar</button>
          <button onclick="saveConfig()" id="saveBtn" disabled class="toolbar-btn">💾 Guardar Configuración</button>
        </div>
      </div>

      <div id="errorMessage" class="error-message" style="display: none;">
        <span style="color: #f44336;">❌</span>
        <span id="errorText"></span>
      </div>
    </div>
  `,
  styles: [`
    .msi-config-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }

    .config-header {
      margin-bottom: 30px;
      text-align: center;
    }

    .config-header h3 {
      margin: 0 0 8px 0;
      color: #1976d2;
    }

    .config-header p {
      margin: 0;
      color: #666;
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .config-section {
      margin-bottom: 30px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .config-section h4 {
      margin: 0 0 20px 0;
      color: #333;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }

    .status-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .status-label {
      font-weight: 500;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      margin-bottom: 15px;
    }

    .plan-content {
      margin-top: 10px;
    }

    .amount-field {
      width: 100%;
    }

    .operations-list {
      display: grid;
      gap: 10px;
    }

    .operation-item {
      padding: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .toolbar-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 30px;
      flex-wrap: wrap;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 15px;
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      color: #856404;
      margin-top: 20px;
    }

    .mat-spinner {
      width: 40px;
      height: 40px;
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
  `]
})
export class MsiConfigComponent implements OnInit, OnChanges {
  @Input() idMerchant: number = 0;

  msiConfig: ComponentMsiConfig | null = null;
  msiPlans: MsiPlan[] = [];
  msiForm!: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private msiConfigService: MsiConfigService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    console.log('🔍 MSI Config Debug - Constructor called');
    this.initializeForm();
    this.initializeGlobalFunctions();
  }

  private initializeGlobalFunctions() {
    // Make functions available to global scope for onclick handlers
    (window as any).loadConfig = () => this.loadConfig();
    (window as any).saveConfig = () => this.saveConfig();
    (window as any).onEnabledChange = () => this.onEnabledChange();
    (window as any).onPlanChange = (index: number) => this.onPlanChange(index);
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('🔍 MSI Config Debug - ngOnChanges called');
    console.log('🔍 MSI Config Debug - changes:', changes);

    if (changes['idMerchant']) {
      const currentId = changes['idMerchant'].currentValue;
      const previousId = changes['idMerchant'].previousValue;

      console.log('🔍 MSI Config Debug - idMerchant changed from', previousId, 'to', currentId);

      if (currentId && currentId > 0 && currentId !== previousId) {
        console.log('🔍 MSI Config Debug - Loading config for merchant:', currentId);
        this.loadConfig();
      }
    }
  }

  ngOnInit() {
    console.log('🔍 MSI Config Debug - ngOnInit called');
    console.log('🔍 MSI Config Debug - idMerchant:', this.idMerchant);

    // Initialize msiConfig to prevent null reference errors
    this.msiConfig = {
      id_merchant: 0,
      name_merchant: '',
      msi_config: [],
      enabled: false,
      national_only: false,
      token_q6_supported: false,
      months_options: [],
      min_amounts: {},
      enabled_operations: []
    };

    if (this.idMerchant && this.idMerchant > 0) {
      console.log('🔍 MSI Config Debug - Loading config for merchant:', this.idMerchant);
      this.loadConfig();
    } else {
      console.log('🔍 MSI Config Debug - No valid idMerchant, not loading config');
      console.log('🔍 MSI Config Debug - Will retry loading after delay...');
      // Retry after a short delay to allow parent to set the ID
      setTimeout(() => {
        if (this.idMerchant && this.idMerchant > 0) {
          console.log('🔍 MSI Config Debug - Retry loading config for merchant:', this.idMerchant);
          this.loadConfig();
        } else {
          console.log('🔍 MSI Config Debug - Still no valid idMerchant after retry');
        }
      }, 1000);
    }
  }

  private initializeForm() {
    const formGroup: any = {};
    [3, 6, 9, 12, 18].forEach(months => {
      formGroup[`amount_${months}`] = ['', [Validators.required, Validators.min(0)]];
    });

    this.msiForm = this.fb.group(formGroup);
  }

  loadConfig() {
    console.log('🔍 MSI Config Debug - loadConfig called');
    console.log('🔍 MSI Config Debug - idMerchant:', this.idMerchant);

    if (!this.idMerchant) {
      console.log('🔍 MSI Config Debug - No idMerchant, setting error');
      this.error = 'ID de comercio no proporcionado';
      this.updateDebugInfo();
      return;
    }

    this.loading = true;
    this.error = null;
    this.updateDebugInfo();
    console.log('🔍 MSI Config Debug - Calling API for merchant:', this.idMerchant);

    this.msiConfigService.getMsiConfig(this.idMerchant).subscribe({
      next: (config: MsiConfig) => {
        console.log('🔍 MSI Config Debug - API response:', config);
        // Transform service response to component format
        this.msiConfig = this.transformServiceResponse(config);
        console.log('🔍 MSI Config Debug - Transformed config:', this.msiConfig);
        this.initializePlans();
        this.renderContent();
        this.loading = false;
        this.updateDebugInfo();
        console.log('🔍 MSI Config Debug - Loading complete');
      },
      error: (error) => {
        console.error('🔍 MSI Config Debug - API Error:', error);
        this.error = 'Error al cargar configuración MSI';
        this.loading = false;
        this.updateDebugInfo();
      }
    });
  }

  private updateDebugInfo() {
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
      (document.getElementById('debugLoading') as HTMLElement).textContent = this.loading.toString();
      (document.getElementById('debugConfigExists') as HTMLElement).textContent = this.msiConfig ? 'YES' : 'NO';
      (document.getElementById('debugConfigEnabled') as HTMLElement).textContent = this.msiConfig?.enabled?.toString() || 'false';
      (document.getElementById('debugMerchantId') as HTMLElement).textContent = this.idMerchant.toString();
      (document.getElementById('debugError') as HTMLElement).textContent = this.error || 'none';
      (document.getElementById('debugPlansCount') as HTMLElement).textContent = this.msiPlans?.length.toString() || '0';
      debugInfo.style.display = 'block';
    }

    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) {
      loadingSpinner.style.display = this.loading ? 'block' : 'none';
    }

    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
      if (this.error) {
        (document.getElementById('errorText') as HTMLElement).textContent = this.error;
        errorMessage.style.display = 'block';
      } else {
        errorMessage.style.display = 'none';
      }
    }
  }

  private renderContent() {
    if (!this.msiConfig) return;

    // Update status text
    const statusText = document.getElementById('statusText');
    if (statusText) {
      statusText.textContent = this.msiConfig.enabled
        ? `Configuración MSI Activa - ${this.msiConfig.months_options?.length || 0} Planes Disponibles`
        : 'Configurar Meses Sin Intereses para el comercio';
    }

    // Update refresh button
    const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
    if (refreshBtn) {
      refreshBtn.textContent = this.loading ? 'Cargando...' : '🔄 Forzar Carga MSI';
      refreshBtn.disabled = this.loading;
    }

    // Update config content
    const configContent = document.getElementById('configContent');
    if (configContent) {
      (document.getElementById('merchantName') as HTMLElement).textContent = this.msiConfig.name_merchant || 'N/A';
      (document.getElementById('msiEnabled') as HTMLElement).textContent = this.msiConfig.enabled ? 'YES' : 'NO';
      (document.getElementById('plansAvailable') as HTMLElement).textContent = this.msiConfig.months_options?.length.toString() || '0';

      // Render plans
      const plansContainer = document.getElementById('plansContainer');
      if (plansContainer) {
        plansContainer.innerHTML = '';
        this.msiPlans.forEach(plan => {
          const planDiv = document.createElement('div');
          planDiv.style.cssText = 'background: white; padding: 10px; margin: 5px 0; border: 1px solid #ccc;';
          planDiv.innerHTML = `<p><strong>${plan.months} Months:</strong> $${plan.min_amount} (Enabled: ${plan.enabled})</p>`;
          plansContainer.appendChild(planDiv);
        });
      }

      // Render operations
      const operationsContainer = document.getElementById('operationsContainer');
      if (operationsContainer) {
        operationsContainer.innerHTML = '';
        this.msiConfig.enabled_operations.forEach(operation => {
          const opDiv = document.createElement('div');
          opDiv.style.cssText = 'background: white; padding: 10px; margin: 5px 0; border: 1px solid #ccc;';
          opDiv.innerHTML = `<p><strong>${operation.name}:</strong> MSI ${operation.msi_enabled ? 'Enabled' : 'Disabled'}</p>`;
          operationsContainer.appendChild(opDiv);
        });
      }

      configContent.style.display = 'block';
    }

    // Update full config content
    const fullConfigContent = document.getElementById('fullConfigContent');
    if (fullConfigContent) {
      // Update MSI enabled toggle
      const msiEnabledToggle = document.getElementById('msiEnabledToggle') as HTMLInputElement;
      const msiEnabledLabel = document.getElementById('msiEnabledLabel');
      if (msiEnabledToggle && msiEnabledLabel) {
        msiEnabledToggle.checked = this.msiConfig.enabled;
        msiEnabledLabel.textContent = this.msiConfig.enabled ? 'Sí' : 'No';
      }

      // Update other toggles
      const nationalOnlyToggle = document.getElementById('nationalOnlyToggle') as HTMLInputElement;
      const nationalOnlyLabel = document.getElementById('nationalOnlyLabel');
      if (nationalOnlyToggle && nationalOnlyLabel) {
        nationalOnlyToggle.checked = this.msiConfig.national_only;
        nationalOnlyLabel.textContent = this.msiConfig.national_only ? 'Sí' : 'No';
      }

      const tokenQ6Toggle = document.getElementById('tokenQ6Toggle') as HTMLInputElement;
      const tokenQ6Label = document.getElementById('tokenQ6Label');
      if (tokenQ6Toggle && tokenQ6Label) {
        tokenQ6Toggle.checked = this.msiConfig.token_q6_supported;
        tokenQ6Label.textContent = this.msiConfig.token_q6_supported ? 'Sí' : 'No';
      }

      // Render plans grid
      const plansGrid = document.getElementById('plansGrid');
      if (plansGrid) {
        plansGrid.innerHTML = '';
        this.msiPlans.forEach((plan, index) => {
          const planCard = document.createElement('div');
          planCard.className = `plan-card ${plan.enabled ? '' : 'disabled'}`;
          planCard.innerHTML = `
            <div class="plan-header">
              <input type="checkbox" id="plan_${plan.months}" ${plan.enabled ? 'checked' : ''}
                     onchange="onPlanChange(${index})" ${!this.msiConfig?.enabled ? 'disabled' : ''}>
              <label for="plan_${plan.months}">${plan.months} Meses</label>
            </div>
            <div class="plan-content">
              <input type="number" id="amount_${plan.months}" value="${plan.min_amount}"
                     ${!plan.enabled || !this.msiConfig?.enabled ? 'disabled' : ''}
                     placeholder="0.00" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
          `;
          plansGrid.appendChild(planCard);
        });
      }

      // Render operations list
      const operationsList = document.getElementById('operationsList');
      if (operationsList) {
        operationsList.innerHTML = '';
        this.msiConfig.enabled_operations.forEach(operation => {
          const opItem = document.createElement('div');
          opItem.className = 'operation-item';
          opItem.innerHTML = `
            <input type="checkbox" checked disabled>
            <label>${operation.name}</label>
          `;
          operationsList.appendChild(opItem);
        });
      }

      // Update save button
      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.disabled = this.loading;
      }

      fullConfigContent.style.display = 'block';
    }
  }

  private transformServiceResponse(serviceConfig: MsiConfig): ComponentMsiConfig {
    console.log('🔍 Transform Debug - Original serviceConfig:', serviceConfig);

    return {
      id_merchant: serviceConfig.id_merchant,
      name_merchant: serviceConfig.name_merchant,
      msi_config: serviceConfig.msi_config || [],
      enabled: serviceConfig.enabled,
      national_only: serviceConfig.national_only,
      token_q6_supported: serviceConfig.token_q6_supported,
      months_options: serviceConfig.months_options || [3, 6, 9, 12, 18],
      min_amounts: serviceConfig.min_amounts || {},
      enabled_operations: (serviceConfig.enabled_operations || []).map(op => {
        console.log('🔍 Operation Debug - Raw op:', op);
        const finalName = op.name || 'Unknown Operation';
        console.log('🔍 Operation Debug - Final name:', finalName);
        return {
          id_operation: op.id_operation,
          name: finalName,
          msi_enabled: op.msi_enabled
        };
      })
    };
  }

  private initializePlans() {
    if (!this.msiConfig) return;

    console.log('🔍 MSI Config Debug - msi_config data:', this.msiConfig.msi_config);
    console.log('🔍 MSI Config Debug - months_options:', this.msiConfig.months_options);
    console.log('🔍 MSI Config Debug - min_amounts:', this.msiConfig.min_amounts);

    // Create plans from msi_config data
    this.msiPlans = this.msiConfig.msi_config.map((config: any) => {
      const months = parseInt(config.months) || 0;
      const minAmount = parseFloat(config.min_amount) || 0;

      console.log('🔍 Plan Debug - Config:', config, 'Parsed months:', months, 'Parsed amount:', minAmount);

      return {
        months: months,
        min_amount: minAmount,
        enabled: config.enabled && this.msiConfig!.enabled
      };
    }).filter(plan => plan.months > 0); // Filter out invalid plans

    console.log('🔍 MSI Config Debug - Created msiPlans:', this.msiPlans);
    console.log('🔍 MSI Config Debug - msiPlans length:', this.msiPlans.length);
    console.log('🔍 MSI Config Debug - msiPlans first item:', this.msiPlans[0]);

    // Update form values
    this.msiPlans.forEach(plan => {
      this.msiForm.get(`amount_${plan.months}`)?.setValue(plan.min_amount);
    });
  }

  onEnabledChange() {
    if (!this.msiConfig) return;

    // Update the checkbox value from DOM
    const msiEnabledToggle = document.getElementById('msiEnabledToggle') as HTMLInputElement;
    if (msiEnabledToggle) {
      this.msiConfig.enabled = msiEnabledToggle.checked;
      (document.getElementById('msiEnabledLabel') as HTMLElement).textContent = this.msiConfig.enabled ? 'Sí' : 'No';
    }

    // Enable/disable all plans when MSI is toggled
    this.msiPlans.forEach(plan => {
      plan.enabled = this.msiConfig!.enabled;
    });

    // Re-render content to update plan states
    this.renderContent();
  }

  onPlanChange(index: number) {
    // Individual plan toggle logic
    const plan = this.msiPlans[index];
    const planToggle = document.getElementById(`plan_${plan.months}`) as HTMLInputElement;
    if (planToggle) {
      plan.enabled = planToggle.checked;
      const amountInput = document.getElementById(`amount_${plan.months}`) as HTMLInputElement;
      if (amountInput) {
        amountInput.disabled = !plan.enabled || !this.msiConfig!.enabled;
        if (!plan.enabled) {
          amountInput.value = '0';
          plan.min_amount = 0;
        }
      }
    }
  }

  saveConfig() {
    // Get values from DOM instead of form
    const enabledUpdates = this.msiPlans
      .filter(plan => plan.enabled)
      .map(plan => {
        const amountInput = document.getElementById(`amount_${plan.months}`) as HTMLInputElement;
        const amount = amountInput ? parseFloat(amountInput.value) || 0 : plan.min_amount;
        return {
          months: plan.months,
          min_amount: amount
        };
      });

    // Include disabled plans with 0 amount to ensure they are properly disabled
    const disabledUpdates = this.msiPlans
      .filter(plan => !plan.enabled)
      .map(plan => ({
        months: plan.months,
        min_amount: 0
      }));

    const allUpdates = [...enabledUpdates, ...disabledUpdates];

    this.loading = true;
    this.error = null;
    this.updateDebugInfo();

    this.msiConfigService.updateMsiConfig(this.idMerchant, allUpdates).subscribe({
      next: () => {
        this.snackBar.open('Configuración MSI guardada exitosamente', 'Cerrar', {
          duration: 3000
        });

        // Reload config to get latest data
        this.loadConfig();
      },
      error: (error) => {
        console.error('Error saving MSI config:', error);
        this.error = 'Error al guardar configuración MSI';
        this.snackBar.open('Error al guardar configuración', 'Cerrar', {
          duration: 3000
        });
        this.loading = false;
        this.updateDebugInfo();
      }
    });
  }
}

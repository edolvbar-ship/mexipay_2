import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
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
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '@/app/services/auth/auth.service';

interface MsiTemplate {
  id_template: number;
  name: string;
  description: string;
  plans: Array<{
    months: number;
    min_amount: number;
    enabled: boolean;
  }>;
  national_only: boolean;
  token_q6_supported: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  merchants_count: number;
}

interface Merchant {
  id_merchant: number;
  name_merchant: string;
  active: number;
  deleted_at?: string;
}

interface TemplateFormData {
  name: string;
  description: string;
  plans: Array<{
    months: number;
    min_amount: number;
    enabled: boolean;
  }>;
  national_only: boolean;
  token_q6_supported: boolean;
  is_default: boolean;
  is_active: boolean;
}

@Component({
  selector: 'app-msi-templates',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
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
    MatTooltipModule,
    MatDividerModule
  ],
  template: `
    <div class="msi-templates">
      <div class="templates-header">
        <h1>Plantillas MSI</h1>
        <p>Gestión de plantillas de configuración para Meses Sin Intereses</p>
      </div>

      <div class="actions-bar">
        <button mat-raised-button color="primary" (click)="openCreateTemplateDialog()" class="toolbar-btn">
          ➕ Nueva Plantilla
        </button>
        <button mat-button (click)="loadTemplates()" class="toolbar-btn">
          🔄 Actualizar
        </button>
        <button mat-button (click)="exportTemplates()" class="toolbar-btn">
          📥 Exportar
        </button>
      </div>

      <mat-tab-group>
        <!-- Templates List Tab -->
        <mat-tab label="Plantillas">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Plantillas de Configuración MSI</mat-card-title>
                <mat-card-subtitle>{{ templates.length }} plantillas disponibles</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="table-container">
                  <table mat-table [dataSource]="dataSource" matSort>
                    <!-- ID Column -->
                    <ng-container matColumnDef="id_template">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>ID</th>
                      <td mat-cell *matCellDef="let template">{{ template.id_template }}</td>
                    </ng-container>

                    <!-- Name Column -->
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre</th>
                      <td mat-cell *matCellDef="let template">
                        <div class="template-name">
                          <span class="name">{{ template.name }}</span>
                          <mat-chip *ngIf="template.is_default" color="primary">
                            Por Defecto
                          </mat-chip>
                        </div>
                      </td>
                    </ng-container>

                    <!-- Description Column -->
                    <ng-container matColumnDef="description">
                      <th mat-header-cell *matHeaderCellDef>Descripción</th>
                      <td mat-cell *matCellDef="let template">
                        <span class="description">{{ template.description }}</span>
                      </td>
                    </ng-container>

                    <!-- Plans Column -->
                    <ng-container matColumnDef="plans">
                      <th mat-header-cell *matHeaderCellDef>Planes</th>
                      <td mat-cell *matCellDef="let template">
                        <div class="plans-chips">
                          <mat-chip-listbox>
                            <mat-chip *ngFor="let plan of template.plans"
                                     [color]="plan.enabled ? 'primary' : 'default'">
                              {{ plan.months }}M
                            </mat-chip>
                          </mat-chip-listbox>
                        </div>
                      </td>
                    </ng-container>

                    <!-- Merchants Column -->
                    <ng-container matColumnDef="merchants_count">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Comercios</th>
                      <td mat-cell *matCellDef="let template">
                        <span class="merchants-count">{{ template.merchants_count }}</span>
                      </td>
                    </ng-container>

                    <!-- Status Column -->
                    <ng-container matColumnDef="is_active">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>Estado</th>
                      <td mat-cell *matCellDef="let template">
                        <mat-slide-toggle
                          [(ngModel)]="template.is_active"
                          (change)="toggleTemplateStatus(template)"
                          color="primary">
                          {{ template.is_active ? 'Activa' : 'Inactiva' }}
                        </mat-slide-toggle>
                      </td>
                    </ng-container>

                    <!-- Actions Column -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Acciones</th>
                      <td mat-cell *matCellDef="let template">
                        <button mat-button color="primary" (click)="editTemplate(template)" class="action-btn">
                          ✏️ Editar
                        </button>
                        <button mat-button color="accent" (click)="duplicateTemplate(template)" class="action-btn">
                          📋 Duplicar
                        </button>
                        <button mat-button color="warn" (click)="deleteTemplate(template)" class="action-btn">
                          🗑️ Eliminar
                        </button>
                        <button mat-button
                                color="primary"
                                (click)="applyTemplate(template)"
                                [disabled]="!template.is_active"
                                class="action-btn">
                          🚀 Aplicar
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
        </mat-tab>

        <!-- Template Editor Tab -->
        <mat-tab label="Editor de Plantilla" [disabled]="!selectedTemplate">
          <div class="tab-content" *ngIf="selectedTemplate">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Editar Plantilla: {{ selectedTemplate && selectedTemplate.name ? selectedTemplate.name : '' }}</mat-card-title>
                <mat-card-subtitle>ID: {{ selectedTemplate && selectedTemplate.id_template ? selectedTemplate.id_template : '' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <form [formGroup]="templateForm" class="template-form">
                  <!-- Basic Information -->
                  <div class="form-section">
                    <h3>Información Básica</h3>
                    <div class="form-grid">
                      <mat-form-field appearance="outline">
                        <mat-label>Nombre de Plantilla</mat-label>
                        <input matInput formControlName="name" placeholder="Ej: Estándar Retail">
                        <mat-hint>Nombre descriptivo para identificar la plantilla</mat-hint>
                      </mat-form-field>

                      <mat-form-field appearance="outline">
                        <mat-label>Descripción</mat-label>
                        <textarea matInput formControlName="description" placeholder="Descripción detallada de la plantilla"></textarea>
                        <mat-hint>Explica el propósito y casos de uso de esta plantilla</mat-hint>
                      </mat-form-field>
                    </div>
                  </div>

                  <!-- MSI Configuration -->
                  <div class="form-section">
                    <h3>Configuración MSI</h3>
                    <div class="config-grid">
                      <div class="config-item">
                        <mat-slide-toggle formControlName="national_only">
                          Solo Tarjetas Nacionales
                        </mat-slide-toggle>
                        <p class="config-description">Limitar MSI a tarjetas mexicanas</p>
                      </div>

                      <div class="config-item">
                        <mat-slide-toggle formControlName="token_q6_supported">
                          Token Q6 Soportado
                        </mat-slide-toggle>
                        <p class="config-description">Habilitar Token Q6 para procesamiento</p>
                      </div>

                      <div class="config-item">
                        <mat-slide-toggle formControlName="is_default">
                          Plantilla por Defecto
                        </mat-slide-toggle>
                        <p class="config-description">Usar como plantilla predeterminada</p>
                      </div>

                      <div class="config-item">
                        <mat-slide-toggle formControlName="is_active">
                          Plantilla Activa
                        </mat-slide-toggle>
                        <p class="config-description">Disponible para uso</p>
                      </div>
                    </div>
                  </div>

                  <!-- Plans Configuration -->
                  <div class="form-section">
                    <h3>Planes MSI</h3>
                    <div class="plans-editor">
                      <div *ngFor="let plan of templatePlans; let i = index" class="plan-item">
                        <div class="plan-header">
                          <mat-slide-toggle
                            [(ngModel)]="plan.enabled"
                            (change)="onPlanChange(i)">
                            {{ plan.months }} Meses
                          </mat-slide-toggle>
                          <div class="plan-actions">
                            <button mat-icon-button color="primary" (click)="editPlanAmount(i)" matTooltip="Editar monto">
                              <mat-icon>edit</mat-icon>
                            </button>
                          </div>
                        </div>
                        <div class="plan-content" [class.disabled]="!plan.enabled">
                          <mat-form-field appearance="outline">
                            <mat-label>Monto Mínimo</mat-label>
                            <input matInput
                                   type="number"
                                   [(ngModel)]="plan.min_amount"
                                   [disabled]="!plan.enabled"
                                   placeholder="0.00">
                            <span matPrefix>$</span>
                            <mat-hint>Monto mínimo para {{ plan.months }} meses</mat-hint>
                          </mat-form-field>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Form Actions -->
                  <div class="form-actions">
                    <button mat-button type="button" (click)="cancelEdit()">
                      Cancelar
                    </button>
                    <button mat-raised-button color="primary" type="button"
                            (click)="saveTemplate()"
                            [disabled]="!templateForm.valid || saving">
                      <mat-icon>save</mat-icon>
                      Guardar Plantilla
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Template Application Tab -->
        <mat-tab label="Aplicación Masiva">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Aplicar Plantilla a Comercios</mat-card-title>
                <mat-card-subtitle>Asignar plantilla a múltiples comercios</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="application-form">
                  <mat-form-field appearance="outline">
                    <mat-label>Seleccionar Plantilla</mat-label>
                    <mat-select [(ngModel)]="selectedTemplateForApplication">
                      <mat-option *ngFor="let template of activeTemplates" [value]="template">
                        {{ template.name }} - {{ template.description }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Comercios Destino</mat-label>
                    <mat-select multiple [(ngModel)]="selectedMerchants">
                      <mat-option *ngFor="let merchant of availableMerchants" [value]="merchant">
                        {{ merchant.name_merchant }} (ID: {{ merchant.id_merchant }})
                      </mat-option>
                    </mat-select>
                    <mat-hint>Seleccione los comercios que recibirán esta plantilla</mat-hint>
                  </mat-form-field>

                  <div class="application-options">
                    <mat-checkbox [(ngModel)]="overwriteExisting">
                      Sobrescribir configuración MSI existente
                    </mat-checkbox>
                    <mat-checkbox [(ngModel)]="sendNotification">
                      Enviar notificación a comercios
                    </mat-checkbox>
                  </div>

                  <div class="application-actions">
                    <!-- Debug info -->
                    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                      Debug: Template={{selectedTemplateForApplication?.name || 'none'}},
                      Merchants={{selectedMerchants.length || 0}},
                      Button Disabled={{!selectedTemplateForApplication || selectedMerchants.length === 0}}
                    </div>

                    <button mat-raised-button color="primary"
                            (click)="applyTemplateToMerchants()"
                            class="toolbar-btn">
                      🚀 Aplicar Plantilla
                    </button>
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
  styleUrls: ['./msi-templates.component.css']
})
export class MsiTemplatesComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = [
    'id_template',
    'name',
    'description',
    'plans',
    'merchants_count',
    'is_active',
    'actions'
  ];
  dataSource = new MatTableDataSource<MsiTemplate>();
  templates: MsiTemplate[] = [];

  selectedTemplate: MsiTemplate | null = null;
  templateForm!: FormGroup;
  templatePlans: Array<{months: number; min_amount: number; enabled: boolean}> = [];

  selectedTemplateForApplication: MsiTemplate | null = null;
  selectedMerchants: Merchant[] = [];
  availableMerchants: any[] = [];

  overwriteExisting = false;
  sendNotification = false;

  loading = false;
  saving = false;

  private destroy$ = new Subject<void>();
  private apiUrl = '/api/msi-templates';
  private merchantsApiUrl = '/api/merchants';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeForm();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`
    });
  }

  ngOnInit() {
    this.initializeForm();
    this.loadTemplates();
    this.loadAvailableMerchants();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.templateForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]],
      national_only: [true],
      token_q6_supported: [true],
      is_default: [false],
      is_active: [true]
    });
  }

  loadTemplates(): void {
    this.loading = true;

    this.http.get<MsiTemplate[]>(this.apiUrl, { headers: this.getAuthHeaders() }).subscribe({
      next: (templates) => {
        this.templates = templates;
        this.dataSource.data = this.templates;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.snackBar.open('Error al cargar plantillas', 'Cerrar', {
          duration: 3000
        });
        this.loading = false;
      }
    });
  }


  private loadAvailableMerchants(): void {
    // Load active merchants for MSI template application
    this.http.get<any>(`${this.merchantsApiUrl}?active=true&limit=100`, { headers: this.getAuthHeaders() }).subscribe({
      next: (response) => {
        // Handle different response structures
        let merchants = [];

        if (response.data && Array.isArray(response.data)) {
          // Response has data property with array
          merchants = response.data;
        } else if (Array.isArray(response)) {
          // Response is directly an array
          merchants = response;
        } else if (response.merchants && Array.isArray(response.merchants)) {
          // Response has merchants property
          merchants = response.merchants;
        }

        // Filter to only include merchants with id_merchant and name_merchant
        this.availableMerchants = merchants.filter((m: Merchant) =>
          m.id_merchant && m.name_merchant && m.active === 1 && !m.deleted_at
        );

        console.log('Loaded merchants for MSI templates:', this.availableMerchants.length);

        if (this.availableMerchants.length === 0) {
          console.log('No merchants found');
          this.snackBar.open('No hay comercios disponibles para asignar plantillas MSI', 'Cerrar', {
            duration: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error loading merchants:', error);
        this.snackBar.open('Error al cargar los comercios. Por favor intente nuevamente.', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }


  get activeTemplates(): MsiTemplate[] {
    return this.templates.filter(template => template.is_active);
  }

  openCreateTemplateDialog(): void {
    this.selectedTemplate = null;
    this.initializeForm();
    this.templatePlans = this.initializeDefaultPlans();

    // Switch to editor tab
    // This would be implemented with tab selection logic
  }

  editTemplate(template: MsiTemplate): void {
    this.selectedTemplate = template;
    this.templateForm.patchValue({
      name: template.name,
      description: template.description,
      national_only: template.national_only,
      token_q6_supported: template.token_q6_supported,
      is_default: template.is_default,
      is_active: template.is_active
    });

    // Safely handle template plans
    this.templatePlans = template.plans && Array.isArray(template.plans)
      ? [...template.plans]
      : this.initializeDefaultPlans();
  }

  private initializeDefaultPlans(): Array<{months: number; min_amount: number; enabled: boolean}> {
    return [
      { months: 3, min_amount: 301, enabled: true },
      { months: 6, min_amount: 601, enabled: true },
      { months: 9, min_amount: 901, enabled: false },
      { months: 12, min_amount: 1201, enabled: true },
      { months: 18, min_amount: 1801, enabled: false }
    ];
  }

  onPlanChange(index: number): void {
    const plan = this.templatePlans[index];
    if (!plan.enabled) {
      plan.min_amount = 0;
    }
  }

  editPlanAmount(index: number): void {
    // This would open a dialog to edit the plan amount
    console.log('Edit plan amount:', this.templatePlans[index]);
  }

  saveTemplate(): void {
    if (!this.templateForm.valid) {
      this.snackBar.open('Por favor complete todos los campos requeridos', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.saving = true;

    // Simulate saving template
    setTimeout(() => {
      const templateData = this.templateForm.value;
      templateData.plans = this.templatePlans;

      if (this.selectedTemplate) {
        // Update existing template
        Object.assign(this.selectedTemplate, templateData);
        this.selectedTemplate.updated_at = new Date();
      } else {
        // Create new template
        const newTemplate: MsiTemplate = {
          id_template: Math.max(...this.templates.map(t => t.id_template)) + 1,
          ...templateData,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: 'admin',
          merchants_count: 0
        };
        this.templates.push(newTemplate);
        this.dataSource.data = [...this.templates];
      }

      this.saving = false;
      this.snackBar.open('Plantilla guardada exitosamente', 'Cerrar', {
        duration: 3000
      });

      this.loadTemplates();
    }, 1500);
  }

  cancelEdit(): void {
    this.selectedTemplate = null;
    this.templateForm.reset();
  }

  duplicateTemplate(template: MsiTemplate): void {
    const duplicatedTemplate: MsiTemplate = {
      ...template,
      id_template: Math.max(...this.templates.map(t => t.id_template)) + 1,
      name: `${template.name} (Copia)`,
      description: `${template.description} - Copia`,
      is_default: false,
      created_at: new Date(),
      updated_at: new Date(),
      merchants_count: 0
    };

    this.templates.push(duplicatedTemplate);
    this.dataSource.data = [...this.templates];

    this.snackBar.open('Plantilla duplicada exitosamente', 'Cerrar', {
      duration: 3000
    });
  }

  deleteTemplate(template: MsiTemplate): void {
    if (template.is_default) {
      this.snackBar.open('No se puede eliminar la plantilla por defecto', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    if (confirm(`¿Está seguro de eliminar la plantilla "${template.name}"?`)) {
      this.templates = this.templates.filter(t => t.id_template !== template.id_template);
      this.dataSource.data = this.templates;

      this.snackBar.open('Plantilla eliminada exitosamente', 'Cerrar', {
        duration: 3000
      });
    }
  }

  toggleTemplateStatus(template: MsiTemplate): void {
    template.is_active = !template.is_active;
    this.snackBar.open(
      `Plantilla ${template.is_active ? 'activada' : 'desactivada'} exitosamente`,
      'Cerrar',
      { duration: 3000 }
    );
  }

  applyTemplate(template: MsiTemplate): void {
    this.selectedTemplateForApplication = template;
    // Switch to application tab
    console.log('Apply template:', template);
  }

  applyTemplateToMerchants(): void {
    if (!this.selectedTemplateForApplication || this.selectedMerchants.length === 0) {
      this.snackBar.open('Seleccione una plantilla y al menos un comercio', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    // Show loading state
    this.loading = true;

    // Prepare the request data
    const applicationData = {
      template_id: this.selectedTemplateForApplication.id_template,
      merchant_ids: this.selectedMerchants.map(m => m.id_merchant),
      overwrite_existing: this.overwriteExisting,
      send_notification: this.sendNotification
    };

    console.log('Applying template to merchants:', applicationData);

    // Call the backend API
    this.http.post(`/api/msi-templates/${this.selectedTemplateForApplication.id_template}/apply`, applicationData, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (response: any) => {
          console.log('Template application response:', response);
          this.snackBar.open(
            `✅ Plantilla "${this.selectedTemplateForApplication?.name}" aplicada a ${this.selectedMerchants.length} comercios`,
            'Cerrar',
            { duration: 5000 }
          );

          // Reset form
          this.selectedTemplateForApplication = null;
          this.selectedMerchants = [];
          this.overwriteExisting = false;
          this.sendNotification = false;
          this.loading = false;

          // Refresh templates data to show updated merchant counts
          this.loadTemplates();
        },
        error: (error) => {
          console.error('Error applying template:', error);
          this.snackBar.open(
            `❌ Error al aplicar plantilla: ${error.error?.message || 'Error desconocido'}`,
            'Cerrar',
            { duration: 5000 }
          );
          this.loading = false;
        }
      });
  }

  exportTemplates(): void {
    // Simulate export functionality
    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `msi-templates-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.snackBar.open('Plantillas exportadas exitosamente', 'Cerrar', {
      duration: 3000
    });
  }

  private generateCSVContent(): string {
    const headers = ['ID', 'Nombre', 'Descripción', 'Planes', 'Nacional Solo', 'Token Q6', 'Por Defecto', 'Activa', 'Comercios'];
    const rows = this.templates.map(template => [
      template.id_template,
      template.name,
      template.description,
      template.plans.filter(p => p.enabled).map(p => `${p.months}M`).join(','),
      template.national_only ? 'Sí' : 'No',
      template.token_q6_supported ? 'Sí' : 'No',
      template.is_default ? 'Sí' : 'No',
      template.is_active ? 'Sí' : 'No',
      template.merchants_count
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

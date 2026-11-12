import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MsiBinRangesComponent } from '../../components/msi-bin-ranges/msi-bin-ranges.component';
import { MsiSystemConfigComponent } from '../../components/msi-system-config/msi-system-config.component';

@Component({
  selector: 'app-msi-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MsiBinRangesComponent,
    MsiSystemConfigComponent
  ],
  template: `
    <div class="msi-management-container">
      <div class="header">
        <h1>
          <mat-icon>credit_card</mat-icon>
          Administración MSI
        </h1>
        <p>Gestión de Meses Sin Intereses a nivel del sistema</p>
      </div>

      <mat-tab-group class="msi-tabs">
        <!-- BIN Ranges Management -->
        <mat-tab label="Rangos BIN">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="section-header">
                <h2>Rangos BIN Nacionales</h2>
                <p>Configurar rangos de BIN para tarjetas mexicanas elegibles para MSI</p>
              </div>
              <app-msi-bin-ranges></app-msi-bin-ranges>
            </div>
          </ng-template>
        </mat-tab>

        <!-- System Configuration -->
        <mat-tab label="Configuración del Sistema">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="section-header">
                <h2>Configuración Global MSI</h2>
                <p>Configuración general del sistema MSI y políticas</p>
              </div>
              <app-msi-system-config></app-msi-system-config>
            </div>
          </ng-template>
        </mat-tab>

        <!-- Monitoring -->
        <mat-tab label="Monitoreo">
          <ng-template matTabContent>
            <div class="tab-content">
              <div class="section-header">
                <h2>Monitoreo MSI</h2>
                <p>Estadísticas y uso del sistema MSI</p>
              </div>
              <div class="monitoring-grid">
                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Rangos BIN Activos</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-number">16</div>
                    <div class="stat-label">Rangos configurados</div>
                  </mat-card-content>
                </mat-card>

                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Comercios con MSI</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-number">1</div>
                    <div class="stat-label">Comercios configurados</div>
                  </mat-card-content>
                </mat-card>

                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Operaciones Habilitadas</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-number">19</div>
                    <div class="stat-label">Operaciones con MSI activo</div>
                  </mat-card-content>
                </mat-card>

                <mat-card class="stat-card">
                  <mat-card-header>
                    <mat-card-title>Tasa de Uso MSI</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="stat-number">0%</div>
                    <div class="stat-label">Transacciones usando MSI</div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .msi-management-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
    }

    .header h1 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 0 0 8px 0;
      color: #1976d2;
      font-size: 2rem;
    }

    .header p {
      margin: 0;
      color: #666;
      font-size: 1.1rem;
    }

    .msi-tabs {
      margin-top: 24px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .section-header {
      margin-bottom: 24px;
    }

    .section-header h2 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 1.5rem;
    }

    .section-header p {
      margin: 0;
      color: #666;
    }

    .monitoring-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }

    .stat-card {
      text-align: center;
    }

    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #1976d2;
      margin: 16px 0 8px 0;
    }

    .stat-label {
      color: #666;
      font-size: 0.9rem;
    }

    ::ng-deep .mat-tab-body-wrapper {
      padding: 20px;
    }

    ::ng-deep .mat-mdc-tab.mdc-tab {
      text-transform: uppercase;
      font-weight: 500;
    }
  `]
})
export class MsiManagementComponent implements OnInit {
  constructor() { }

  ngOnInit(): void {
    // Load MSI system statistics
    this.loadStatistics();
  }

  private loadStatistics(): void {
    // TODO: Implement statistics loading
    console.log('Loading MSI system statistics...');
  }
}

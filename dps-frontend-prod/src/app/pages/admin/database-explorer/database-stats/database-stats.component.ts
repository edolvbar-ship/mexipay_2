import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';

import { DatabaseExplorerService, DatabaseStats, TableStats } from '@/app/services/admin/database-explorer/database-explorer.service';

@Component({
  selector: 'app-database-stats',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    CardModule,
    ProgressBarModule,
    TableModule,
    ChartModule,
    ButtonModule,
    SkeletonModule,
    ProgressSpinnerModule,
    TooltipModule,
    TagModule
  ],
  template: `
    <p-dialog
      [visible]="visible"
      header="Estadísticas de Base de Datos"
      [modal]="true"
      [style]="{width: '600px', maxWidth: '95vw', height: '90vh'}"
      [maximizable]="true"
      [closable]="true"
      (onHide)="close.emit()"
      (visibleChange)="visible = $event">
      <ng-template pTemplate="header">
        <div class="flex align-items-center justify-content-between w-full">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-chart-bar text-primary text-xl"></i>
            <span class="text-xl font-bold">Estadísticas de Base de Datos</span>
          </div>
        </div>
      </ng-template>
      
      <div class="stats-content" style="height: calc(90vh - 120px); overflow-y: auto;">
        <!-- Loading State -->
        <div *ngIf="loading" class="flex flex-column align-items-center justify-content-center p-5">
          <p-progressSpinner [style]="{width: '50px', height: '50px'}"></p-progressSpinner>
          <span class="mt-3 text-color-secondary">Cargando estadísticas...</span>
        </div>

        <ng-container *ngIf="!loading && stats">
          <!-- Summary Cards -->
          <div class="grid mb-3">
            <div class="col-6">
              <p-card styleClass="h-full">
                <div class="flex flex-column align-items-center">
                  <i class="pi pi-table text-primary text-3xl mb-2"></i>
                  <span class="text-3xl font-bold">{{ stats.totalTables | number }}</span>
                  <span class="text-sm text-color-secondary">Tablas</span>
                </div>
              </p-card>
            </div>
            
            <div class="col-6">
              <p-card styleClass="h-full">
                <div class="flex flex-column align-items-center">
                  <i class="pi pi-database text-success text-3xl mb-2"></i>
                  <span class="text-3xl font-bold">{{ stats.totalRecords | number }}</span>
                  <span class="text-sm text-color-secondary">Registros Totales</span>
                </div>
              </p-card>
            </div>
            
            <div class="col-12 mt-2">
              <p-card>
                <div class="flex justify-content-between align-items-center mb-2">
                  <span class="font-medium">Tamaño Total de la Base de Datos</span>
                  <span class="text-2xl font-bold text-primary">{{ formatSize(stats.totalSizeMB) }}</span>
                </div>
                <p-progressBar 
                  [value]="100" 
                  [showValue]="false"
                  styleClass="h-2rem"
                  [style]="{'background': 'linear-gradient(90deg, var(--primary-400) 0%, var(--primary-600) 100%)'}">
                </p-progressBar>
                <div class="flex justify-content-between mt-2 text-sm text-color-secondary">
                  <span>Datos: {{ formatSize(stats.dataSizeMB) }}</span>
                  <span>Índices: {{ formatSize(stats.indexSizeMB) }}</span>
                </div>
              </p-card>
            </div>
          </div>

          <!-- Charts -->
          <div class="mb-3">
            <p-card header="Distribución de Registros por Tabla">
              <p-chart 
                type="bar" 
                [data]="recordsChartData" 
                [options]="chartOptions"
                height="200px">
              </p-chart>
            </p-card>
          </div>

          <div class="mb-3">
            <p-card header="Uso de Almacenamiento por Tabla">
              <p-chart 
                type="doughnut" 
                [data]="sizeChartData" 
                [options]="sizeChartOptions"
                height="200px">
              </p-chart>
            </p-card>
          </div>

          <!-- Table Details -->
          <p-card header="Detalle por Tabla" styleClass="mb-3">
            <p-table 
              [value]="stats.tableStats" 
              [paginator]="true" 
              [rows]="10"
              [rowsPerPageOptions]="[10, 25, 50]"
              [scrollable]="true"
              scrollHeight="300px"
              styleClass="p-datatable-sm">
              
              <ng-template pTemplate="header">
                <tr>
                  <th pSortableColumn="tableName">
                    Tabla
                    <p-sortIcon field="tableName"></p-sortIcon>
                  </th>
                  <th pSortableColumn="recordCount" style="width: 120px">
                    Registros
                    <p-sortIcon field="recordCount"></p-sortIcon>
                  </th>
                  <th pSortableColumn="sizeMB" style="width: 120px">
                    Tamaño
                    <p-sortIcon field="sizeMB"></p-sortIcon>
                  </th>
                  <th style="width: 150px">Progreso</th>
                </tr>
              </ng-template>
              
              <ng-template pTemplate="body" let-table>
                <tr>
                  <td>
                    <div class="flex align-items-center gap-2">
                      <i class="pi pi-table text-primary"></i>
                      <span class="font-medium">{{ table.tableName }}</span>
                    </div>
                  </td>
                  <td class="text-right">
                    <span class="font-bold">{{ table.recordCount | number }}</span>
                  </td>
                  <td class="text-right">
                    <span>{{ formatSize(table.sizeMB) }}</span>
                  </td>
                  <td>
                    <p-progressBar 
                      [value]="getTableSizePercentage(table.sizeMB)" 
                      [showValue]="false"
                      styleClass="h-1rem">
                    </p-progressBar>
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>
        </ng-container>
      </div>
    </p-dialog>
  `,
  styles: [`
    .stats-content {
      padding: 0.5rem;
    }

    :host ::ng-deep .p-card {
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    :host ::ng-deep .p-card .p-card-header {
      padding: 1rem;
      font-weight: 600;
      border-bottom: 1px solid var(--surface-200);
    }

    :host ::ng-deep .p-progressbar {
      border-radius: 4px;
      overflow: hidden;
    }

    :host ::ng-deep .p-progressbar-determinate .p-progressbar-value {
      background: var(--primary-500);
    }

    :host ::ng-deep .p-chart {
      canvas {
        max-height: 200px;
      }
    }
  `]
})
export class DatabaseStatsComponent implements OnInit {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();

  stats: DatabaseStats | null = null;
  loading = false;

  recordsChartData: any;
  sizeChartData: any;
  
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: number) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          }
        }
      }
    }
  };

  sizeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          font: {
            size: 10
          }
        }
      }
    }
  };

  private destroy$ = new Subject<void>();

  constructor(private dbService: DatabaseExplorerService) {}

  ngOnInit(): void {
    if (this.visible) {
      this.loadStats();
    }
  }

  ngOnChanges(changes: any): void {
    if (changes.visible && changes.visible.currentValue) {
      this.loadStats();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStats(): void {
    this.loading = true;
    
    this.dbService.getDatabaseStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.loading = false;
          this.generateCharts();
        },
        error: (err) => {
          console.error('Error loading stats:', err);
          this.loading = false;
        }
      });
  }

  generateCharts(): void {
    if (!this.stats) return;

    // Get top 20 tables by record count for the bar chart
    const topTables = [...this.stats.tableStats]
      .sort((a, b) => b.recordCount - a.recordCount)
      .slice(0, 20);

    this.recordsChartData = {
      labels: topTables.map(t => t.tableName),
      datasets: [{
        label: 'Registros',
        data: topTables.map(t => t.recordCount),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
      }]
    };

    // Get top 10 tables by size for the doughnut chart
    const topSizeTables = [...this.stats.tableStats]
      .sort((a, b) => b.sizeMB - a.sizeMB)
      .slice(0, 10);

    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    this.sizeChartData = {
      labels: topSizeTables.map(t => t.tableName),
      datasets: [{
        data: topSizeTables.map(t => t.sizeMB),
        backgroundColor: colors,
        borderWidth: 0
      }]
    };
  }

  formatSize(sizeMB: number): string {
    if (sizeMB >= 1024) {
      return (sizeMB / 1024).toFixed(2) + ' GB';
    } else if (sizeMB >= 1) {
      return sizeMB.toFixed(2) + ' MB';
    } else {
      return (sizeMB * 1024).toFixed(0) + ' KB';
    }
  }

  getTableSizePercentage(tableSizeMB: number): number {
    if (!this.stats || this.stats.totalSizeMB === 0) return 0;
    return Math.round((tableSizeMB / this.stats.totalSizeMB) * 100);
  }
}

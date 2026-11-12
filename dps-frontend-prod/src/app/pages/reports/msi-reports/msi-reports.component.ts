import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { AuthService } from '@/app/services/auth/auth.service';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartConfiguration, ChartType, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-msi-reports',
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
    MatCardModule,
    MatTabsModule,
    MatSelectModule,
    MatOptionModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTooltipModule,
    NgChartsModule
  ],
  template: `
    <div class="msi-reports">
      <div class="reports-header">
        <h1>Reportes MSI</h1>
        <p>Análisis y estadísticas de Meses Sin Intereses</p>
      </div>

      <div class="filters-section">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Filtros de Reporte</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="filterForm" class="filter-form">
              <div class="filter-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Fecha Inicio</mat-label>
                  <input matInput
                         [matDatepicker]="startDatePicker"
                         formControlName="startDate">
                  <mat-datepicker-toggle matSuffix [for]="startDatePicker"></mat-datepicker-toggle>
                  <mat-datepicker #startDatePicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Fecha Fin</mat-label>
                  <input matInput
                         [matDatepicker]="endDatePicker"
                         formControlName="endDate">
                  <mat-datepicker-toggle matSuffix [for]="endDatePicker"></mat-datepicker-toggle>
                  <mat-datepicker #endDatePicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tipo de Reporte</mat-label>
                  <mat-select formControlName="reportType">
                    <mat-option value="usage">Uso de MSI</mat-option>
                    <mat-option value="transactions">Transacciones MSI</mat-option>
                    <mat-option value="merchants">Comercios con MSI</mat-option>
                    <mat-option value="bins">Análisis de BINs</mat-option>
                    <mat-option value="performance">Rendimiento MSI</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Agrupar por</mat-label>
                  <mat-select formControlName="groupBy">
                    <mat-option value="day">Día</mat-option>
                    <mat-option value="week">Semana</mat-option>
                    <mat-option value="month">Mes</mat-option>
                    <mat-option value="merchant">Comercio</mat-option>
                    <mat-option value="operation">Operación</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="filter-actions">
                <button mat-button (click)="resetFilters()">
                  <mat-icon>refresh</mat-icon>
                  Restablecer
                </button>
                <button mat-raised-button color="primary" (click)="generateReport()">
                  <mat-icon>bar_chart</mat-icon>
                  Generar Reporte
                </button>
                <button mat-raised-button color="accent" (click)="exportReport()" [disabled]="!reportData">
                  <mat-icon>download</mat-icon>
                  Exportar
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="report-content" *ngIf="reportData">
        <mat-tab-group>
          <!-- Summary Tab -->
          <mat-tab label="Resumen">
            <div class="summary-grid">
              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>Total Transacciones MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-value">{{ reportData.summary.totalMsiTransactions | number:'1.0-0' }}</div>
                  <div class="summary-label">transacciones</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>Monto Total MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-value">{{ reportData && reportData.summary ? (reportData.summary.totalMsiAmount | number:'1.0-0') : 0 }}</div>
                  <div class="summary-label">procesado</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>Comercios Activos</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-value">{{ reportData.summary.activeMerchants }}</div>
                  <div class="summary-label">con MSI</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>Tasa de Uso MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-value">{{ reportData.summary.msiUsageRate }}%</div>
                  <div class="summary-label">de transacciones totales</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>Plan Más Popular</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-value">{{ reportData.summary.mostPopularPlan }} meses</div>
                  <div class="summary-label">frecuencia</div>
                </mat-card-content>
              </mat-card>

              <mat-card class="summary-card">
                <mat-card-header>
                  <mat-card-title>Monto Promedio</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="summary-value">{{ reportData && reportData.summary ? (reportData.summary.averageAmount | number:'1.0-0') : 0 }}</div>
                  <div class="summary-label">por transacción MSI</div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Charts Tab -->
          <mat-tab label="Gráficos">
            <div class="charts-grid">
              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Tendencia de Uso MSI</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <canvas baseChart
                         [data]="lineChartData"
                         [options]="lineChartOptions"
                         [type]="lineChartType">
                  </canvas>
                </mat-card-content>
              </mat-card>

              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Distribución por Planes</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <canvas baseChart
                         [data]="doughnutChartData"
                         [options]="doughnutChartOptions"
                         [type]="doughnutChartType">
                  </canvas>
                </mat-card-content>
              </mat-card>

              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Transacciones por Comercio</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <canvas baseChart
                         [data]="barChartData"
                         [options]="barChartOptions"
                         [type]="barChartType">
                  </canvas>
                </mat-card-content>
              </mat-card>

              <mat-card class="chart-card">
                <mat-card-header>
                  <mat-card-title>Rendimiento por Operación</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <canvas baseChart
                         [data]="radarChartData"
                         [options]="radarChartOptions"
                         [type]="radarChartType">
                  </canvas>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Detailed Data Tab -->
          <mat-tab label="Datos Detallados">
            <div class="data-table">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Transacciones MSI Detalladas</mat-card-title>
                  <mat-card-subtitle>{{ reportData.detailedData.length }} registros</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="table-container">
                    <table class="detailed-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Comercio</th>
                          <th>Operación</th>
                          <th>Plan MSI</th>
                          <th>Monto</th>
                          <th>Estado</th>
                          <th>Tarjeta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let transaction of reportData.detailedData">
                          <td>{{ formatDate(transaction.date) }}</td>
                          <td>{{ transaction.merchantName }}</td>
                          <td>{{ transaction.operationName }}</td>
                          <td>
                            <mat-chip color="primary">
                              {{ transaction.msiPlan }} meses
                            </mat-chip>
                          </td>
                          <td>{{ transaction.amount | number:'1.2-2' }}</td>
                          <td>
                            <mat-chip [color]="transaction.status === 'approved' ? 'primary' : 'warn'">
                              {{ transaction.status === 'approved' ? 'Aprobada' : 'Rechazada' }}
                            </mat-chip>
                          </td>
                          <td>{{ maskCardNumber(transaction.cardNumber) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Analytics Tab -->
          <mat-tab label="Análisis Avanzado">
            <div class="analytics-grid">
              <mat-card class="analytics-card">
                <mat-card-header>
                  <mat-card-title>Análisis de BINs</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="bin-analysis">
                    <div *ngFor="let bin of reportData.analytics.binAnalysis" class="bin-item">
                      <div class="bin-range">{{ bin.range }}</div>
                      <div class="bin-stats">
                        <span class="bin-count">{{ bin.transactionCount }} transacciones</span>
                        <span class="bin-amount">{{ bin.totalAmount | number:'1.0-0' }}</span>
                      </div>
                      <div class="bin-percentage">{{ bin.percentage }}%</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-card class="analytics-card">
                <mat-card-header>
                  <mat-card-title>Rendimiento por Hora</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="hourly-performance">
                    <div *ngFor="let hour of reportData.analytics.hourlyPerformance" class="hour-item">
                      <div class="hour-label">{{ hour.hour }}:00</div>
                      <div class="hour-bar">
                        <div class="hour-fill" [style.width.%]="hour.percentage"></div>
                      </div>
                      <div class="hour-count">{{ hour.transactionCount }}</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-card class="analytics-card">
                <mat-card-header>
                  <mat-card-title>Tendencia de Rechazos</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="rejection-trends">
                    <div *ngFor="let reason of reportData.analytics.rejectionReasons" class="rejection-item">
                      <div class="reason-label">{{ reason.reason }}</div>
                      <div class="reason-count">{{ reason.count }}</div>
                      <div class="reason-percentage">{{ reason.percentage }}%</div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-card class="analytics-card">
                <mat-card-header>
                  <mat-card-title>Métricas de Rendimiento</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="performance-metrics">
                    <div class="metric-item">
                      <span class="metric-label">Tiempo Promedio de Respuesta</span>
                      <span class="metric-value">{{ reportData.analytics.performance.averageResponseTime }}ms</span>
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">Tasa de Aprobación</span>
                      <span class="metric-value">{{ reportData.analytics.performance.approvalRate }}%</span>
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">Error Rate</span>
                      <span class="metric-value">{{ reportData.analytics.performance.errorRate }}%</span>
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">Throughput</span>
                      <span class="metric-value">{{ reportData.analytics.performance.throughput }}/min</span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-overlay">
        <mat-spinner></mat-spinner>
      </div>
    </div>
  `,
  styleUrls: ['./msi-reports.component.css']
})
export class MsiReportsComponent implements OnInit, OnDestroy {
  filterForm!: FormGroup;
  reportData: any = null;
  loading = false;

  // Chart configurations
  lineChartData: ChartData<'line'> = {
    datasets: [],
    labels: []
  };
  lineChartOptions: any = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Tendencia MSI' }
    }
  };
  lineChartType: ChartType = 'line';

  doughnutChartData: ChartData<'doughnut'> = {
    datasets: [],
    labels: []
  };
  doughnutChartOptions: any = {
    responsive: true,
    plugins: {
      legend: { position: 'right' }
    }
  };
  doughnutChartType: ChartType = 'doughnut';

  barChartData: ChartData<'bar'> = {
    datasets: [],
    labels: []
  };
  barChartOptions: any = {
    responsive: true,
    plugins: {
      legend: { position: 'top' }
    },
    scales: {
      x: {},
      y: { beginAtZero: true }
    }
  };
  barChartType: ChartType = 'bar';

  radarChartData: ChartData<'radar'> = {
    datasets: [],
    labels: []
  };
  radarChartOptions: any = {
    responsive: true,
    plugins: {
      legend: { position: 'top' }
    }
  };
  radarChartType: ChartType = 'radar';

  private destroy$ = new Subject<void>();
  private apiUrl = '/api/msi-reports';
  private merchantsApiUrl = '/api/merchants';

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeForm();
    this.initializeCharts();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`
    });
  }

  ngOnInit(): void {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.filterForm.patchValue({
      startDate,
      endDate,
      reportType: 'usage',
      groupBy: 'day'
    });

    // Auto-generate initial report
    setTimeout(() => {
      this.generateReport();
    }, 500);
  }

  private initializeForm(): void {
    this.filterForm = this.fb.group({
      startDate: [null],
      endDate: [null],
      reportType: ['usage'],
      groupBy: ['day']
    });
  }

  private initializeCharts(): void {
    // Initialize with empty data
    this.updateChartData();
  }

  generateReport(): void {
    if (!this.filterForm.valid) {
      this.snackBar.open('Por favor complete todos los filtros', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.loading = true;

    const filterValues = this.filterForm.value;

    this.http.post<any>(`${this.apiUrl}/generate`, filterValues, { headers: this.getAuthHeaders() }).subscribe({
      next: (reportData) => {
        this.reportData = reportData;
        this.updateChartData();
        this.loading = false;

        this.snackBar.open('Reporte generado exitosamente', 'Cerrar', {
          duration: 3000
        });
      },
      error: (error) => {
        console.error('Error generating report:', error);
        this.reportData = null;
        this.updateChartData();
        this.loading = false;

        this.snackBar.open('Error al generar el reporte. Por favor intente nuevamente.', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }




  private updateChartData(): void {
    if (!this.reportData) return;

    // Update line chart with real data
    if (this.reportData.analytics?.hourlyPerformance) {
      this.lineChartData = {
        datasets: [{
          label: 'Transacciones MSI',
          data: this.reportData.analytics.hourlyPerformance.map((item: any) => item.transactions),
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          tension: 0.4
        }],
        labels: this.reportData.analytics.hourlyPerformance.map((item: any) => item.hour)
      };
    }

    // Update doughnut chart with MSI plans distribution
    if (this.reportData.analytics?.msiPlansDistribution) {
      this.doughnutChartData = {
        datasets: [{
          data: this.reportData.analytics.msiPlansDistribution.map((item: any) => item.count),
          backgroundColor: ['#1976d2', '#4caf50', '#ff9800', '#f44336', '#9c27b0']
        }],
        labels: this.reportData.analytics.msiPlansDistribution.map((item: any) => item.plan)
      };
    }

    // Update bar chart with BIN analysis
    if (this.reportData.analytics?.binAnalysis) {
      this.barChartData = {
        datasets: [{
          label: 'Transacciones',
          data: this.reportData.analytics.binAnalysis.map((item: any) => item.transactionCount),
          backgroundColor: '#1976d2'
        }],
        labels: this.reportData.analytics.binAnalysis.map((item: any) => item.range)
      };
    }

    // Update radar chart with performance metrics
    if (this.reportData.analytics?.performance) {
      const perf = this.reportData.analytics.performance;
      this.radarChartData = {
        datasets: [{
          label: 'Rendimiento',
          data: [perf.approvalRate, 100 - perf.errorRate, perf.throughput, 100 - (perf.averageResponseTime / 10), 95, 90],
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.2)'
        }],
        labels: ['Tasa Aprobación', 'Fiabilidad', 'Rendimiento', 'Velocidad', 'Disponibilidad', 'Calidad']
      };
    }
  }

  resetFilters(): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    this.filterForm.patchValue({
      startDate,
      endDate,
      reportType: 'usage',
      groupBy: 'day'
    });

    this.generateReport();
  }

  exportReport(): void {
    if (!this.reportData) return;

    // Simulate export functionality
    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `msi-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.snackBar.open('Reporte exportado exitosamente', 'Cerrar', {
      duration: 3000
    });
  }

  private generateCSVContent(): string {
    if (!this.reportData?.detailedData) {
      return '';
    }

    const headers = ['Fecha', 'Comercio', 'Operación', 'Plan MSI', 'Monto', 'Estado'];
    const rows = this.reportData.detailedData.map((transaction: any) => [
      this.formatDate(transaction.date),
      transaction.merchantName,
      transaction.operationName,
      `${transaction.msiPlan} meses`,
      transaction.amount.toFixed(2),
      transaction.status === 'approved' ? 'Aprobada' : 'Rechazada'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-MX');
  }

  maskCardNumber(cardNumber: string): string {
    return cardNumber;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

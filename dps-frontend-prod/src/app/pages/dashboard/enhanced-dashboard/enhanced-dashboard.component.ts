import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, of, forkJoin } from 'rxjs';
import { map, takeUntil, catchError, tap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartjsModule } from '@coreui/angular-chartjs';
import { CardComponent } from '@coreui/angular';
import { FormsModule } from '@angular/forms';

// Services
import { MovementsDetailService } from '@/app/services/movements/movements-detail/movements-detail.service';
import { AuthService } from '@/app/services/auth/auth.service';
import { SharedService } from '@/app/services/shared/shared.service';
import { MerchantsService } from '@/app/services/merchants/merchants.service';

// Components
import { EnhancedCalendarComponent } from '@/app/shared/components/enhanced-calendar/enhanced-calendar.component';
import { InsightsCardComponent } from '@/app/shared/components/insights-card/insights-card.component';
import { MetricCardComponent } from '@/app/shared/components/metric-card/metric-card.component';
import { QuickStatsComponent } from '@/app/shared/components/quick-stats/quick-stats.component';
import { LoadingSkeletonComponent } from '@/app/shared/components/loading-skeleton/loading-skeleton.component';
import { DateRange } from '@/app/shared/interfaces/types-interface';

// Types
interface DashboardMetrics {
  totalTransactions: number;
  totalAmount: number;
  approvalRate: number;
  avgTransactionValue: number;
  peakHour: string;
  mostUsedCardType: string;
  topMerchant: string;
  // New fields for proper msg_type handling
  netAmount: number; // Sum(0200 approved) - Sum(0220/0420 approved)
  originalTransactions: number; // Count of 0200 transactions
  reversalTransactions: number; // Count of 0220/0420 transactions
}

interface PerformanceInsight {
  title: string;
  description: string;
  value: string | number;
  change: number;
  icon: string;
  color: string;
  trend: 'up' | 'down' | 'neutral';
}

interface TimeSeriesData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
  }[];
}

@Component({
  selector: 'app-enhanced-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartjsModule,
    CardComponent,
    EnhancedCalendarComponent,
    InsightsCardComponent,
    MetricCardComponent,
    QuickStatsComponent,
    LoadingSkeletonComponent
  ],
  templateUrl: './enhanced-dashboard.component.html',
  styleUrls: ['./enhanced-dashboard.component.css'],
  providers: [DatePipe]
})
export class EnhancedDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('mainChart') mainChartRef!: ElementRef;
  @ViewChild('insightsPanel') insightsPanelRef!: ElementRef;

  // Date range
  selectedDateRange: DateRange = this.getDefaultDateRange();
  quickDatePresets = [
    { label: 'Hoy', days: 0 },
    { label: 'Ayer', days: 1 },
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días', days: 30 },
    { label: 'Mes actual', days: -1 },
    { label: 'Mes anterior', days: -2 }
  ];

  // Loading states
  isLoading: boolean = false;
  isInitialLoad: boolean = true;
  isLoadingChart: boolean = false;
  isLoadingMetrics: boolean = false;
  isLoadingInsights: boolean = false;

  // Data
  metrics: DashboardMetrics = this.getEmptyMetrics();
  performanceInsights: PerformanceInsight[] = [];
  timeSeriesData: TimeSeriesData = this.getEmptyTimeSeriesData();
  realTimeUpdates: any[] = [];

  // Charts
  mainChart: Chart | null = null;
  chartConfig: ChartConfiguration = this.getChartConfig();

  // Cache for instant loading
  private dataCache = new Map<string, any>();
  private lastSuccessfulRange: DateRange | null = null;
  private cachedMetrics: DashboardMetrics | null = null;

  // Performance tracking
  private loadStartTime: number = 0;
  private destroy$ = new Subject<void>();
  private chartInitialized = false;

  // Merchant information
  merchantInfo: any = null;
  isLoadingMerchant: boolean = false;

  constructor(
    private dashboardService: MovementsDetailService,
    private authService: AuthService,
    private sharedService: SharedService,
    private merchantsService: MerchantsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe
  ) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.initializeDashboard();
    this.setupRealTimeUpdates();
    this.preloadCommonData();
    this.loadMerchantInfo();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.mainChart) {
      this.mainChart.destroy();
    }
  }

  // ==================== INITIALIZATION ====================
  
  /**
   * Load merchant information for current user
   */
  loadMerchantInfo(): void {
    const userInfo = this.authService.userInfo;
    if (!userInfo?.idClient) {
      console.warn('No client ID found for user');
      return;
    }

    this.isLoadingMerchant = true;
    this.merchantsService.getMerchants().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (merchants) => {
        // Find merchant that belongs to current user's client
        const userMerchant = merchants.find(merchant => 
          merchant.Id === userInfo.idClient || 
          merchant.Cliente === userInfo.name + ' ' + userInfo.last_name
        );
        
        if (userMerchant) {
          this.merchantInfo = userMerchant;
          console.log('Enhanced Dashboard - Merchant info loaded:', this.merchantInfo);
        } else {
          console.warn('Enhanced Dashboard - No merchant found for user client:', userInfo.idClient);
        }
        this.isLoadingMerchant = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Enhanced Dashboard - Error loading merchant info:', error);
        this.isLoadingMerchant = false;
        this.cdr.detectChanges();
      }
    });
  }

  private initializeDashboard(): void {
    this.isInitialLoad = true;

    // Show skeleton immediately
    this.showLoadingStates();

    // Load data with cache-first strategy
    this.loadDashboardDataWithCache();

    // Mark initial load complete after 300ms minimum (for perceived performance)
    setTimeout(() => {
      this.isInitialLoad = false;
      this.cdr.detectChanges();
    }, 300);
  }

  private setupRealTimeUpdates(): void {
    // Simulate real-time updates every 30 seconds
    setInterval(() => {
      if (!this.isLoading && this.lastSuccessfulRange) {
        this.updateRealTimeData();
      }
    }, 30000);
  }

  private preloadCommonData(): void {
    // Preload today's data in background
    const todayRange = this.getDateRangeForPreset('Hoy');
    this.loadAndCacheData(todayRange, 'today_cache');

    // Preload yesterday's data
    const yesterdayRange = this.getDateRangeForPreset('Ayer');
    setTimeout(() => {
      this.loadAndCacheData(yesterdayRange, 'yesterday_cache');
    }, 1000);
  }

  // ==================== DATE HANDLING ====================
  private getDefaultDateRange(): DateRange {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days by default

    return {
      initial: this.formatDateForAPI(startDate),
      final: this.formatDateForAPI(endDate)
    };
  }

  private getDateRangeForPreset(presetLabel: string): DateRange {
    const endDate = new Date();
    const startDate = new Date();
    const preset = this.quickDatePresets.find(p => p.label === presetLabel);

    if (preset) {
      if (preset.days === -1) { // Current month
        startDate.setDate(1);
      } else if (preset.days === -2) { // Previous month
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(1);
        endDate.setDate(0); // Last day of previous month
      } else {
        startDate.setDate(endDate.getDate() - preset.days);
      }
    }

    return {
      initial: this.formatDateForAPI(startDate),
      final: this.formatDateForAPI(endDate)
    };
  }

  onDateRangeChange(range: DateRange): void {
    this.selectedDateRange = range;
    this.loadDashboardData();
  }

  onQuickDateSelect(presetLabel: string): void {
    const newRange = this.getDateRangeForPreset(presetLabel);
    this.selectedDateRange = newRange;
    this.loadDashboardDataWithCache();
  }

  // ==================== DATA LOADING & CACHE ====================
  private loadDashboardDataWithCache(): void {
    const cacheKey = this.getCacheKey(this.selectedDateRange);

    // Check cache first
    if (this.dataCache.has(cacheKey)) {
      console.log('Loading from cache:', cacheKey);
      const cachedData = this.dataCache.get(cacheKey);
      this.applyCachedData(cachedData);
      this.loadFreshDataInBackground(cacheKey);
    } else {
      this.loadDashboardData();
    }
  }

  private loadDashboardData(): void {
    this.loadStartTime = Date.now();
    this.showLoadingStates();

    // Parallel loading with forkJoin for better performance
    forkJoin({
      summary: this.loadSummaryData(),
      trends: this.loadTrendData(),
      insights: this.loadInsightsData()
    })
    .pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading dashboard data:', error);
        this.handleLoadError(error);
        return of(null);
      })
    )
    .subscribe(results => {
      if (results) {
        this.processDashboardData(results);
        this.cacheCurrentData();
        this.hideLoadingStates();
        this.trackPerformance();
      }
    });
  }

  private loadAndCacheData(range: DateRange, cacheKey: string): void {
    // Load in background and cache
    this.dashboardService.getSummary({ fechas: `${range.initial} ${range.final}` })
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.dataCache.set(cacheKey, data);
      });
  }

  private applyCachedData(cachedData: any): void {
    // Apply cached data immediately for instant response
    this.metrics = this.extractMetricsFromData(cachedData);
    this.performanceInsights = this.generateInsights(cachedData);

    // Show success feedback
    this.showSuccessFeedback('Datos cargados desde caché');
  }

  private loadFreshDataInBackground(cacheKey: string): void {
    // Load fresh data in background
    this.dashboardService.getSummary({
      fechas: `${this.selectedDateRange.initial} ${this.selectedDateRange.final}`
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe(freshData => {
      // Update cache
      this.dataCache.set(cacheKey, freshData);

      // Update UI if there are significant changes
      this.updateIfSignificantChanges(freshData);

      // Show subtle update indicator
      this.showUpdateIndicator();
    });
  }

  // ==================== DATA PROCESSING ====================
  private processDashboardData(results: any): void {
    const { summary, trends, insights } = results;

    // Update metrics
    this.metrics = this.extractMetricsFromData(summary);

    // Generate insights
    this.performanceInsights = this.generateInsights(summary);

    // Update time series data
    this.timeSeriesData = this.processTimeSeriesData(summary, trends);

    // Update chart
    this.updateChart();

    // Store successful range
    this.lastSuccessfulRange = { ...this.selectedDateRange };
    this.cachedMetrics = { ...this.metrics };

    // Show success feedback
    this.showSuccessFeedback('Datos actualizados');
  }

  private extractMetricsFromData(data: any): DashboardMetrics {
    // CRITICAL FIX: Only count 0200 transactions for approval metrics
    const approved0200 = (data.total_aprob || []).filter((t: any) => 
      t.msg_type === '0200' || (!t.msg_type && t.tipo_operacion?.name === 'VENTA')
    );
    const rejected0200 = (data.total_rech || []).filter((t: any) => 
      t.msg_type === '0200' || (!t.msg_type && t.tipo_operacion?.name === 'VENTA')
    );
    
    // Count all reversals (0220, 0420) for net calculation
    const allReversals = (data.total_aprob || []).filter((t: any) => 
      t.msg_type === '0220' || t.msg_type === '0420'
    );

    const totalApproved = approved0200.length;
    const totalRejected = rejected0200.length;
    const totalTransactions = totalApproved + totalRejected;
    const approvalRate = totalTransactions > 0 ? (totalApproved / totalTransactions) * 100 : 0;

    // Calculate total amount from approved 0200 transactions only
    let totalAmount = 0;
    if (approved0200) {
      approved0200.forEach((transaction: any) => {
        const amount = parseFloat(transaction.amount) || 0;
        totalAmount += amount;
      });
    }

    // Calculate reversal amounts for net calculation
    let reversalAmount = 0;
    if (allReversals) {
      allReversals.forEach((transaction: any) => {
        const amount = parseFloat(transaction.amount) || 0;
        reversalAmount += amount;
      });
    }

    // Net amount = approved 0200 - reversal amounts
    const netAmount = totalAmount - reversalAmount;

    const avgTransactionValue = totalApproved > 0 ? totalAmount / totalApproved : 0;

    // Find peak hour (simplified)
    const peakHour = this.calculatePeakHour(approved0200);

    // Find most used card type
    const mostUsedCardType = this.findMostUsedCardType(data.marca_t);

    // Find top merchant (simplified)
    const topMerchant = this.findTopMerchant(approved0200);

    console.log(`📊 Metrics with msg_type filtering:`, {
      totalApproved,
      totalRejected,
      totalTransactions,
      approvalRate,
      totalAmount,
      reversalAmount,
      netAmount,
      originalTransactions: approved0200.length + rejected0200.length,
      reversalTransactions: allReversals.length
    });

    return {
      totalTransactions,
      totalAmount,
      approvalRate: parseFloat(approvalRate.toFixed(2)),
      avgTransactionValue: parseFloat(avgTransactionValue.toFixed(2)),
      peakHour,
      mostUsedCardType,
      topMerchant,
      // New fields for proper msg_type handling
      netAmount: parseFloat(netAmount.toFixed(2)),
      originalTransactions: approved0200.length + rejected0200.length,
      reversalTransactions: allReversals.length
    };
  }

  private generateInsights(data: any): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];

    // CRITICAL FIX: Only count 0200 transactions for insights
    const approved0200 = (data.total_aprob || []).filter((t: any) => 
      t.msg_type === '0200' || (!t.msg_type && t.tipo_operacion?.name === 'VENTA')
    );
    const rejected0200 = (data.total_rech || []).filter((t: any) => 
      t.msg_type === '0200' || (!t.msg_type && t.tipo_operacion?.name === 'VENTA')
    );

    // Approval rate insight
    const totalApproved = approved0200.length;
    const totalRejected = rejected0200.length;
    const totalTransactions = totalApproved + totalRejected;
    const approvalRate = totalTransactions > 0 ? (totalApproved / totalTransactions) * 100 : 0;
    const hasData = totalTransactions > 0;

    insights.push({
      title: 'Tasa de Aprobación',
      description: 'Porcentaje de transacciones exitosas (solo 0200)',
      value: hasData ? `${approvalRate.toFixed(1)}%` : 'N/A',
      change: hasData ? (approvalRate > 85 ? 5.2 : -2.3) : 0,
      icon: hasData ? (approvalRate > 85 ? 'trending_up' : 'trending_down') : 'trending_flat',
      color: hasData ? (approvalRate > 85 ? 'success' : 'warning') : 'secondary',
      trend: hasData ? (approvalRate > 85 ? 'up' : 'down') : 'neutral'
    });

    // Volume insight
    const avgTransactions = totalTransactions / 7; // Assuming 7-day range
    insights.push({
      title: 'Volumen Diario',
      description: 'Transacciones promedio por día (solo 0200)',
      value: hasData ? avgTransactions.toFixed(0) : '0',
      change: hasData ? 12.5 : 0,
      icon: hasData ? 'show_chart' : 'trending_flat',
      color: hasData ? 'info' : 'secondary',
      trend: hasData ? 'up' : 'neutral'
    });

    // Value insight - use net amount instead of total
    let totalAmount = 0;
    let reversalAmount = 0;
    
    if (approved0200) {
      approved0200.forEach((t: any) => {
        totalAmount += parseFloat(t.amount) || 0;
      });
    }
    
    // Count reversals for net calculation
    const allReversals = (data.total_aprob || []).filter((t: any) => 
      t.msg_type === '0220' || t.msg_type === '0420'
    );
    
    if (allReversals) {
      allReversals.forEach((t: any) => {
        reversalAmount += parseFloat(t.amount) || 0;
      });
    }
    
    const netAmount = totalAmount - reversalAmount;
    const avgValue = totalApproved > 0 ? netAmount / totalApproved : 0;
    
    insights.push({
      title: 'Valor Neto Promedio',
      description: 'Ticket promedio neto (0200 - reversales)',
      value: hasData ? `$${avgValue.toFixed(2)}` : 'N/A',
      change: hasData ? 3.8 : 0,
      icon: hasData ? 'attach_money' : 'trending_flat',
      color: hasData ? 'primary' : 'secondary',
      trend: hasData ? 'up' : 'neutral'
    });

    // Peak performance insight
    insights.push({
      title: 'Hora Pico',
      description: 'Momento de mayor actividad (0200)',
      value: hasData ? this.calculatePeakHour(approved0200) : 'N/A',
      change: 0,
      icon: hasData ? 'schedule' : 'trending_flat',
      color: hasData ? 'secondary' : 'secondary',
      trend: 'neutral'
    });

    // Net amount insight
    insights.push({
      title: 'Monto Neto',
      description: 'Total neto (aprobadas 0200 - reversales)',
      value: hasData ? `$${netAmount.toFixed(2)}` : '$0.00',
      change: hasData ? 8.3 : 0,
      icon: hasData ? 'account_balance' : 'trending_flat',
      color: hasData && netAmount > 0 ? 'success' : 'secondary',
      trend: hasData && netAmount > 0 ? 'up' : 'neutral'
    });

    return insights;
  }

  // ==================== CHART HANDLING ====================
  private updateChart(): void {
    if (!this.mainChartRef?.nativeElement) {
      setTimeout(() => this.updateChart(), 100);
      return;
    }

    const ctx = this.mainChartRef.nativeElement.getContext('2d');

    if (this.mainChart) {
      this.mainChart.destroy();
    }

    this.mainChart = new Chart(ctx, this.chartConfig);
    this.chartInitialized = true;
  }

  private getChartConfig(): ChartConfiguration {
    return {
      type: 'line',
      data: {
        labels: this.timeSeriesData.labels,
        datasets: this.timeSeriesData.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `$${value}`
            }
          }
        },
        animation: {
          duration: 750, // Fast but smooth animations
          easing: 'easeOutQuart'
        }
      }
    };
  }

  // ==================== HELPER METHODS ====================
  private formatDateForAPI(date: Date): string {
    // Ensure local timezone handling
    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
    return localDate.toISOString();
  }

  private getCacheKey(range: DateRange): string {
    return `${range.initial}_${range.final}`;
  }

  private calculatePeakHour(transactions: any[]): string {
    if (!transactions || transactions.length === 0) return 'N/A';

    const hourCounts: number[] = new Array(24).fill(0);

    transactions.forEach(t => {
      if (t.creation_date) {
        const date = new Date(t.creation_date);
        const hour = date.getHours();
        hourCounts[hour]++;
      }
    });

    const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));
    return `${peakHourIndex}:00 - ${peakHourIndex + 1}:00`;
  }

  private findMostUsedCardType(cardTypes: any[]): string {
    if (!cardTypes || cardTypes.length === 0) return 'N/A';

    const sorted = [...cardTypes].sort((a, b) => b.count - a.count);
    return sorted[0]?.name || 'N/A';
  }

  private findTopMerchant(transactions: any[]): string {
    // Simplified - in real app, you'd extract merchant info
    return transactions?.length > 0 ? 'Principal' : 'N/A';
  }

  private processTimeSeriesData(summary: any, trends: any): TimeSeriesData {
    const labels = summary.label || [];
    
    // Use pre-aggregated data from backend (fechas_aprob, fechas_rech)
    // These are already grouped by date and filtered by msg_type
    let approvedData: number[];
    let rejectedData: number[];
    
    try {
      approvedData = JSON.parse(summary.fechas_aprob || '[]');
    } catch (e) {
      console.warn('Error parsing fechas_aprob, using empty array:', e);
      approvedData = [];
    }
    
    try {
      rejectedData = JSON.parse(summary.fechas_rech || '[]');
    } catch (e) {
      console.warn('Error parsing fechas_rech, using empty array:', e);
      rejectedData = [];
    }

    return {
      labels,
      datasets: [
        {
          label: 'Aprobadas (0200)',
          data: approvedData,
          borderColor: '#0C4772',
          backgroundColor: 'rgba(12, 71, 114, 0.1)',
          tension: 0.4
        },
        {
          label: 'Rechazadas (0200)',
          data: rejectedData,
          borderColor: '#a90825',
          backgroundColor: 'rgba(169, 8, 37, 0.1)',
          tension: 0.4
        }
      ]
    };
  }

  // ==================== UI FEEDBACK METHODS ====================
  private showLoadingStates(): void {
    this.isLoading = true;
    this.isLoadingChart = true;
    this.isLoadingMetrics = true;
    this.isLoadingInsights = true;
    this.cdr.detectChanges();
  }

  private hideLoadingStates(): void {
    this.isLoading = false;
    this.isLoadingChart = false;
    this.isLoadingMetrics = false;
    this.isLoadingInsights = false;
    this.cdr.detectChanges();
  }

  private showSuccessFeedback(message: string): void {
    // Could integrate with toast service
    console.log(message);
  }

  private showUpdateIndicator(): void {
    // Visual feedback for background updates
    const panel = this.insightsPanelRef?.nativeElement;
    if (panel) {
      panel.classList.add('updated');
      setTimeout(() => panel.classList.remove('updated'), 1000);
    }
  }

  private trackPerformance(): void {
    const loadTime = Date.now() - this.loadStartTime;
    console.log(`Dashboard loaded in ${loadTime}ms`);

    // Log performance metrics
    if (loadTime < 1000) {
      console.log('✓ Super-fast load!');
    } else if (loadTime < 3000) {
      console.log('✓ Fast load');
    }
  }

  private handleLoadError(error: any): void {
    console.error('Dashboard load error:', error);
    this.hideLoadingStates();

    // Fallback to cached data if available
    if (this.cachedMetrics) {
      this.metrics = this.cachedMetrics;
      this.showSuccessFeedback('Usando datos en caché debido a error');
    }
  }

  private updateIfSignificantChanges(newData: any): void {
    const newMetrics = this.extractMetricsFromData(newData);
    const oldMetrics = this.metrics;

    // Check if changes are significant (more than 10%)
    const hasSignificantChange =
      Math.abs(newMetrics.totalTransactions - oldMetrics.totalTransactions) / oldMetrics.totalTransactions > 0.1 ||
      Math.abs(newMetrics.approvalRate - oldMetrics.approvalRate) > 5;

    if (hasSignificantChange) {
      this.metrics = newMetrics;
      this.performanceInsights = this.generateInsights(newData);
      this.cdr.detectChanges();
    }
  }

  private updateRealTimeData(): void {
    // Simulate real-time updates
    const randomUpdate = {
      id: Date.now(),
      type: 'transaction',
      amount: Math.random() * 1000,
      timestamp: new Date().toISOString(),
      status: Math.random() > 0.1 ? 'approved' : 'rejected'
    };

    this.realTimeUpdates.unshift(randomUpdate);
    if (this.realTimeUpdates.length > 5) {
      this.realTimeUpdates.pop();
    }

    // Update metrics slightly
    if (randomUpdate.status === 'approved') {
      this.metrics.totalTransactions++;
      this.metrics.totalAmount += randomUpdate.amount;
      this.metrics.avgTransactionValue = this.metrics.totalAmount / this.metrics.totalTransactions;
    }

    this.cdr.detectChanges();
  }

  // ==================== GETTERS FOR EMPTY STATES ====================
  private getEmptyMetrics(): DashboardMetrics {
    return {
      totalTransactions: 0,
      totalAmount: 0,
      approvalRate: 0,
      avgTransactionValue: 0,
      peakHour: '--:--',
      mostUsedCardType: '--',
      topMerchant: '--',
      // New fields for proper msg_type handling
      netAmount: 0,
      originalTransactions: 0,
      reversalTransactions: 0
    };
  }

  private getEmptyTimeSeriesData(): TimeSeriesData {
    return {
      labels: [],
      datasets: [
        {
          label: 'Aprobadas',
          data: [],
          borderColor: '#0C4772',
          backgroundColor: 'rgba(12, 71, 114, 0.1)',
          tension: 0.4
        },
        {
          label: 'Rechazadas',
          data: [],
          borderColor: '#a90825',
          backgroundColor: 'rgba(169, 8, 37, 0.1)',
          tension: 0.4
        }
      ]
    };
  }

  // ==================== SERVICE CALLS ====================
  private loadSummaryData(): Observable<any> {
    return this.dashboardService.getSummary({
      fechas: `${this.selectedDateRange.initial} ${this.selectedDateRange.final}`
    }).pipe(
      catchError(error => {
        console.error('Error loading summary:', error);
        return of({
          total_aprob: [],
          total_rech: [],
          marca_t: [],
          label: []
        });
      })
    );
  }

  private loadTrendData(): Observable<any> {
    // In a real app, this would be a separate API call
    return of({
      trends: [],
      comparison: {}
    });
  }

  private loadInsightsData(): Observable<any> {
    // In a real app, this would be a separate API call
    return of({
      anomalies: [],
      recommendations: []
    });
  }

  private cacheCurrentData(): void {
    const cacheKey = this.getCacheKey(this.selectedDateRange);
    this.dataCache.set(cacheKey, {
      metrics: this.metrics,
      insights: this.performanceInsights,
      timestamp: Date.now()
    });
  }
}

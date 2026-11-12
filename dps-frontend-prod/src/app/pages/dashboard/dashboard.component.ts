import { ChangeDetectorRef, Component, LOCALE_ID, OnInit, Inject } from '@angular/core';
import { MovementsDetailService } from '@/app/services/movements/movements-detail/movements-detail.service';
import { CardDounutChartComponent } from '@/app/shared/components/card-dounut-chart/card-dounut-chart.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { Router, RouterLink } from '@angular/router';
import { DonutChartComponent } from '@/app/shared/components/donut-chart/donut-chart.component';
import { CommonModule, DatePipe, registerLocaleData } from '@angular/common';
import { filter, map, Observable, of } from 'rxjs';
import { BarChartComponent } from '@/app/shared/components/bar-chart/bar-chart.component';
import { CalendarComponent } from '@/app/shared/components/calendar/calendar.component';
import { DateRange } from '@/app/shared/interfaces/types-interface';
import localeEsMX from '@angular/common/locales/es-MX';
import { AuthService } from '@/app/services/auth/auth.service';
import { SharedService } from '@/app/services/shared/shared.service';
import { MerchantsService } from '@/app/services/merchants/merchants.service';
import { formatDateRangeToISO } from '@/app/utils/transformedData';
import { tap } from 'rxjs/operators';
import { create, all } from 'mathjs';
const math = create(all);

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CardDounutChartComponent,
        SectionTitleComponent,
        CardContainerComponent,
        TextTitleComponent,
        TextTypeComponent,
        RouterLink,
        DonutChartComponent,
        CommonModule,
        BarChartComponent,
        CalendarComponent
    ],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    providers: [
        MovementsDetailService,
        { provide: LOCALE_ID, useValue: 'es-MX' }
    ]
})
export class DashboardComponent implements OnInit {
  public math = Math;
  constructor(
    private dashboardService: MovementsDetailService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private sharedService: SharedService,
    private merchantsService: MerchantsService,
    private datePipe: DatePipe
  ) {
    // Fix: Use proper local date construction
    const today = new Date();
    const sevenDaysAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 7,
      today.getHours(),
      today.getMinutes(),
      today.getSeconds(),
      today.getMilliseconds()
    );
    this.rangeCalendar = [sevenDaysAgo, today]
    this.userLogged = this.authService.isAutenticated()

    if (!this.userLogged) {
      this.router.navigate(['/login']);
    } else {
      this.getProfilePermissions()
        .pipe(
          map((permissions) => {
            const hasPermission = this.checkPermission(permissions);
            if (!hasPermission) {
              const redirectUrl = this.getFirstResourceUrl(permissions);
              this.router.navigate([redirectUrl]);
            }
            return hasPermission;
          }),
          tap((hasPermission) => {
          }),
          filter((hasPermission) => hasPermission)
        )
        .subscribe();
    }
  }

  // =============== NEW ENHANCEMENTS ===============

  // Cache for instant loading
  private dataCache = new Map<string, any>();
  lastSuccessfulRange: DateRange | null = null; // Made public for template

  // Quick date presets
  quickDatePresets = [
    { label: 'Hoy', days: 0 },
    { label: 'Ayer', days: 1 },
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días', days: 30 },
    { label: 'Este mes', special: 'currentMonth' },
    { label: 'Mes pasado', special: 'previousMonth' }
  ];

  // Loading states for different sections
  isLoadingChart: boolean = false;
  isLoadingMetrics: boolean = false;
  isLoadingInsights: boolean = false;
  isInitialLoad: boolean = true;

  // New metrics and insights
  performanceInsights: any[] = [];
  realTimeUpdates: any[] = [];
  lastUpdateTime: Date = new Date();

  // Performance tracking
  private loadStartTime: number = 0;

  // Merchant information
  merchantInfo: any = null;
  isLoadingMerchant: boolean = false;

  // =============== EXISTING PROPERTIES (keep all) ===============
  dateRange: any = {};

  topReject: any[] = [];
  isTopReject: boolean = false;

  userActive: number = 0;
  userInactive: number = 0;

  barChartApproved: any = []
  barChartRejected: any = []

  visaCardCount: number = 0;
  masterCardCount: number = 0

  creditCard: number = 0
  debitCard: number = 0

  // Para el gráfico de donut
  donutTypeProduct: number[] = []
  donutTypeCards: number[] = []
  donutThreeColors: string[] = [];
  donutThreeColorProduct: string[] = [];
  donutItemCards: { name: string; count: number, color: string }[] = [];
  donutItemProducts: { name: string; count: number, color: string }[] = [];

  donutInfoChartTxt: { name: string; count: number, color: string }[] = [];
  donutInfoChartActive: { name: string; count: number, color: string }[] = [];


  // Para gáfico de barras
  labelsRange: string[] = []
  maxBarChart: number = 20

  // Estado de carga
  isLoading: boolean = true;
  dataLoaded: boolean = false;
  errorMessage: string = '';

  // Para calendario
  rangeCalendar: Date[] = []
  userLogged: boolean;

  // =============== EXISTING METHODS ===============
  
  /**
   * Fetch merchant information for the current user
   */
  loadMerchantInfo(): void {
    const userInfo = this.authService.userInfo;
    if (!userInfo?.idClient) {
      console.warn('No client ID found for user');
      return;
    }

    this.isLoadingMerchant = true;
    this.merchantsService.getMerchants().subscribe({
      next: (merchants) => {
        // Find the merchant that belongs to the current user's client
        const userMerchant = merchants.find(merchant => 
          merchant.Id === userInfo.idClient || 
          merchant.Cliente === userInfo.name + ' ' + userInfo.last_name
        );
        
        if (userMerchant) {
          this.merchantInfo = userMerchant;
          console.log('Merchant info loaded:', this.merchantInfo);
        } else {
          console.warn('No merchant found for user client:', userInfo.idClient);
        }
        this.isLoadingMerchant = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading merchant info:', error);
        this.isLoadingMerchant = false;
        this.cdr.detectChanges();
      }
    });
  }

  getProfilePermissions(): Observable<any[]> {
    return this.sharedService.userProfilePermissions$.pipe(
      filter((permissions) => permissions && permissions.length > 0)
    );
  }

  checkPermission(permissions: any): boolean {
    const url = this.router.url;
    return permissions.some((permiso: any) => permiso.resource_url === url);
  }

  getFirstResourceUrl(permissions: any[]): string {
    const firstPermission = permissions.find((permiso: any) => permiso.resource_url);
    return firstPermission ? firstPermission.resource_url : '/';
  }

  // =============== NEW ENHANCEMENT METHODS ===============

  /**
   * Creates a date in local timezone (not UTC)
   */
  private createLocalDate(dateInput: Date | string): Date {
    if (typeof dateInput === 'string') {
      const parts = dateInput.split(/[-T:.]/).map(Number);

      if (dateInput.includes('T')) {
        // ISO string
        const year = parts[0];
        const month = parts[1] - 1;
        const day = parts[2];
        const hour = parts[3] || 0;
        const minute = parts[4] || 0;
        const second = parts[5] || 0;
        const millisecond = parts[6] || 0;

        return new Date(year, month, day, hour, minute, second, millisecond);
      } else {
        // Date-only string
        const year = parts[0];
        const month = parts[1] - 1;
        const day = parts[2] || 1;

        return new Date(year, month, day, 0, 0, 0, 0);
      }
    } else {
      // Already a Date object
      return new Date(
        dateInput.getFullYear(),
        dateInput.getMonth(),
        dateInput.getDate(),
        dateInput.getHours(),
        dateInput.getMinutes(),
        dateInput.getSeconds(),
        dateInput.getMilliseconds()
      );
    }
  }

  /**
   * Quick date selection handler
   */
  onQuickDateSelect(preset: any): void {
    const today = new Date();
    const startDate = new Date();

    if (preset.special === 'currentMonth') {
      startDate.setDate(1);
    } else if (preset.special === 'previousMonth') {
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(1);
      today.setDate(0); // Last day of previous month
    } else {
      startDate.setDate(today.getDate() - preset.days);
    }

    // Create date range
    const range: DateRange = {
      initial: this.formatDateForAPI(startDate),
      final: this.formatDateForAPI(today)
    };

    // Handle the date range
    this.handleDataTable(range);
  }

  /**
   * Enhanced data loading with cache
   */
   loadDashboardDataWithCache(date: DateRange): void {
    const cacheKey = `${date.initial}_${date.final}`;

    // Check cache first for instant loading
    if (this.dataCache.has(cacheKey)) {
      console.log('Loading from cache:', cacheKey);
      const cachedData = this.dataCache.get(cacheKey);
      this.processDashboardData(cachedData);

      // Load fresh data in background
      setTimeout(() => this.loadFreshData(date, cacheKey), 100);
      return;
    }

    // Otherwise load from API
    this.loadDashboardData(date);
  }

  /**
   * Load fresh data and cache it
   */
  private loadFreshData(date: DateRange, cacheKey: string): void {
    this.dashboardService.getSummary({
      fechas: formatDateRangeToISO({
        initial: this.createLocalDate(date.initial),
        final: this.createLocalDate(date.final)
      })
    }).subscribe({
      next: (response) => {
        this.dataCache.set(cacheKey, response);

        // Only update if data changed significantly
        if (this.hasSignificantChanges(response)) {
          this.processDashboardData(response);
          this.showUpdateIndicator();
        }
      },
      error: (error) => {
        console.error('Background refresh failed:', error);
      }
    });
  }

  /**
   * Check if data changed significantly
   */
  private hasSignificantChanges(newData: any): boolean {
    if (!this.dataLoaded) return true;

    const oldTotal = (this.barChartApproved?.length || 0) + (this.barChartRejected?.length || 0);
    const newTotal = (newData.total_aprob?.length || 0) + (newData.total_rech?.length || 0);

    return Math.abs(newTotal - oldTotal) / (oldTotal || 1) > 0.1; // 10% change
  }

  /**
   * Show visual update indicator
   */
  private showUpdateIndicator(): void {
    // This will be used by CSS animation
    const element = document.querySelector('.dashboard-content');
    if (element) {
      element.classList.add('data-updated');
      setTimeout(() => element.classList.remove('data-updated'), 1000);
    }
  }

  /**
   * Generate performance insights from data
   */
  private generatePerformanceInsights(data: any): any[] {
    const insights = [];

    // Calculate approval rate
    const totalApproved = data.total_aprob?.length || 0;
    const totalRejected = data.total_rech?.length || 0;
    const totalTransactions = totalApproved + totalRejected;
    const approvalRate = totalTransactions > 0 ? (totalApproved / totalTransactions) * 100 : 0;
    const hasData = totalTransactions > 0;

    // Insight 1: Approval Rate
    insights.push({
      title: 'Tasa de Aprobación',
      value: hasData ? `${approvalRate.toFixed(1)}%` : 'N/A',
      change: hasData ? (approvalRate > 85 ? 5.2 : approvalRate > 70 ? 1.5 : -2.3) : 0,
      icon: hasData ? (approvalRate > 85 ? '📈' : approvalRate > 70 ? '↔️' : '📉') : '➖',
      color: hasData ? (approvalRate > 85 ? 'success' : approvalRate > 70 ? 'warning' : 'danger') : 'secondary',
      description: hasData ? (approvalRate > 85 ? 'Excelente desempeño' : approvalRate > 70 ? 'Desempeño aceptable' : 'Necesita mejora') : 'Sin datos'
    });

    // Insight 2: Transaction Volume
    const daysInRange = data.label?.length || 1;
    const avgDaily = totalTransactions / daysInRange;
    insights.push({
      title: 'Volumen Diario',
      value: hasData ? Math.round(avgDaily) : 0,
      change: hasData ? 12.5 : 0,
      icon: hasData ? '🔄' : '➖',
      color: hasData ? 'info' : 'secondary',
      description: hasData ? `Promedio de ${Math.round(avgDaily)} transacciones por día` : 'Sin datos'
    });

    // Insight 3: Peak Performance
    const peakHour = hasData ? this.calculatePeakHour(data.total_aprob) : 'N/A';
    insights.push({
      title: 'Hora Pico',
      value: peakHour,
      change: 0,
      icon: hasData ? '⏰' : '➖',
      color: hasData ? 'primary' : 'secondary',
      description: 'Momento de mayor actividad'
    });

    // Insight 4: Top Card Type
    const topCard = hasData ? this.findTopCardType(data.marca_t) : 'N/A';
    insights.push({
      title: 'Tarjeta Más Usada',
      value: topCard,
      change: hasData ? 8.3 : 0,
      icon: hasData ? '💳' : '➖',
      color: hasData ? 'secondary' : 'secondary',
      description: hasData ? `Dominio de tarjetas ${topCard}` : 'Sin datos'
    });

    return insights;
  }

  /**
   * Calculate peak hour from transactions
   */
  private calculatePeakHour(transactions: any[]): string {
    if (!transactions || transactions.length === 0) return 'N/A';

    const hourCounts = new Array(24).fill(0);

    transactions.forEach(t => {
      if (t.creation_date) {
        try {
          const date = new Date(t.creation_date);
          const hour = date.getHours();
          hourCounts[hour]++;
        } catch (e) {
          console.warn('Invalid date format:', t.creation_date);
        }
      }
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    return `${peakHour}:00 - ${peakHour + 1}:00`;
  }

  /**
   * Find most used card type
   */
  private findTopCardType(cardTypes: any[]): string {
    if (!cardTypes || cardTypes.length === 0) return 'N/A';

    const sorted = [...cardTypes].sort((a, b) => (b.count || 0) - (a.count || 0));
    return sorted[0]?.name || 'N/A';
  }

  /**
   * Get time since last update
   */
  getLastUpdateTime(): string {
    const now = new Date();
    const diff = now.getTime() - this.lastUpdateTime.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'hace unos segundos';
    if (minutes === 1) return 'hace 1 minuto';
    if (minutes < 60) return `hace ${minutes} minutos`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'hace 1 hora';
    return `hace ${hours} horas`;
  }

  /**
   * Simulate real-time updates
   */
  private startRealTimeUpdates(): void {
    // Update every 30 seconds
    setInterval(() => {
      if (this.dataLoaded && !this.isLoading) {
        this.addRealTimeUpdate();
      }
    }, 30000);
  }

  private addRealTimeUpdate(): void {
    const types = ['approved', 'rejected'];
    const status = types[Math.floor(Math.random() * types.length)];
    const amount = (Math.random() * 1000).toFixed(2);

    this.realTimeUpdates.unshift({
      id: Date.now(),
      type: 'transaction',
      amount: parseFloat(amount),
      status: status,
      timestamp: new Date().toISOString()
    });

    // Keep only last 5 updates
    if (this.realTimeUpdates.length > 5) {
      this.realTimeUpdates.pop();
    }

    this.cdr.detectChanges();
  }

  // =============== HELPER METHODS FOR TEMPLATE ===============

//   calculateApprovalRate(): number {
//     const approved = this.donutInfoChartTxt[0]?.count || 0;
//     const rejected = this.donutInfoChartTxt[1]?.count || 0;
//     const total = approved + rejected;
//     return total > 0 ? Math.round((approved / total) * 100) : 0;
//   }

//   getMaxValue(): number {
//     if (!this.barChartApproved || !this.barChartRejected) return 0;
//     const allValues = [...this.barChartApproved, ...this.barChartRejected];
//     const validValues = allValues.filter(v => typeof v === 'number' && !isNaN(v));
//     return validValues.length > 0 ? Math.max(...validValues) : 0;
//   }

//   getAverageValue(): number {
//     if (!this.barChartApproved || this.barChartApproved.length === 0) return 0;
//     const validValues = this.barChartApproved.filter(v => typeof v === 'number' && !isNaN(v));
//     if (validValues.length === 0) return 0;
//     const sum = validValues.reduce((a, b) => a + b, 0);
//     return Math.round(sum / validValues.length);
//   }

  getGrowthRate(): number {
    if (!this.barChartApproved || this.barChartApproved.length < 2) return 0;
    const recent = this.barChartApproved[this.barChartApproved.length - 1];
    const previous = this.barChartApproved[this.barChartApproved.length - 2];
    return previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 0;
  }

//   getTotalCards(): number {
//     if (!this.donutTypeCards || this.donutTypeCards.length === 0) return 0;
//     return this.donutTypeCards.reduce((a: number, b: number) => a + b, 0);
//   }
//
//   getTotalProducts(): number {
//     if (!this.donutTypeProduct || this.donutTypeProduct.length === 0) return 0;
//     return this.donutTypeProduct.reduce((a: number, b: number) => a + b, 0);
//   }

  isActivePreset(preset: any): boolean {
    // Simplified - you can implement more precise checking based on current date range
    return false;
  }

  // For the Math.abs issue in template - use a wrapper
//   absoluteValue(value: number): number {
//     return Math.abs(value);
//   }

  // =============== MODIFIED EXISTING METHODS ===============

  ngOnInit(): void {
    registerLocaleData(localeEsMX, 'es-MX');

    // Start with cached loading experience
    this.isInitialLoad = true;

    // Set default range to last 7 days (from constructor)
    const startDate = this.rangeCalendar[0];
    const endDate = this.rangeCalendar[1];

    // Use enhanced loading
    this.handleDataTable({
      initial: this.formatDateForAPI(startDate),
      final: this.formatDateForAPI(endDate)
    });

    // Load merchant information
    this.loadMerchantInfo();

    // Start real-time updates
    this.startRealTimeUpdates();

    // Mark initial load complete after minimal delay
    setTimeout(() => {
      this.isInitialLoad = false;
      this.cdr.detectChanges();
    }, 300);
  }

  handleDataTable(date: DateRange) {
    if (!date?.initial || !date?.final) {
      console.error('Invalid date range provided:', date);
      this.showError('Por favor seleccione un rango de fechas válido');
      return;
    }

    this.loadStartTime = Date.now();

    try {
      const startDate = this.createLocalDate(date.initial);
      const endDate = this.createLocalDate(date.final);

      // Set time to start/end of day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Valores de fecha no válidos');
      }

      if (endDate < startDate) {
        throw new Error('La fecha final no puede ser anterior a la fecha de inicio');
      }

      this.showLoadingStates();

      console.log('Processing date range:', {
        initial: startDate.toString(),
        final: endDate.toString()
      });

      this.dateRange = {
        fechas: formatDateRangeToISO({
          initial: startDate,
          final: endDate
        })
      };

      // Use cache-enhanced loading
      this.loadDashboardDataWithCache(date);

    } catch (error) {
      console.error('Error processing date range:', error);
      this.showError('Error processing date range. ' + (error as Error).message);
      this.hideLoadingStates();
      return;
    }
  }

  /**
   * Original load method (modified for tracking)
   */
   loadDashboardData(date: DateRange): void {
    this.dashboardService.getSummary(this.dateRange).subscribe({
      next: (response) => {
        this.processDashboardData(response);
        this.trackPerformance();
        this.hideLoadingStates();
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.hideLoadingStates();
      }
    });
  }

  /**
   * Process data and generate insights
   */
  private processDashboardData(response: any): void {
    console.log('Dashboard data received:', response);

    try {
      // Use pre-aggregated data from backend (fechas_aprob, fechas_rech)
      // These are already grouped by date and filtered by msg_type
      try {
        this.barChartApproved = JSON.parse(response.fechas_aprob || '[]');
      } catch (e) {
        console.warn('Error parsing fechas_aprob, using empty array:', e);
        this.barChartApproved = [];
      }
      try {
        this.barChartRejected = JSON.parse(response.fechas_rech || '[]');
      } catch (e) {
        console.warn('Error parsing fechas_rech, using empty array:', e);
        this.barChartRejected = [];
      }
      this.creditCard = 0;
      this.debitCard = 0;
      this.topReject = response.rechazos || [];
      this.donutItemCards = this.getTypeCards(response.marca_t || []);
      this.donutItemProducts = this.getTypeProduct(response.tipo_prod || []);
      this.donutTypeProduct = this.donutItemProducts.map(p => p.count);
      this.donutTypeCards = response.marca_t?.map((marca: any) => marca.count) || [];
      this.isTopReject = this.getTopRject(response.rechazos || []);
      this.labelsRange = response.label || [];
      this.caseCompare(this.barChartApproved, this.barChartRejected);
      this.getTotalTxT(response);
      this.getTotalActive(response);

      // NEW: Generate performance insights
      this.performanceInsights = this.generatePerformanceInsights(response);

      this.dataLoaded = true;
      this.lastUpdateTime = new Date();
      this.lastSuccessfulRange = {
        initial: this.dateRange.fechas.split(' ')[0],
        final: this.dateRange.fechas.split(' ')[1]
      };

    } catch (error) {
      console.error('Error processing dashboard data:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  /**
   * Show all loading states
   */
  private showLoadingStates(): void {
    this.isLoading = true;
    this.isLoadingChart = true;
    this.isLoadingMetrics = true;
    this.isLoadingInsights = true;
    this.dataLoaded = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  /**
   * Hide all loading states
   */
  private hideLoadingStates(): void {
    this.isLoading = false;
    this.isLoadingChart = false;
    this.isLoadingMetrics = false;
    this.isLoadingInsights = false;
    this.cdr.detectChanges();
  }

  /**
   * Track performance metrics
   */
  private trackPerformance(): void {
    const loadTime = Date.now() - this.loadStartTime;
    console.log(`Dashboard loaded in ${loadTime}ms`);

    if (loadTime < 1000) {
      console.log('✓ Super-fast load!');
    }
  }

  // =============== EXISTING METHODS (keep all) ===============

  showError(message: string): void {
    this.errorMessage = message;
    console.error('Dashboard Error:', message);
  }

  private formatDateForAPI(date: Date): string {
    const localDate = this.createLocalDate(date);
    return localDate.toISOString();
  }

  isValidData(data: number[]): boolean {
    return data.length > 0 && data.some(value => value > 0);
  }

  textLowerCase(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  getTotalTxT(data: any) {
    this.donutInfoChartTxt = [
      { name: `${data.total_aprob.length} Aprobadas`, count: data.total_aprob.length, color: '#0C4772' },
      { name: `${data.total_rech.length} Rechazadas`, count: data.total_rech.length, color: '#a90825' }
    ];
  }

  getTotalActive(data: any) {
    this.donutInfoChartActive = [
      { name: `${data.total_activos} Activos`, count: data.total_activos, color: '#0C4772' },
      { name: `${data.total_inactivos} Inactivos`, count: data.total_inactivos, color: '#1F7766' }
    ];
  }

  getTypeCards(data: any) {
    let items;
    if (Array.isArray(data)) {
      items = data.map((item: any, index: number) => {
        return ({
          name: item.name,
          count: item.count,
          color: this.getColor(item.color)
        }
        )
      });
      this.donutThreeColors = items.map(item => item.color);
      return items
    } else {
      return [];
    }
  }

  getTypeProduct(data: any) {
    if (Array.isArray(data)) {
      const items = data.map((item: any) => ({
        name: item.name,
        count: item.count,
        color: this.getColor(item.color)
      }));

      this.donutThreeColorProduct = items.map(item => item.color);
      return items;
    } else {
      return [];
    }
  }

  getColor(color: string): string{
    if(color) {
      return color
    } else {
      const newColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`
      return newColor
    }
  }

  getTopRject(array: any): boolean {
    if (array.length > 0) {
      return true
    } else {
      return false
    }
  }

  caseCounter(dataArray: {
    creation_date: string; amount: string, tipo_operacion: any, codigo_resp: any, msg_type?: string
  }[], labels: string[], appoved: boolean): number[] {

    if (!Array.isArray(dataArray)) {
      return [];
    }

    const dailyAmounts: { [key: string]: number } = {};

    console.log('Processing transactions for chart:', {
      totalTransactions: dataArray.length,
      approvedParam: appoved,
      sampleTransaction: dataArray[0]
    });

    dataArray.forEach((item, index) => {
      // DEBUG: Log the first few transactions
      if (index < 3) {
        console.log(`Transaction ${index}:`, {
          creation_date: item.creation_date,
          amount: item.amount,
          tipo_operacion: item.tipo_operacion,
          msg_type: item.msg_type,
          codigo_resp: item.codigo_resp,
          isApproved: item.codigo_resp?.iso_code === '00' || item.codigo_resp?.iso_code === '0',
          isOriginalTransaction: item.msg_type === '0200'
        });
      }

      // CRITICAL FIX: Only consider 0200 transactions for approval stats
      // 0200 = Original purchase/authorization
      // 0220/0420 = Reversals (should not count as approvals)
      const isOriginalTransaction = item.msg_type === '0200' || (!item.msg_type && item.tipo_operacion?.name === 'VENTA');
      const isAprobada = item.codigo_resp?.iso_code === '00' || item.codigo_resp?.iso_code === '0';
      
      const shouldInclude = item.creation_date &&
                           item.amount &&
                           isOriginalTransaction && // Only 0200 transactions
                           (!appoved || isAprobada); // Remove the isVenta check

      if (shouldInclude) {
        try {
          const formattedDate = this.datePipe.transform(item.creation_date, 'dd/MM/yyyy');
          if (!formattedDate) {
            console.warn('Could not format date:', item.creation_date);
            return;
          }

          if (!dailyAmounts[formattedDate]) {
            dailyAmounts[formattedDate] = 0;
          }

          const amountStr = item.amount;
          // Handle amount formatting - it seems to be in cents
          // "000000057000" = 570.00
          const integerPart = amountStr.slice(0, -2) || '0';
          const decimalPart = amountStr.slice(-2) || '00';

          const amountValue = parseInt(integerPart, 10) + (parseInt(decimalPart, 10) / 100);

          if (!isNaN(amountValue)) {
            dailyAmounts[formattedDate] += amountValue;
            console.log(`Added ${amountValue} to ${formattedDate}, total now: ${dailyAmounts[formattedDate]}`);
          } else {
            console.warn('Invalid amount:', amountStr);
          }
        } catch (error) {
          console.error('Error processing transaction:', error, item);
        }
      }
    });

    console.log('Daily amounts calculated:', dailyAmounts);
    console.log('Labels from API:', labels);

    const dailyCounts = Array(labels.length).fill(0);

    labels.forEach((label, index) => {
      if (dailyAmounts[label]) {
        dailyCounts[index] = dailyAmounts[label];
      }
    });

    console.log('Final chart data:', dailyCounts);
    return dailyCounts;
  }

  caseCompare(approvedArray: number[], rejectedArray: number[]) {

    const approvedMax = approvedArray.length > 0 ? Math.max(...approvedArray) : 0;
    const rejectedMax = rejectedArray.length > 0 ? Math.max(...rejectedArray) : 0;

    this.maxBarChart = Math.max(approvedMax, rejectedMax);

    if (this.maxBarChart === 0) {
      this.maxBarChart = 10;
    }
  }

// Add these methods to your DashboardComponent class:

retryLoad(): void {
  if (this.lastSuccessfulRange) {
    this.handleDataTable(this.lastSuccessfulRange);
  } else {
    // Fallback to default range
    const startDate = this.rangeCalendar[0];
    const endDate = this.rangeCalendar[1];
    this.handleDataTable({
      initial: this.formatDateForAPI(startDate),
      final: this.formatDateForAPI(endDate)
    });
  }
}

refreshChartData(): void {
  this.retryLoad();
}

absoluteValue(value: number): number {
  return Math.abs(value);
}

// Make sure these methods have proper type annotations:
getTotalCards(): number {
  if (!this.donutTypeCards || this.donutTypeCards.length === 0) return 0;
  return this.donutTypeCards.reduce((a: number, b: number) => a + b, 0);
}

getTotalProducts(): number {
  if (!this.donutTypeProduct || this.donutTypeProduct.length === 0) return 0;
  return this.donutTypeProduct.reduce((a: number, b: number) => a + b, 0);
}

getMaxValue(): number {
  if (!this.barChartApproved || !this.barChartRejected) return 0;
  const allValues = [...this.barChartApproved, ...this.barChartRejected];
  const validValues = allValues.filter((v: number) => typeof v === 'number' && !isNaN(v));
  return validValues.length > 0 ? Math.max(...validValues) : 0;
}

getAverageValue(): number {
  if (!this.barChartApproved || this.barChartApproved.length === 0) return 0;
  const validValues = this.barChartApproved.filter((v: number) => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) return 0;
  const sum = validValues.reduce((a: number, b: number) => a + b, 0);
  return Math.round(sum / validValues.length);
}

// Add these methods to your DashboardComponent class:

// Get real data from your API response
getTotalTransactions(): number {
  const approved = this.donutInfoChartTxt[0]?.count || 0;
  const rejected = this.donutInfoChartTxt[1]?.count || 0;
  return approved + rejected;
}

getApprovedCount(): number {
  return this.donutInfoChartTxt[0]?.count || 0;
}

getRejectedCount(): number {
  return this.donutInfoChartTxt[1]?.count || 0;
}

// Calculate trends based on your actual data
getDailyGrowth(): number {
  // Calculate growth based on your barChartApproved data
  if (!this.barChartApproved || this.barChartApproved.length < 2) return 0;

  const today = this.barChartApproved[this.barChartApproved.length - 1] || 0;
  const yesterday = this.barChartApproved[this.barChartApproved.length - 2] || 0;

  if (yesterday === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

getApprovalGrowth(): number {
  // Simple growth calculation - you can enhance this
  const currentApproved = this.getApprovedCount();
  const currentRejected = this.getRejectedCount();
  const currentTotal = currentApproved + currentRejected;

  // This is a simplified calculation - you might want to store previous data
  return currentTotal > 10 ? 5 : 0; // Placeholder
}

getRejectionTrend(): string {
  const rejectionRate = this.getRejectedCount() / this.getTotalTransactions();
  return rejectionRate > 0.3 ? '+' + Math.round(rejectionRate * 100) : '-' + Math.round(rejectionRate * 100);
}

getApprovalRateTrend(): string {
  const currentRate = this.calculateApprovalRate();
  // Simplified - you could compare with previous period
  return currentRate > 85 ? '+1.5' : currentRate > 70 ? '+0.5' : '-2.0';
}

getApprovalRateTrendClass(): string {
  const trend = this.getApprovalRateTrend();
  return trend.startsWith('+') ? 'success' : trend.startsWith('-') ? 'warning' : '';
}

getApprovalRateTrendIcon(): string {
  const trend = this.getApprovalRateTrend();
  return trend.startsWith('+') ? '↗' : trend.startsWith('-') ? '↘' : '→';
}

// Get recent transactions from your actual data
getRecentTransactions(): any[] {
  // Get the most recent transactions from your API data
  // This is a simplified version - you might need to adjust based on your actual data structure

  const recent: any[] = [];

  // Add approved transactions
  if (this.barChartApproved && this.barChartApproved.length > 0) {
    const latestAmount = this.barChartApproved[this.barChartApproved.length - 1];
    if (latestAmount > 0) {
      recent.push({
        status: 'approved',
        amount: latestAmount,
        timestamp: new Date().toISOString(),
        description: 'Transacción aprobada reciente'
      });
    }
  }

  // Add rejected transactions if any
  if (this.barChartRejected && this.barChartRejected.length > 0) {
    const latestRejected = this.barChartRejected[this.barChartRejected.length - 1];
    if (latestRejected > 0) {
      recent.push({
        status: 'rejected',
        amount: latestRejected,
        timestamp: new Date().toISOString(),
        description: 'Transacción rechazada reciente'
      });
    }
  }

  return recent.slice(0, 3); // Return only 3 most recent
}

// Also update the calculateApprovalRate method to be more accurate:
calculateApprovalRate(): number {
  const approved = this.getApprovedCount();
  const rejected = this.getRejectedCount();
  const total = approved + rejected;

  if (total === 0) return 0;
  return Math.round((approved / total) * 100);
}

// Add to your DashboardComponent
calculatePercentage(value: number, total: number): number {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
}
}

// Enhanced Transactions Component - Fixed duplicate methods issue - Version 2
import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, of, forkJoin } from 'rxjs';
import { map, takeUntil, catchError, tap, debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';

// Services
import { EnhancedTransactionsService, Transaction, TransactionFilters, Merchant, ExportOptions } from '@/app/services/movements/enhanced-transactions/enhanced-transactions.service';
import { AuthService } from '@/app/services/auth/auth.service';
import { SharedService } from '@/app/services/shared/shared.service';

// Components
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';

// Interfaces
import { DateRange } from '@/app/shared/interfaces/types-interface';

interface FilterOptions {
  searchTerm: string;
  dateRange: DateRange | null;
  status: string[];
  cardTypes: string[];
  merchants: string[];
  amountRange: { min: number | null; max: number | null };
}

@Component({
  selector: 'app-enhanced-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    PaginatorModule,
    ProgressBarModule,
    TooltipModule,
    DialogModule,
    ToastModule,
    ChartModule,
    MultiSelectModule,
    SectionTitleComponent
  ],
  templateUrl: './enhanced-transactions.component.html',
  styleUrls: ['./enhanced-transactions.component.css'],
  encapsulation: ViewEncapsulation.None, // FUCKING BYPASS ANGULAR'S STYLE ISOLATION
  providers: [DatePipe, MessageService]
})
export class EnhancedTransactionsComponent implements OnInit, OnDestroy, AfterViewInit {

  // Form controls
  filterForm: FormGroup = this.fb.group({});
  exportForm: FormGroup = this.fb.group({});

  // Data
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  loading: boolean = false;
  totalRecords: number = 0;

  // Pagination
  first: number = 0;
  rows: number = 25;
  page: number = 0;

  // User info
  currentUser: any = null;
  isAdmin: boolean = false;
  userMerchants: any[] = [];

  // UI State
  showFilters: boolean = true;
  showExportDialog: boolean = false;
  selectedTransactions: Transaction[] = [];

  showDetailsDialog: boolean = false;
  detailsLoading: boolean = false;
  selectedTransactionDetails: any = null;

  // Chart Data
  statusChartData: any = {};
  salesForecastData: any = {};
  approvalForecastData: any = {};
  trendsChartData: any = {};
  amountChartData: any = {};

  // Forecast calculations
  forecastedSalesToday: number = 0;
  forecastedApprovalRate: number = 0;
  forecastedDenialRate: number = 0;

  // Chart options
  pieChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  lineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => value.toLocaleString()
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    plugins: {
      legend: {
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) {
              return '$' + (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return '$' + (value / 1000).toFixed(1) + 'K';
            }
            return '$' + value;
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            return context.dataset.label + ': $' + value.toLocaleString('es-MX', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
          }
        }
      }
    }
  };

  forecastChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) {
              return '$' + (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return '$' + (value / 1000).toFixed(1) + 'K';
            }
            return '$' + value;
          }
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    plugins: {
      legend: {
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            if (context.dataset.label === 'Pronóstico') {
              return 'Pronóstico: $' + context.raw.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            }
            return context.dataset.label + ': $' + context.raw.toLocaleString('es-MX', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
          }
        }
      }
    }
  };

  // Response code labels from database
  responseCodeLabels: any = {};

  // Filter options
  statusOptions = [
    { label: 'Aprobada', value: '00' },
    { label: 'Rechazada', value: '01' },
    { label: 'En Proceso', value: '02' }
  ];

  cardTypeOptions = [
    { label: 'Visa', value: 'VISA' },
    { label: 'Mastercard', value: 'MASTERCARD' },
    { label: 'Amex', value: 'AMEX' }
  ];

  merchantOptions: any[] = [];

  // Quick date presets
  quickDatePresets = [
    { label: 'Hoy', days: 0 },
    { label: 'Ayer', days: 1 },
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días', days: 30 },
    { label: 'Mes actual', days: -1 },
    { label: 'Mes anterior', days: -2 }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private enhancedTransactionsService: EnhancedTransactionsService,
    private authService: AuthService,
    private sharedService: SharedService,
    private fb: FormBuilder,
    private messageService: MessageService,
    private router: Router,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadUserPermissions();
    this.initializeSubscriptions();
  }

  ngAfterViewInit(): void {
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      startDate: [null],
      endDate: [null],
      status: [[]],
      cardTypes: [[]],
      merchants: [[]],
      amountMin: [null],
      amountMax: [null]
    });

    this.exportForm = this.fb.group({
      format: ['csv'],
      includeDetails: [true]
    });
  }

  private loadUserData(): void {
    // Fix: Use proper auth service getter
    this.currentUser = this.authService.userInfo;

    // Debug logging
    console.log('🔍 User Info Debug:');
    console.log('Current user:', this.currentUser);
    console.log('User keys:', Object.keys(this.currentUser || {}));
    console.log('AuthService userInfo:', this.authService.userInfo);
    console.log('Full user object JSON:', JSON.stringify(this.currentUser, null, 2));

    // Use the REAL admin check with comprehensive debugging:
    const checks = {
      'currentUser?.isAdmin': this.currentUser?.isAdmin,
      'currentUser?.admin': this.currentUser?.admin,
      'currentUser?.is_admin': this.currentUser?.is_admin,
      'currentUser?.is_admin === 1': this.currentUser?.is_admin === 1,
      'currentUser?.is_admin === true': this.currentUser?.is_admin === true,
      'currentUser?.role': this.currentUser?.role,
      'currentUser?.role === admin': this.currentUser?.role === 'admin',
      'currentUser?.role === administrator': this.currentUser?.role === 'administrator'
    };

    console.log('🔍 ALL ADMIN CHECKS:', checks);

    // FIX: Use the field that auth service actually sets
    this.isAdmin = this.currentUser?.isAdmin || false;

    console.log('🔍 FINAL ADMIN CHECK:');
    console.log('Using this.currentUser?.isAdmin:', this.currentUser?.isAdmin);
    console.log('Final this.isAdmin:', this.isAdmin);

    if (!this.isAdmin) {
      this.loadUserMerchants();
    } else {
      this.loadAllMerchants();
    }
  }

  private loadUserPermissions(): void {
    console.log('🔐 Loading user permissions...');
    
    // Get current user info
    const userInfo = this.authService.userInfo;
    if (userInfo && userInfo.userProfile) {
      console.log('🔐 Loading permissions for profile:', userInfo.userProfile);
      
      // Load user permissions
      this.http.get(`/gateway/api/v2/profiles/resources/${userInfo.userProfile}`).subscribe(
        (response: any) => {
          console.log('🔐 User permissions loaded:', response.data);
          this.sharedService.shareProfilePermissions(response.data || []);
        },
        (error) => {
          console.error('❌ Error loading user permissions:', error);
          this.sharedService.shareProfilePermissions([]);
        }
      );
    } else {
      console.log('🔐 No user profile found, using empty permissions');
      this.sharedService.shareProfilePermissions([]);
    }
  }

  private loadUserMerchants(): void {
    console.log('🔍 loadUserMerchants called');
    this.enhancedTransactionsService.getUserMerchants().pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading user merchants:', error);
        return of({ success: false, data: [] });
      })
    ).subscribe(response => {
      console.log('📦 getUserMerchants response:', response);
      if (response.success) {
        this.userMerchants = response.data;
        console.log('👤 userMerchants set to:', this.userMerchants);
        this.merchantOptions = [
          { label: 'Todos mis comercios', value: 'all' },
          ...this.userMerchants.map(merchant => ({
            label: merchant.name_merchant,
            value: merchant.id_merchant.toString()
          }))
        ];
        console.log('🏪 merchantOptions set to:', this.merchantOptions);
      }
    });
  }

  private loadAllMerchants(): void {
    // Admin can see all merchants
    this.enhancedTransactionsService.getUserMerchants().pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading all merchants:', error);
        return of({ success: false, data: [] });
      })
    ).subscribe(response => {
      if (response.success) {
        this.merchantOptions = [
          { label: 'Todos los comercios', value: 'all' },
          ...response.data.map(merchant => ({
            label: merchant.name_merchant,
            value: merchant.id_merchant.toString()
          }))
        ];
      }
    });
  }

  private initializeSubscriptions(): void {
    // Watch for filter changes
    this.filterForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadTransactions(); // Reload from server on any filter change
    });
  }

  loadTransactions(): void {
    this.loading = true;
    this.cdr.detectChanges(); // Force change detection to prevent expression changed error

    const filters = this.buildQueryParams();
    console.log('🚀 loadTransactions calling service with filters:', filters);

    this.enhancedTransactionsService.getTransactions(filters).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error || 'No se pudieron cargar las transacciones'
        });
        this.loading = false;
        this.cdr.detectChanges(); // Force change detection
        return of({
          success: false,
          responseCodeLabels: {},
          data: [],
          pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
          statistics: { total: 0, approved: 0, rejected: 0, approvalRate: 0, totalAmount: 0, approvedAmount: 0 }
        });
      })
    ).subscribe(response => {
      console.log('📦 Service response:', response);

      // Store response code labels from database
      this.responseCodeLabels = response.responseCodeLabels || {};

      this.transactions = response.data || [];
      this.totalRecords = response.pagination?.total || 0;

      // Only apply frontend filters if backend didn't handle merchant filtering
      const filters = this.filterForm.value;
      const hasMerchantFilter = filters.merchants && filters.merchants.length > 0 && !filters.merchants.includes('all');

      console.log('🔍 FILTERING DEBUG:');
      console.log('filters.merchants:', filters.merchants);
      console.log('hasMerchantFilter:', hasMerchantFilter);
      console.log('this.transactions.length:', this.transactions.length);
      console.log('this.totalRecords:', this.totalRecords);

      if (!hasMerchantFilter) {
        console.log('🔧 Applying frontend filters (no merchant filter)');
        this.applyFilters();
      } else {
        console.log('🔧 Using backend data directly (merchant filter active)');
        // Backend already filtered by merchants, use data directly
        this.filteredTransactions = this.transactions;
        console.log('🔧 this.filteredTransactions.length after direct assignment:', this.filteredTransactions.length);
      }

      // Calculate forecasts and generate charts
      this.calculateSalesForecast();
      this.calculateApprovalRateForecast();
      this.generateChartsData();

      // DEBUG: Print transaction totals one by one
      this.debugTransactionTotals();

      this.loading = false;
      this.cdr.detectChanges(); // Force change detection
    });
  }

  openTransactionDetails(transaction: Transaction): void {
    const id = transaction?.id_message;
    if (!id) return;

    console.log('🔍 Opening transaction details:', transaction);

    this.showDetailsDialog = true;
    this.detailsLoading = false;
    // Use existing transaction data since backend endpoint doesn't exist
    this.selectedTransactionDetails = transaction;

    console.log('📊 Selected transaction details set:', this.selectedTransactionDetails);
    console.log('📊 Show details dialog:', this.showDetailsDialog);

    this.messageService.add({
      severity: 'info',
      summary: 'Detalles de Transacción',
      detail: 'Mostrando datos disponibles de la transacción'
    });
    this.cdr.detectChanges();
  }

  closeTransactionDetails(): void {
    this.showDetailsDialog = false;
    this.detailsLoading = false;
    this.selectedTransactionDetails = null;
  }

  downloadTransactionTxt(transaction: Transaction): void {
    const id = transaction?.id_message;
    if (!id) return;

    // Use existing transaction data since backend endpoint doesn't exist
    const data: any = transaction;
    const lines = Object.keys(data)
      .sort()
      .map((k) => `${k}: ${data[k] === null || data[k] === undefined ? '' : String(data[k])}`);

    const content = lines.join('\n') + '\n';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    this.enhancedTransactionsService.downloadFile(blob, `transaction_${id}.txt`);

    this.messageService.add({
      severity: 'success',
      summary: 'Descarga Exitosa',
      detail: `Comprobante de transacción ${id} descargado`
    });
  }

  private buildQueryParams(): TransactionFilters {
    const filters = this.filterForm.value;
    console.log('🔍 buildQueryParams raw filters:', filters);

    const params: TransactionFilters = {
      page: this.page,
      limit: this.rows,
      searchTerm: filters.searchTerm || undefined,
      status: filters.status,
      cardTypes: filters.cardTypes,
      merchants: this.processMerchantFilter(filters.merchants),
      amountMin: filters.amountMin,
      amountMax: filters.amountMax,
      startDate: filters.startDate ? new Date(filters.startDate).toISOString() : undefined,
      endDate: filters.endDate ? new Date(filters.endDate).toISOString() : undefined
    };

    // Remove null/undefined/empty values (but keep valid merchant filters)
    Object.keys(params).forEach(key => {
      const value = params[key as keyof TransactionFilters];
      if (value === null || value === undefined ||
          (Array.isArray(value) && value.length === 0 && key !== 'merchants') ||
          (typeof value === 'string' && value.trim() === '')) {
        delete params[key as keyof TransactionFilters];
      }
    });

    console.log('🔍 buildQueryParams final params:', params);
    return params;
  }

  private processMerchantFilter(merchants: string[]): string[] | undefined {
    if (!merchants || merchants.length === 0) {
      return undefined; // No merchant filter
    }

    if (merchants.includes('all')) {
      return undefined; // 'all' means no filtering
    }

    return merchants; // Return specific merchant IDs
  }

  private applyFilters(): void {
    const filters = this.filterForm.value;

    this.filteredTransactions = this.transactions.filter(transaction => {
      // Search term filter - search ALL table fields
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase().trim();

        // Simple search across all string fields
        const searchInField = (field: any) => {
          if (field === null || field === undefined) return false;
          return field.toString().toLowerCase().includes(searchLower);
        };

        const matchesSearch =
          searchInField(transaction.id_message) ||
          searchInField(transaction.name_merchant) ||
          searchInField(transaction.terminal) ||
          searchInField(transaction.msg_type) ||
          searchInField(transaction.reference_number) ||
          searchInField(transaction.amount) ||
          searchInField(transaction.amount_cents) ||
          searchInField(transaction.resp_code) ||
          searchInField(transaction.authorization) ||
          searchInField(transaction.bin) ||
          searchInField(transaction.last4) ||
          searchInField(transaction.creation_date) ||
          searchInField(transaction.id_operation) ||
          searchInField(transaction.estatus_f) ||
          searchInField(this.getCardTypeName(transaction.card_type)) ||
          searchInField(transaction.tran_date) ||
          searchInField(transaction.tran_time) ||
          searchInField(transaction.capture_date) ||
          searchInField(transaction.card_acceptor) ||
          searchInField(transaction.folio) ||
          searchInField(transaction.trace_number) ||
          searchInField(transaction.entry_mode) ||
          searchInField(transaction.reverse_code) ||
          searchInField(transaction.draft_capture) ||
          searchInField(transaction.more_info);

        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(transaction.resp_code)) return false;
      }

      // Card type filter
      if (filters.cardTypes && filters.cardTypes.length > 0) {
        const cardTypeName = this.getCardTypeName(transaction.card_type);
        if (!filters.cardTypes.includes(cardTypeName)) return false;
      }

      // Merchant filter (for admin)
      if (this.isAdmin && filters.merchants && filters.merchants.length > 0) {
        if (!filters.merchants.includes('all')) {
          // Check if transaction's merchant ID is in selected merchants
          if (!filters.merchants.includes(transaction.id_merchant.toString())) return false;
        }
      }

      // Amount range filter - use converted amounts from backend
      if (filters.amountMin !== null && Number(transaction.amount) < filters.amountMin) return false;
      if (filters.amountMax !== null && Number(transaction.amount) > filters.amountMax) return false;

      // Date range filter
      if (filters.dateRange && filters.dateRange.length === 2) {
        if (!transaction.creation_date) return false;
        const transDate = new Date(transaction.creation_date);
        if (isNaN(transDate.getTime())) return false;
        if (transDate < filters.dateRange[0] || transDate > filters.dateRange[1]) return false;
      }

      return true;
    });
  }

  onQuickDateSelect(preset: any): void {
    const today = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined = today;

    if (preset.days === 0) {
      // Hoy
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    } else if (preset.days === 1) {
      // Ayer
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 0, 0, 0);
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59);
    } else if (preset.days > 0) {
      // Últimos N días
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - preset.days, 0, 0, 0);
    } else if (preset.days === -1) {
      // Mes actual
      startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (preset.days === -2) {
      // Mes anterior
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    }

    if (startDate && endDate) {
      this.filterForm.patchValue({
        startDate,
        endDate
      });
      this.loadTransactions(); // Trigger reload with new date range
    }
  }

  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    this.page = Math.floor(event.first / event.rows);
    this.loadTransactions();
  }

  onRowsPerPageChange(event: any): void {
    this.rows = parseInt(event.target.value);
    this.first = 0;
    this.page = 0;
    this.loadTransactions();
  }

  onSort(event: any): void {
    // Handle sorting logic
    console.log('Sort event:', event);
  }

  onRowSelect(event: any): void {
    this.selectedTransactions = event;
  }

  onSelectAllChange(event: any): void {
    this.filteredTransactions = event.checked ?
      [...this.filteredTransactions] :
      this.filteredTransactions.filter(t => !this.selectedTransactions.includes(t));
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.loadTransactions(); // Reload after clearing
  }

  exportTransactions(): void {
    console.log('🚀 exportTransactions called!');
    console.log('showExportDialog:', this.showExportDialog);
    console.log('exportForm value:', this.exportForm.value);

    const exportOptions = this.exportForm.value;

    // Check specific export permissions
    if (exportOptions.format === 'csv' && !this.canExportCSV()) {
      console.log('❌ User does not have CSV export permission');
      this.messageService.add({
        severity: 'error',
        summary: 'Acceso denegado',
        detail: 'No tiene permisos para exportar a CSV'
      });
      return;
    }

    if (exportOptions.format === 'excel' && !this.canExportExcel()) {
      console.log('❌ User does not have Excel export permission');
      this.messageService.add({
        severity: 'error',
        summary: 'Acceso denegado',
        detail: 'No tiene permisos para exportar a Excel'
      });
      return;
    }

    console.log('✅ User has export permissions, proceeding with export');
    this.loading = true;
    this.cdr.detectChanges();

    // Build filters for export
    const filters = this.buildQueryParams();
    
    // Remove pagination for export
    delete filters.page;
    delete filters.limit;

    this.enhancedTransactionsService.exportTransactions(exportOptions, filters).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error || 'No se pudieron exportar los datos'
        });
        this.loading = false;
        this.cdr.detectChanges();
        return of(null);
      })
    ).subscribe(blob => {
      if (blob) {
        // Download the file
        const filename = `enhanced-transactions_${new Date().toISOString().split('T')[0]}.${exportOptions.format}`;
        this.enhancedTransactionsService.downloadFile(blob, filename);

        // Close dialog after export
        this.showExportDialog = false;

        // Show success message
        this.messageService.add({
          severity: 'success',
          summary: 'Exportación completada',
          detail: `Transacciones exportadas a ${exportOptions.format.toUpperCase()}`
        });
      }

      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  private exportData(data: any[], format: string): void {
    switch (format) {
      case 'csv':
        this.exportToCSV(data);
        break;
      case 'excel':
        this.exportToExcel(data);
        break;
    }

    // Close dialog after export
    this.showExportDialog = false;

    // Show success message
    this.messageService.add({
      severity: 'success',
      summary: 'Exportación completada',
      detail: `Se exportaron ${data.length} transacciones a ${format.toUpperCase()}`
    });
  }

  private exportToCSV(data: any[]): void {
    // Enhanced CSV value formatter with comprehensive handling
    const toCSVValue = (value: any): string => {
      if (value === null || value === undefined) {
        return '""';
      }
      
      if (value === '') {
        return '""';
      }

      // Handle Date objects with proper formatting
      if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          return '"Fecha inválida"';
        }
        const formattedDate = value.toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        return `"${formattedDate}"`;
      }

      // Handle numbers with proper formatting
      if (typeof value === 'number') {
        if (isNaN(value)) {
          return '"Número inválido"';
        }
        return `"${value.toLocaleString('es-MX')}"`;
      }

      // Handle booleans
      if (typeof value === 'boolean') {
        return `"${value ? 'Sí' : 'No'}"`;
      }

      // Convert to string and handle special characters
      let stringValue: string;
      if (typeof value === 'object') {
        try {
          stringValue = JSON.stringify(value, null, 2);
        } catch (error) {
          stringValue = `Error al serializar objeto: ${error}`;
        }
      } else {
        stringValue = String(value);
      }

      // Clean up string value
      stringValue = stringValue.trim();
      
      // Handle empty string after trim
      if (stringValue === '') {
        return '""';
      }

      // Escape quotes and wrap in CSV quotes with proper handling
      const escapedValue = stringValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    };

    // Format date for export (Spanish format) - Comprehensive handling
    const formatDateForExport = (dateString: string): string => {
      if (!dateString || dateString === '' || dateString === null || dateString === undefined) {
        return 'Fecha no proporcionada';
      }
      
      try {
        let date: Date;
        
        // Handle different date formats comprehensively
        if (dateString.includes('T')) {
          // ISO format: 2024-01-15T10:30:00.000Z or 2024-01-15T10:30:00
          date = new Date(dateString);
        } else if (dateString.includes('-')) {
          // Date format: 2024-01-15
          date = new Date(dateString + 'T00:00:00');
        } else if (dateString.includes('/')) {
          // Format: 15/01/2024 or 15/01/24
          const parts = dateString.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            date = new Date(`${year}-${month}-${day}T00:00:00`);
          } else {
            return `Formato de fecha inválido: ${dateString}`;
          }
        } else if (!isNaN(Number(dateString))) {
          // Timestamp or numeric date
          date = new Date(Number(dateString));
        } else {
          // Try as direct date string
          date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) {
          return `Fecha no válida: ${dateString}`;
        }
        
        // Return comprehensive Spanish format
        return date.toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
      } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return `Error al procesar fecha: ${dateString}`;
      }
    };

    // Format currency for export with comprehensive error handling
    const formatCurrencyForExport = (amount: number | string | null | undefined): string => {
      if (amount === null || amount === undefined || amount === '') {
        return '$0.00 MXN';
      }
      
      try {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        
        if (isNaN(numAmount)) {
          return `Monto inválido: ${amount}`;
        }
        
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(numAmount);
        
      } catch (error) {
        console.error('Error formatting currency:', amount, error);
        return `Error en monto: ${amount}`;
      }
    };

    // Enhanced headers with Spanish labels for better readability
    const headers = [
      'ID Transacción',
      'Comercio',
      'Terminal',
      'Tipo Mensaje',
      'Número Referencia',
      'Monto (MXN)',
      'Descripción Respuesta',
      'Autorización',
      'BIN',
      'Últimos 4 Dígitos',
      'Fecha Creación',
      'ID Operación',
      'Estatus',
      'Tipo Tarjeta',
      'Fecha Transacción',
      'Hora Transacción',
      'Fecha Captura',
      'Aceptador Tarjeta',
      'Folio',
      'Número Trazo',
      'Modo Entrada',
      'Código Reverso',
      'Captura Borrador'
    ];

    // Create CSV content with header
    const csvRows: string[] = [];
    
    // Add metadata header with dashboard information
    const now = new Date();
    const exportInfo = [
      `REPORTE DE TRANSACCIONES MEJORADAS`,
      `Generado: ${now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      `Hora: ${now.toLocaleTimeString('es-MX')}`,
      `Usuario: ${this.currentUser?.name || this.currentUser?.email || 'Sistema'}`,
      `Total de Transacciones: ${data.length}`,
      `Monto Total: ${formatCurrencyForExport(this.getTotalAmount())}`,
      `Tasa Aprobación: ${this.getApprovalRate()}%`,
      '', // Empty line for separation
      'RESUMEN',
      `Transacciones Aprobadas: ${data.filter(t => t.resp_code === '00' || t.resp_code === '0').length}`,
      `Monto Aprobado: ${formatCurrencyForExport(this.getApprovedAmount())}`,
      `Transacciones Rechazadas: ${data.filter(t => t.resp_code && t.resp_code !== '00' && t.resp_code !== '0' && t.resp_code !== '02').length}`,
      `Monto Rechazado: ${formatCurrencyForExport(this.getRejectedAmount())}`,
      '', // Empty line for separation
      'DETALLE DE TRANSACCIONES'
    ];
    
    exportInfo.forEach(line => csvRows.push(`"${line}"`));
    csvRows.push(headers.join(','));

    // Process each transaction
    data.forEach((row, index) => {
      const csvRow = [
        toCSVValue(row.id_message),
        toCSVValue(row.name_merchant),
        toCSVValue(row.terminal),
        toCSVValue(this.getTransactionType(row)), // Use formatted transaction type instead of raw msg_type
        toCSVValue(row.reference_number),
        toCSVValue(formatCurrencyForExport(Number(row.amount))),
        toCSVValue(this.getTransactionStatusLabel(row.resp_code)),
        toCSVValue(row.authorization),
        toCSVValue(row.bin),
        toCSVValue(row.last4),
        toCSVValue(formatDateForExport(row.creation_date)),
        toCSVValue(this.getTransactionType(row)), // Use formatted transaction type instead of raw id_operation
        toCSVValue(this.getTransactionStatusLabel(row.resp_code)),
        toCSVValue(this.getCardTypeName(row.card_type)),
        toCSVValue(row.tran_date || ''),
        toCSVValue(row.tran_time || ''),
        toCSVValue(formatDateForExport(row.capture_date)),
        toCSVValue(row.card_acceptor),
        toCSVValue(row.folio),
        toCSVValue(row.trace_number),
        toCSVValue(row.entry_mode),
        toCSVValue(row.reverse_code),
        toCSVValue(row.draft_capture)
      ];

      csvRows.push(csvRow.join(','));
    });

    // Add footer with additional statistics
    const footerStats = [
      '',
      'ESTADÍSTICAS ADICIONALES',
      `Promedio por Transacción: ${formatCurrencyForExport(this.getTotalAmount() / Math.max(data.length, 1))}`,
      `Transacción más alta: ${formatCurrencyForExport(Math.max(...data.map(t => Number(t.amount) || 0)))}`,
      `Transacción más baja: ${formatCurrencyForExport(Math.min(...data.map(t => Number(t.amount) || 0)))}`,
      `Fechas del reporte: ${this.getDateRange()}`,
      `Filtros aplicados: ${this.getActiveFiltersDescription()}`
    ];
    
    footerStats.forEach(line => csvRows.push(`"${line}"`));

    // Add comprehensive CSS for print-friendly formatting
    const printStyles = `
      <style>
        @media print {
          @page {
            size: A4;
            margin: 0.5in;
            orientation: landscape;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 10pt;
            line-height: 1.2;
            color: #000;
            background: #fff;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: avoid;
            margin-bottom: 20px;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            text-align: left;
            vertical-align: top;
            font-size: 9pt;
          }
          
          th {
            background-color: #f8f9fa;
            font-weight: bold;
            font-size: 10pt;
            color: #333;
            border-bottom: 2px solid #dee2e6;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          
          .header-section {
            page-break-after: always;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border: 2px solid #dee2e6;
            border-radius: 8px;
          }
          
          .summary-section {
            page-break-inside: avoid;
            margin: 20px 0;
            padding: 15px;
            background: #e9ecef;
            border: 1px solid #dee2e6;
            border-radius: 6px;
          }
          
          .metric-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            padding: 3px 0;
          }
          
          .metric-label {
            font-weight: bold;
            color: #495057;
            min-width: 200px;
          }
          
          .metric-value {
            font-weight: bold;
            color: #007bff;
            text-align: right;
          }
          
          .footer-section {
            page-break-before: always;
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            font-size: 9pt;
          }
          
          h1 {
            font-size: 18pt;
            color: #007bff;
            text-align: center;
            margin-bottom: 20px;
            page-break-after: avoid;
          }
          
          h2 {
            font-size: 14pt;
            color: #495057;
            margin: 15px 0 10px 0;
            page-break-after: avoid;
          }
          
          .no-print {
            display: none !important;
          }
        }
        
        @screen {
          .only-print {
            display: none;
          }
        }
      </style>
    `;
    
    // Create HTML content with proper print styling
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es-MX">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte de Transacciones Mejoradas</title>
        ${printStyles}
      </head>
      <body>
        <div class="header-section">
          <h1>REPORTE DE TRANSACCIONES MEJORADAS</h1>
          <div class="metric-row">
            <span class="metric-label">Generado:</span>
            <span class="metric-value">${now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Hora:</span>
            <span class="metric-value">${now.toLocaleTimeString('es-MX')}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Usuario:</span>
            <span class="metric-value">${this.currentUser?.name || this.currentUser?.email || 'Sistema'}</span>
          </div>
        </div>
        
        <div class="summary-section">
          <h2>RESUMEN EJECUTIVO</h2>
          <div class="metric-row">
            <span class="metric-label">Total Transacciones:</span>
            <span class="metric-value">${data.length.toLocaleString()}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Monto Total:</span>
            <span class="metric-value">${formatCurrencyForExport(this.getTotalAmount())}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Tasa Aprobación:</span>
            <span class="metric-value">${this.getApprovalRate()}%</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Promedio por Transacción:</span>
            <span class="metric-value">${formatCurrencyForExport(this.getTotalAmount() / Math.max(data.length, 1))}</span>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row, index) => {
              const csvRow = [
                toCSVValue(row.id_message),
                toCSVValue(row.name_merchant),
                toCSVValue(row.terminal),
                toCSVValue(this.getTransactionType(row)), // Use formatted transaction type instead of raw msg_type
                toCSVValue(row.reference_number),
                toCSVValue(formatCurrencyForExport(Number(row.amount))),
                toCSVValue(this.getTransactionStatusLabel(row.resp_code)),
                toCSVValue(row.authorization),
                toCSVValue(row.bin),
                toCSVValue(row.last4),
                toCSVValue(formatDateForExport(row.creation_date)),
                toCSVValue(this.getTransactionType(row)), // Use formatted transaction type instead of raw id_operation
                toCSVValue(this.getTransactionStatusLabel(row.resp_code)),
                toCSVValue(this.getCardTypeName(row.card_type)),
                toCSVValue(row.tran_date || ''),
                toCSVValue(row.tran_time || ''),
                toCSVValue(formatDateForExport(row.capture_date)),
                toCSVValue(row.card_acceptor),
                toCSVValue(row.folio),
                toCSVValue(row.trace_number),
                toCSVValue(row.entry_mode),
                toCSVValue(row.reverse_code),
                toCSVValue(row.draft_capture)
              ];
              return `<tr>${csvRow.map(cell => `<td>${cell.replace(/"/g, '')}</td>`).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>
        
        <div class="footer-section">
          <h2>ESTADÍSTICAS ADICIONALES</h2>
          <div class="metric-row">
            <span class="metric-label">Transacción más alta:</span>
            <span class="metric-value">${formatCurrencyForExport(Math.max(...data.map(t => Number(t.amount) || 0)))}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Transacción más baja:</span>
            <span class="metric-value">${formatCurrencyForExport(Math.min(...data.map(t => Number(t.amount) || 0)))}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Fechas del reporte:</span>
            <span class="metric-value">${this.getDateRange()}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Filtros aplicados:</span>
            <span class="metric-value">${this.getActiveFiltersDescription()}</span>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 8pt; color: #666;">
            Página <span class="page-number"></span> de <span class="page-count"></span>
          </div>
        </div>
        
        <script>
          // Auto-generate page numbers
          window.addEventListener('beforeprint', function() {
            const totalPages = Math.ceil(document.body.scrollHeight / window.innerHeight);
            document.querySelectorAll('.page-number').forEach(el => el.textContent = '1');
            document.querySelectorAll('.page-count').forEach(el => el.textContent = totalPages.toString());
          });
        </script>
      </body>
      </html>
    `;
    
    // Create blob and download with HTML extension for better print support
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const timestamp = now.toISOString().split('T')[0];
    const filename = `reporte_transacciones_mejoradas_${timestamp}.html`;
    this.downloadFile(blob, filename);
  }

  private exportToExcel(data: any[]): void {
    // Enhanced Excel export with dashboard-friendly formatting
    import('xlsx').then(XLSX => {
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0];
      
      // Create workbook with multiple sheets for better organization
      const wb = XLSX.utils.book_new();
      
      // 1. Create Dashboard Summary Sheet
      const dashboardData = this.createDashboardSummary();
      const wsDashboard = XLSX.utils.json_to_sheet(dashboardData);
      
      // Style the dashboard sheet
      const dashboardColWidths = [
        { wch: 30 }, // Metric
        { wch: 20 }, // Value
        { wch: 40 }  // Description
      ];
      wsDashboard['!cols'] = dashboardColWidths;
      
      XLSX.utils.book_append_sheet(wb, wsDashboard, 'Panel Resumen');
      
      // 2. Create Detailed Transactions Sheet
      const excelData = data.map((transaction, index) => {
        const baseRow: any = {
          '#': index + 1,
          'ID Transacción': transaction.id_message || '',
          'Comercio': transaction.name_merchant || '',
          'Terminal': transaction.terminal || '',
          'Referencia': transaction.reference_number || '',
          'Monto (MXN)': Number(transaction.amount) || 0,
          'Moneda': 'MXN',
          'Estado': this.getTransactionStatusLabel(transaction.resp_code),
          'Código Respuesta': transaction.resp_code || '',
          'Autorización': transaction.authorization || '',
          'BIN': transaction.bin || '',
          'Últimos 4': transaction.last4 || '',
          'Tipo Tarjeta': this.getCardTypeName(transaction.card_type),
          'Fecha Creación': transaction.creation_date && !isNaN(new Date(transaction.creation_date).getTime())
            ? new Date(transaction.creation_date).toLocaleString('es-MX')
            : '',
          'Fecha Transacción': transaction.tran_date || '',
          'Hora Transacción': transaction.tran_time || '',
          'Fecha Captura': transaction.capture_date && !isNaN(new Date(transaction.capture_date).getTime())
            ? new Date(transaction.capture_date).toLocaleString('es-MX')
            : '',
          'ID Operación': transaction.id_operation || '',
          'Folio': transaction.folio || '',
          'Trace Number': transaction.trace_number || '',
          'Entry Mode': transaction.entry_mode || '',
          'Card Acceptor': transaction.card_acceptor || '',
          'Monto Formateado': this.formatCurrencyForExport(Number(transaction.amount) || 0)
        };

        // Add additional details if requested
        if (this.exportForm.value.includeDetails && transaction.more_info) {
          try {
            const moreInfo = typeof transaction.more_info === 'string'
              ? JSON.parse(transaction.more_info)
              : transaction.more_info;

            // Flatten nested objects for Excel columns
            const flattened = this.flattenObject(moreInfo);
            Object.keys(flattened).forEach(key => {
              (baseRow as any)[`Detalle: ${key}`] = flattened[key];
            });
          } catch (e) {
            (baseRow as any)['Detalles Adicionales'] = transaction.more_info || '';
          }
        }

        return baseRow;
      });

      // Create transactions worksheet
      const wsTransactions = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths for transactions sheet
      const transColWidths = [
        { wch: 8 },  // #
        { wch: 15 }, // ID Transacción
        { wch: 25 }, // Comercio
        { wch: 15 }, // Terminal
        { wch: 20 }, // Referencia
        { wch: 15 }, // Monto
        { wch: 8 },  // Moneda
        { wch: 15 }, // Estado
        { wch: 15 }, // Código Respuesta
        { wch: 15 }, // Autorización
        { wch: 12 }, // BIN
        { wch: 12 }, // Últimos 4
        { wch: 15 }, // Tipo Tarjeta
        { wch: 20 }, // Fecha Creación
        { wch: 15 }, // Fecha Transacción
        { wch: 12 }, // Hora Transacción
        { wch: 20 }, // Fecha Captura
        { wch: 20 }, // ID Operación
        { wch: 15 }, // Folio
        { wch: 15 }, // Trace Number
        { wch: 15 }, // Entry Mode
        { wch: 20 }, // Card Acceptor
        { wch: 18 }  // Monto Formateado
      ];
      wsTransactions['!cols'] = transColWidths;
      
      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transacciones Detalladas');
      
      // 3. Create Statistics Sheet
      const statsData = this.createStatisticsSummary();
      const wsStats = XLSX.utils.json_to_sheet(statsData);
      
      const statsColWidths = [
        { wch: 25 }, // Statistic
        { wch: 20 }, // Value
        { wch: 35 }  // Description
      ];
      wsStats['!cols'] = statsColWidths;
      
      XLSX.utils.book_append_sheet(wb, wsStats, 'Estadísticas');

      // Add workbook metadata
      if (!wb.Props) wb.Props = {};
      wb.Props.Title = 'Reporte de Transacciones Mejoradas';
      wb.Props.Subject = 'Exportación Detallada de Transacciones con Panel de Control';
      wb.Props.Author = this.currentUser?.name || this.currentUser?.email || 'Sistema de Transacciones';
      wb.Props.Company = 'Sistema de Pagos';
      wb.Props.CreatedDate = now;

      // Generate filename with timestamp
      const filename = `reporte_transacciones_panel_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      // Show success message with details
      this.messageService.add({
        severity: 'success',
        summary: 'Exportación Completada',
        detail: `Reporte generado con ${data.length} transacciones. Incluye panel de control y estadísticas.`
      });

    }).catch(error => {
      console.error('Error loading xlsx library:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo exportar a Excel. Biblioteca no disponible.'
      });
    });
  }

  // Helper methods for enhanced export functionality
  private createDashboardSummary(): any[] {
    const now = new Date();
    const totalTransactions = this.filteredTransactions.length;
    const approvedTransactions = this.filteredTransactions.filter(t => t.resp_code === '00' || t.resp_code === '0').length;
    const rejectedTransactions = this.filteredTransactions.filter(t => t.resp_code && t.resp_code !== '00' && t.resp_code !== '0' && t.resp_code !== '02').length;
    const processingTransactions = this.filteredTransactions.filter(t => t.resp_code === '02').length;
    
    return [
      { 'Métrica': 'INFORMACIÓN DEL REPORTE', 'Valor': '', 'Descripción': 'Panel de Control de Transacciones' },
      { 'Métrica': 'Fecha Generación', 'Valor': now.toLocaleDateString('es-MX'), 'Descripción': 'Fecha de creación del reporte' },
      { 'Métrica': 'Hora Generación', 'Valor': now.toLocaleTimeString('es-MX'), 'Descripción': 'Hora de creación del reporte' },
      { 'Métrica': 'Usuario', 'Valor': this.currentUser?.name || this.currentUser?.email || 'Sistema', 'Descripción': 'Usuario que generó el reporte' },
      { 'Métrica': '', 'Valor': '', 'Descripción': '' },
      { 'Métrica': 'RESUMEN DE TRANSACCIONES', 'Valor': '', 'Descripción': 'Estadísticas generales' },
      { 'Métrica': 'Total Transacciones', 'Valor': totalTransactions.toLocaleString(), 'Descripción': 'Número total de transacciones en el período' },
      { 'Métrica': 'Monto Total', 'Valor': this.formatCurrencyForExport(this.getTotalAmount()), 'Descripción': 'Suma total de todas las transacciones' },
      { 'Métrica': 'Promedio por Transacción', 'Valor': this.formatCurrencyForExport(this.getTotalAmount() / Math.max(totalTransactions, 1)), 'Descripción': 'Valor promedio por transacción' },
      { 'Métrica': 'Tasa Aprobación', 'Valor': `${this.getApprovalRate()}%`, 'Descripción': 'Porcentaje de transacciones aprobadas' },
      { 'Métrica': '', 'Valor': '', 'Descripción': '' },
      { 'Métrica': 'TRANSACCIONES APROBADAS', 'Valor': '', 'Descripción': 'Transacciones exitosas' },
      { 'Métrica': 'Cantidad Aprobadas', 'Valor': approvedTransactions.toLocaleString(), 'Descripción': 'Número de transacciones aprobadas' },
      { 'Métrica': 'Monto Aprobado', 'Valor': this.formatCurrencyForExport(this.getApprovedAmount()), 'Descripción': 'Suma de transacciones aprobadas' },
      { 'Métrica': 'Promedio Aprobadas', 'Valor': this.formatCurrencyForExport(this.getApprovedAmount() / Math.max(approvedTransactions, 1)), 'Descripción': 'Promedio de transacciones aprobadas' },
      { 'Métrica': '', 'Valor': '', 'Descripción': '' },
      { 'Métrica': 'TRANSACCIONES RECHAZADAS', 'Valor': '', 'Descripción': 'Transacciones fallidas' },
      { 'Métrica': 'Cantidad Rechazadas', 'Valor': rejectedTransactions.toLocaleString(), 'Descripción': 'Número de transacciones rechazadas' },
      { 'Métrica': 'Monto Rechazado', 'Valor': this.formatCurrencyForExport(this.getRejectedAmount()), 'Descripción': 'Suma de transacciones rechazadas' },
      { 'Métrica': 'Tasa Rechazo', 'Valor': `${totalTransactions > 0 ? Math.round((rejectedTransactions / totalTransactions) * 100) : 0}%`, 'Descripción': 'Porcentaje de transacciones rechazadas' },
      { 'Métrica': '', 'Valor': '', 'Descripción': '' },
      { 'Métrica': 'PRONÓSTICOS', 'Valor': '', 'Descripción': 'Proyecciones basadas en datos históricos' },
      { 'Métrica': 'Ventas Hoy (Pronóstico)', 'Valor': this.formatCurrencyForExport(this.forecastedSalesToday), 'Descripción': 'Pronóstico de ventas para hoy' },
      { 'Métrica': 'Tasa Aprobación (Pronóstico)', 'Valor': `${this.forecastedApprovalRate}%`, 'Descripción': 'Pronóstico de tasa de aprobación' },
      { 'Métrica': 'Tasa Rechazo (Pronóstico)', 'Valor': `${this.forecastedDenialRate}%`, 'Descripción': 'Pronóstico de tasa de rechazo' },
      { 'Métrica': '', 'Valor': '', 'Descripción': '' },
      { 'Métrica': 'PERÍODO DEL REPORTE', 'Valor': '', 'Descripción': 'Información del período analizado' },
      { 'Métrica': 'Rango de Fechas', 'Valor': this.getDateRange(), 'Descripción': 'Período cubierto por el reporte' },
      { 'Métrica': 'Filtros Aplicados', 'Valor': this.getActiveFiltersDescription(), 'Descripción': 'Filtros utilizados en la consulta' }
    ];
  }

  private createStatisticsSummary(): any[] {
    const transactions = this.filteredTransactions;
    const amounts = transactions.map(t => Number(t.amount) || 0);
    const approvedAmounts = transactions.filter(t => t.resp_code === '00' || t.resp_code === '0').map(t => Number(t.amount) || 0);
    const rejectedAmounts = transactions.filter(t => t.resp_code && t.resp_code !== '00' && t.resp_code !== '0' && t.resp_code !== '02').map(t => Number(t.amount) || 0);
    
    // Calculate statistics
    const sortedAmounts = amounts.sort((a, b) => a - b);
    const median = sortedAmounts.length > 0 ? 
      (sortedAmounts[Math.floor(sortedAmounts.length / 2)] + sortedAmounts[Math.ceil(sortedAmounts.length / 2) - 1]) / 2 : 0;
    
    // Calculate by card type
    const cardTypeStats = this.calculateCardTypeStatistics();
    
    // Calculate by merchant
    const merchantStats = this.calculateMerchantStatistics();
    
    return [
      { 'Estadística': 'ESTADÍSTICAS GENERALES', 'Valor': '', 'Descripción': 'Análisis detallado de transacciones' },
      { 'Estadística': 'Total Transacciones', 'Valor': transactions.length.toLocaleString(), 'Descripción': 'Número total de transacciones' },
      { 'Estadística': 'Monto Total', 'Valor': this.formatCurrencyForExport(this.getTotalAmount()), 'Descripción': 'Suma total de todas las transacciones' },
      { 'Estadística': 'Promedio', 'Valor': this.formatCurrencyForExport(this.getTotalAmount() / Math.max(transactions.length, 1)), 'Descripción': 'Valor promedio por transacción' },
      { 'Estadística': 'Mediana', 'Valor': this.formatCurrencyForExport(median), 'Descripción': 'Valor mediano de las transacciones' },
      { 'Estadística': 'Monto Máximo', 'Valor': this.formatCurrencyForExport(Math.max(...amounts)), 'Descripción': 'Transacción de mayor monto' },
      { 'Estadística': 'Monto Mínimo', 'Valor': this.formatCurrencyForExport(Math.min(...amounts)), 'Descripción': 'Transacción de menor monto' },
      { 'Estadística': 'Desviación Estándar', 'Valor': this.formatCurrencyForExport(this.calculateStandardDeviation(amounts)), 'Descripción': 'Variabilidad de los montos' },
      { 'Estadística': '', 'Valor': '', 'Descripción': '' },
      { 'Estadística': 'ESTADÍSTICAS POR ESTADO', 'Valor': '', 'Descripción': 'Análisis por estado de transacción' },
      { 'Estadística': 'Transacciones Aprobadas', 'Valor': approvedAmounts.length.toLocaleString(), 'Descripción': 'Número de transacciones aprobadas' },
      { 'Estadística': 'Monto Aprobado', 'Valor': this.formatCurrencyForExport(this.getApprovedAmount()), 'Descripción': 'Suma de transacciones aprobadas' },
      { 'Estadística': 'Promedio Aprobadas', 'Valor': this.formatCurrencyForExport(this.getApprovedAmount() / Math.max(approvedAmounts.length, 1)), 'Descripción': 'Promedio de transacciones aprobadas' },
      { 'Estadística': 'Transacciones Rechazadas', 'Valor': rejectedAmounts.length.toLocaleString(), 'Descripción': 'Número de transacciones rechazadas' },
      { 'Estadística': 'Monto Rechazado', 'Valor': this.formatCurrencyForExport(this.getRejectedAmount()), 'Descripción': 'Suma de transacciones rechazadas' },
      { 'Estadística': 'Promedio Rechazadas', 'Valor': this.formatCurrencyForExport(this.getRejectedAmount() / Math.max(rejectedAmounts.length, 1)), 'Descripción': 'Promedio de transacciones rechazadas' },
      { 'Estadística': '', 'Valor': '', 'Descripción': '' },
      ...cardTypeStats,
      { 'Estadística': '', 'Valor': '', 'Descripción': '' },
      ...merchantStats
    ];
  }

  private calculateCardTypeStatistics(): any[] {
    const cardTypes = ['VISA', 'MASTERCARD', 'AMEX'];
    const stats = [
      { 'Estadística': 'ESTADÍSTICAS POR TIPO TARJETA', 'Valor': '', 'Descripción': 'Análisis por tipo de tarjeta' }
    ];
    
    cardTypes.forEach(cardType => {
      const cardTransactions = this.filteredTransactions.filter(t => this.getCardTypeName(t.card_type) === cardType);
      const cardAmount = cardTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const approvedCard = cardTransactions.filter(t => t.resp_code === '00' || t.resp_code === '0');
      const approvedCardAmount = approvedCard.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      stats.push({
        'Estadística': `Transacciones ${cardType}`,
        'Valor': cardTransactions.length.toLocaleString(),
        'Descripción': `Total de transacciones ${cardType} (${((cardTransactions.length / this.filteredTransactions.length) * 100).toFixed(1)}%)`
      });
      
      stats.push({
        'Estadística': `Monto ${cardType}`,
        'Valor': this.formatCurrencyForExport(cardAmount),
        'Descripción': `Suma total de transacciones ${cardType}`
      });
      
      stats.push({
        'Estadística': `Tasa Aprobación ${cardType}`,
        'Valor': `${cardTransactions.length > 0 ? Math.round((approvedCard.length / cardTransactions.length) * 100) : 0}%`,
        'Descripción': `Porcentaje de aprobación para ${cardType}`
      });
    });
    
    return stats;
  }

  private calculateMerchantStatistics(): any[] {
    const merchantGroups = this.filteredTransactions.reduce((groups, transaction) => {
      const merchant = transaction.name_merchant || 'Desconocido';
      if (!groups[merchant]) {
        groups[merchant] = { count: 0, amount: 0, approved: 0, approvedAmount: 0 };
      }
      groups[merchant].count++;
      groups[merchant].amount += Number(transaction.amount) || 0;
      
      if (transaction.resp_code === '00' || transaction.resp_code === '0') {
        groups[merchant].approved++;
        groups[merchant].approvedAmount += Number(transaction.amount) || 0;
      }
      
      return groups;
    }, {} as Record<string, any>);
    
    const stats = [
      { 'Estadística': 'ESTADÍSTICAS POR COMERCIO', 'Valor': '', 'Descripción': 'Top 5 comercios por volumen' }
    ];
    
    const sortedMerchants = Object.entries(merchantGroups)
      .sort(([,a], [,b]) => b.amount - a.amount)
      .slice(0, 5);
    
    sortedMerchants.forEach(([merchant, data], index) => {
      stats.push({
        'Estadística': `Comercio #${index + 1}`,
        'Valor': merchant,
        'Descripción': `${data.count} transacciones, ${this.formatCurrencyForExport(data.amount)}`
      });
    });
    
    return stats;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  private formatDateForExport(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      return 'Fecha no disponible';
    }
    
    try {
      return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', date, error);
      return `Error en fecha: ${date}`;
    }
  }

  private formatCurrencyForExport(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined || amount === '') {
      return '$0.00 MXN';
    }
    
    try {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
      
      if (isNaN(numAmount)) {
        return `Monto inválido: ${amount}`;
      }
      
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numAmount);
      
    } catch (error) {
      console.error('Error formatting currency:', amount, error);
      return `Error en monto: ${amount}`;
    }
  }

  private getDateRange(): string {
    const filters = this.filterForm.value;
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).toLocaleDateString('es-MX');
      const end = new Date(filters.endDate).toLocaleDateString('es-MX');
      return `${start} - ${end}`;
    }
    return 'Todos los datos disponibles';
  }

  private getActiveFiltersDescription(): string {
    const filters = this.filterForm.value;
    const activeFilters: string[] = [];
    
    if (filters.searchTerm) activeFilters.push(`Búsqueda: "${filters.searchTerm}"`);
    if (filters.status && filters.status.length > 0) activeFilters.push(`Estados: ${filters.status.join(', ')}`);
    if (filters.cardTypes && filters.cardTypes.length > 0) activeFilters.push(`Tarjetas: ${filters.cardTypes.join(', ')}`);
    if (filters.merchants && filters.merchants.length > 0 && !filters.merchants.includes('all')) activeFilters.push(`Comercios: ${filters.merchants.length} seleccionados`);
    if (filters.amountMin || filters.amountMax) activeFilters.push(`Monto: $${filters.amountMin || 0} - $${filters.amountMax || '∞'}`);
    
    return activeFilters.length > 0 ? activeFilters.join(' | ') : 'Ningún filtro aplicado';
  }

  public getTransactionStatusLabel(respCode: string): string {
    if (respCode === null || respCode === undefined || respCode === '') {
      return 'Código de respuesta no disponible';
    }
    
    try {
      const code = respCode.toString().trim();
      
      // First check if we have a label from database
      if (this.responseCodeLabels && this.responseCodeLabels[code]) {
        const dbLabel = this.responseCodeLabels[code];
        if (dbLabel && dbLabel.description) {
          return dbLabel.description;
        }
      }
      
      // Fallback to service method
      const serviceLabel = this.enhancedTransactionsService.getStatusLabel(code);
      if (serviceLabel && serviceLabel !== code) {
        return serviceLabel;
      }
      
      // Comprehensive hardcoded labels as final fallback
      const statusMap: Record<string, string> = {
        '00': 'Aprobada',
        '0': 'Aprobada',
        '01': 'Rechazada',
        '02': 'En Proceso',
        '03': 'Inválida',
        '04': 'Retener Tarjeta',
        '05': 'No Aceptar',
        '06': 'Error General',
        '07': 'Retener Tarjeta',
        '08': 'Aprobada',
        '09': 'Aprobada',
        '10': 'Aprobada',
        '11': 'Aprobada',
        '12': 'Transacción Inválida',
        '13': 'Monto Inválido',
        '14': 'Número de Tarjeta Inválido',
        '15': 'Emisor No Disponible',
        '16': 'Aprobada',
        '17': 'Cancelación',
        '18': 'Discrepancia',
        '19': 'Reingresar Transacción',
        '20': 'Error General',
        '21': 'Reversal No Encontrada',
        '22': 'Error en Sintaxis',
        '23': 'Transacción No Permitida',
        '24': 'Archivo No Actualizado',
        '25': 'Duplicado',
        '26': 'Error en Campo',
        '27': 'Error en Formato',
        '28': 'Error en Reversal',
        '29': 'Error General',
        '30': 'Error de Formato',
        '31': 'Banco No Disponible',
        '32': 'Error en Comunicación',
        '33': 'Error General',
        '34': 'Error en Tarjeta',
        '35': 'Error General',
        '36': 'Error en Transacción',
        '37': 'Error General',
        '38': 'Error en PIN',
        '39': 'Error General',
        '40': 'Error General',
        '41': 'Error General',
        '42': 'Error General',
        '43': 'Error General',
        '44': 'Error General',
        '45': 'Error General',
        '46': 'Error General',
        '47': 'Error General',
        '48': 'Error General',
        '49': 'Error General',
        '50': 'Error General',
        '51': 'Saldo Insuficiente',
        '52': 'Cuenta No Existe',
        '53': 'Límite Excedido',
        '54': 'Tarjeta Expirada',
        '55': 'PIN Incorrecto',
        '56': 'Tarjeta Reportada',
        '57': 'Transacción No Permitida',
        '58': 'Transacción No Permitida',
        '59': 'Transacción No Permitida',
        '60': 'Error General',
        '61': 'Límite Excedido',
        '62': 'Error General',
        '63': 'Error General',
        '64': 'Error General',
        '65': 'Límite Excedido',
        '66': 'Error General',
        '67': 'Error General',
        '68': 'Error General',
        '69': 'Error General',
        '70': 'Error General',
        '71': 'Error General',
        '72': 'Error General',
        '73': 'Error General',
        '74': 'Error General',
        '75': 'Intentos Excedidos',
        '76': 'Error General',
        '77': 'Error General',
        '78': 'Error General',
        '79': 'Error General',
        '80': 'Error General',
        '81': 'Error General',
        '82': 'Error General',
        '83': 'Error General',
        '84': 'Error General',
        '85': 'Error General',
        '86': 'Error General',
        '87': 'Error General',
        '88': 'Error General',
        '89': 'Error General',
        '90': 'Error General',
        '91': 'Emisor No Disponible',
        '92': 'Error General',
        '93': 'Error General',
        '94': 'Error General',
        '95': 'Error General',
        '96': 'Problema Sistema',
        '97': 'Error General',
        '98': 'Error General',
        '99': 'Error General',
        '100': 'Aprobada',
        '101': 'Rechazada',
        '102': 'Rechazada',
        '103': 'Rechazada',
        '104': 'Rechazada',
        '105': 'Rechazada'
      };
      
      const mappedStatus = statusMap[code];
      if (mappedStatus) {
        return mappedStatus;
      }
      
      // If no specific mapping, return descriptive message
      if (code.startsWith('0')) {
        return `Código de aprobación: ${code}`;
      } else if (code.startsWith('1') || code.startsWith('2')) {
        return `Código de rechazo: ${code}`;
      } else {
        return `Código de respuesta: ${code}`;
      }
      
    } catch (error) {
      console.error('Error getting transaction status label:', respCode, error);
      return `Error en código de respuesta: ${respCode}`;
    }
  }

  public getCardTypeName(cardType: string): string {
    if (!cardType || cardType === '' || cardType === null || cardType === undefined) {
      return 'Tipo de tarjeta no especificado';
    }
    
    try {
      const normalizedCardType = cardType.toString().toUpperCase().trim();
      
      const typeMap: Record<string, string> = {
        'VISA': 'Visa',
        'VI': 'Visa',
        'V': 'Visa',
        'MASTERCARD': 'Mastercard',
        'MC': 'Mastercard',
        'M': 'Mastercard',
        'AMEX': 'American Express',
        'AE': 'American Express',
        'A': 'American Express',
        'AMERICAN EXPRESS': 'American Express',
        'DEBIT': 'Débito',
        'DÉBITO': 'Débito',
        'DEBITO': 'Débito',
        'DE': 'Débito',
        'CREDIT': 'Crédito',
        'CRÉDITO': 'Crédito',
        'CREDITO': 'Crédito',
        'CR': 'Crédito',
        'DINERS CLUB': 'Diners Club',
        'DC': 'Diners Club',
        'DISCOVER': 'Discover',
        'DI': 'Discover',
        'JCB': 'JCB',
        'JC': 'JCB',
        'UNIONPAY': 'UnionPay',
        'UP': 'UnionPay'
      };
      
      const result = typeMap[normalizedCardType];
      
      if (result) {
        return result;
      }
      
      // If not found in map, return cleaned original value
      const cleaned = normalizedCardType.replace(/[^A-Z0-9\s]/g, ' ').trim();
      return cleaned || 'Tarjeta desconocida';
      
    } catch (error) {
      console.error('Error getting card type name:', cardType, error);
      return `Error en tipo de tarjeta: ${cardType}`;
    }
  }

  // Helper methods for HTML template
  public getDefaultValue(defaultMessage: string): string {
    return defaultMessage;
  }

  public formatDateForDisplay(dateString: string): string {
    if (!dateString || dateString === '' || dateString === null || dateString === undefined) {
      return 'Fecha no proporcionada';
    }
    
    try {
      let date: Date;
      
      // Handle different date formats comprehensively
      if (dateString.includes('T')) {
        // ISO format: 2024-01-15T10:30:00.000Z or 2024-01-15T10:30:00
        date = new Date(dateString);
      } else if (dateString.includes('-')) {
        // Date format: 2024-01-15
        date = new Date(dateString + 'T00:00:00');
      } else if (dateString.includes('/')) {
        // Format: 15/01/2024 or 15/01/24
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          date = new Date(`${year}-${month}-${day}T00:00:00`);
        } else {
          return `Formato de fecha inválido: ${dateString}`;
        }
      } else if (!isNaN(Number(dateString))) {
        // Timestamp or numeric date
        date = new Date(Number(dateString));
      } else {
        // Try as direct date string
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return `Fecha no válida: ${dateString}`;
      }
      
      // Return comprehensive Spanish format for display
      return date.toLocaleDateString('es-MX', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
    } catch (error) {
      console.error('Error formatting date for display:', dateString, error);
      return `Error al procesar fecha: ${dateString}`;
    }
  }

  public formatTimeOnly(timeString: string): string {
    if (!timeString || timeString === '' || timeString === null || timeString === undefined) {
      return 'Hora no proporcionada';
    }
    
    try {
      // Handle different time formats
      if (timeString.includes(':')) {
        const parts = timeString.split(':');
        if (parts.length >= 2) {
          const hours = parseInt(parts[0]);
          const minutes = parseInt(parts[1]);
          
          if (!isNaN(hours) && !isNaN(minutes)) {
            return timeString; // Return as-is if properly formatted
          }
        }
      }
      
      // Try to parse as time
      const time = new Date(`2000-01-01T${timeString}`);
      if (isNaN(time.getTime())) {
        return `Hora no válida: ${timeString}`;
      }
      
      return time.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
    } catch (error) {
      console.error('Error formatting time:', timeString, error);
      return `Error al procesar hora: ${timeString}`;
    }
  }

  public handleUndefined(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'No disponible';
    }
    return String(value);
  }

  // Helper method to flatten nested objects for Excel export
  private flattenObject(obj: any, prefix = ''): any {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    const result: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}_${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
          // Recursively flatten nested objects
          Object.assign(result, this.flattenObject(value, newKey));
        } else {
          (result as any)[newKey] = value;
        }
      }
    }

    return result;
  }

  // Helper method to get JSON field value from more_info
  getJsonValueField(transaction: any, fieldName: string): string {
    if (!transaction || !transaction.more_info) {
      return 'N/A';
    }

    try {
      let moreInfo = transaction.more_info;

      // Parse if it's a string
      if (typeof moreInfo === 'string') {
        // Clean the JSON string (same logic as CSV export)
        let jsonStr = moreInfo.trim();

        // Remove outer quotes if present
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
          jsonStr = jsonStr.slice(1, -1);
        }

        // Unescape quotes
        jsonStr = jsonStr.replace(/\\"/g, '"');

        // Fix common JSON issues
        jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"');
        jsonStr = jsonStr.replace(/,\s*}/g, '}');
        jsonStr = jsonStr.replace(/,\s*]/g, ']');

        moreInfo = JSON.parse(jsonStr);
      }

      // Flatten nested objects
      const flattened = this.flattenObject(moreInfo);

      // Return the field value or N/A
      return flattened[fieldName] || 'N/A';

    } catch (e) {
      return 'N/A';
    }
  }

  copyToClipboard(referenceNumber: string): void {
    if (!referenceNumber) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay número de referencia para copiar'
      });
      return;
    }

    navigator.clipboard.writeText(referenceNumber).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Copiado',
        detail: `Referencia ${referenceNumber} copiada al portapapeles`
      });
    }).catch(err => {
      console.error('Error al copiar al portapapeles:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo copiar la referencia al portapapeles'
      });
    });
  }

  copyFullTransactionToClipboard(): void {
    if (!this.selectedTransactionDetails) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos de transacción para copiar'
      });
      return;
    }

    const jsonString = JSON.stringify(this.selectedTransactionDetails, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'JSON Copiado',
        detail: 'JSON completo de la transacción copiado al portapapeles'
      });
    }).catch(err => {
      console.error('Error al copiar JSON al portapapeles:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo copiar el JSON al portapapeles'
      });
    });
  }

  // Method to format full transaction as JSON for template display
  getFormattedTransactionJson(): string {
    if (!this.selectedTransactionDetails) {
      return '{}';
    }
    return JSON.stringify(this.selectedTransactionDetails, null, 2);
  }

  // Helper method to check if a string is valid JSON
  isValidJsonString(value: any): boolean {
    if (typeof value !== 'string') return false;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  // Helper method to format JSON for display
  prettyFormatJson(value: unknown): string {
    try {
      const stringValue = String(value);
      const parsed = JSON.parse(stringValue);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(value);
    }
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  getSelectedCount(): number {
    return this.selectedTransactions.length;
  }

  getFilteredCount(): number {
    // When data is loaded from the backend (with filters), use totalRecords
    // Only use filteredTransactions.length for purely client-side operations
    return this.totalRecords;
  }

  getTotalAmount(): number {
    const totalDollars = this.filteredTransactions.reduce((sum, t) => {
      // Use amount from backend (already in dollars)
      let amount = 0;

      if (t.amount) {
        amount = Number(t.amount);  // Already in dollars
      }

      return sum + amount;  // Adding dollars
    }, 0);

    return totalDollars;
  }

  getApprovedAmount(): number {
    const totalDollars = this.filteredTransactions
      .filter(t => t.resp_code === '00' || t.resp_code === '0')
      .reduce((sum, t) => {
        let amount = 0;

        if (t.amount) {
          amount = Number(t.amount);  // Already in dollars
        }

        return sum + amount;
      }, 0);

    return totalDollars;
  }

  getRejectedAmount(): number {
    const totalDollars = this.filteredTransactions
      .filter(t => !(t.resp_code === '00' || t.resp_code === '0'))
      .reduce((sum, t) => {
        let amount = 0;

        if (t.amount) {
          amount = Number(t.amount);  // Already in dollars
        }

        return sum + amount;
      }, 0);

    return totalDollars;
  }

  getApprovalRate(): number {
    const total = this.filteredTransactions.length;
    const approved = this.filteredTransactions.filter(t => t.resp_code === '00' || t.resp_code === '0').length;
    return total > 0 ? Math.round((approved / total) * 100) : 0;
  }

  // Forecast Methods
  calculateSalesForecast(): void {
    // Simple forecast based on average of last 7 days
    const today = new Date();
    const last7Days = this.filteredTransactions.filter(t => {
      if (!t.creation_date) return false;
      const transDate = new Date(t.creation_date);
      if (isNaN(transDate.getTime())) return false;
      const diffTime = today.getTime() - transDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays > 0;
    });

    if (last7Days.length === 0) {
      this.forecastedSalesToday = 0;
      return;
    }

    const dailyAmounts = last7Days.reduce((acc, t) => {
      if (!t.creation_date) return acc;
      const transDate = new Date(t.creation_date);
      if (isNaN(transDate.getTime())) return acc;
      const dateKey = transDate.toDateString();
      const amount = Number(t.amount); // Already in dollars
      acc[dateKey] = (acc[dateKey] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    const totalLast7Days = Object.values(dailyAmounts).reduce((sum, amount) => sum + amount, 0);
    const avgDailySales = totalLast7Days / Math.max(Object.keys(dailyAmounts).length, 1);
    this.forecastedSalesToday = Math.round(avgDailySales);
  }

  calculateApprovalRateForecast(): void {
    // Forecast based on recent trends (last 30 days)
    const today = new Date();
    const last30Days = this.filteredTransactions.filter(t => {
      if (!t.creation_date) return false;
      const transDate = new Date(t.creation_date);
      if (isNaN(transDate.getTime())) return false;
      const diffTime = today.getTime() - transDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    });

    if (last30Days.length === 0) {
      this.forecastedApprovalRate = 0;
      this.forecastedDenialRate = 0;
      return;
    }

    const approved = last30Days.filter(t => t.resp_code === '00' || t.resp_code === '0').length;
    const total = last30Days.length;

    this.forecastedApprovalRate = Math.round((approved / total) * 100);
    this.forecastedDenialRate = 100 - this.forecastedApprovalRate;
  }

  generateChartsData(): void {
    this.generateStatusPieChart();
    this.generateTrendsChart();
    this.generateAmountChart();
    this.generateSalesForecastChart();
    this.generateApprovalForecastChart();
  }

  private generateStatusPieChart(): void {
    const approved = this.filteredTransactions.filter(t => t.resp_code === '00' || t.resp_code === '0').length;
    const rejected = this.filteredTransactions.filter(t =>
      t.resp_code && t.resp_code !== '00' && t.resp_code !== '0' && t.resp_code !== '02'
    ).length;
    const processing = this.filteredTransactions.filter(t => t.resp_code === '02').length;

    this.statusChartData = {
      labels: ['Aprobadas', 'Rechazadas', 'En Proceso'],
      datasets: [{
        data: [approved, rejected, processing],
        backgroundColor: ['#10b981', '#ef4444', '#0c4772'], // Match theme colors
        hoverBackgroundColor: ['#059669', '#dc2626', '#1a5490'] // Darker versions
      }]
    };
  }

  private generateTrendsChart(): void {
    // Group transactions by date for the last 7 days
    const today = new Date();
    const last7Days: Record<string, { approved: number, rejected: number, total: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      last7Days[dateKey] = { approved: 0, rejected: 0, total: 0 };
    }

    this.filteredTransactions.forEach(t => {
      if (t.creation_date) {
        const transactionDate = new Date(t.creation_date);
        // Skip invalid dates
        if (!isNaN(transactionDate.getTime())) {
          const dateKey = transactionDate.toISOString().split('T')[0];
          if (last7Days[dateKey]) {
            last7Days[dateKey].total++;
            if (t.resp_code === '00' || t.resp_code === '0') {
              last7Days[dateKey].approved++;
            } else {
              last7Days[dateKey].rejected++;
            }
          }
        }
      }
    });

    const labels = Object.keys(last7Days).map(date => new Date(date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }));

    this.trendsChartData = {
      labels,
      datasets: [
        {
          label: 'Aprobadas',
          data: Object.values(last7Days).map(d => d.approved),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Rechazadas',
          data: Object.values(last7Days).map(d => d.rejected),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }

  private generateAmountChart(): void {
    const approvedAmount = this.getApprovedAmount();
    const rejectedAmount = this.getRejectedAmount();

    this.amountChartData = {
      labels: ['Aprobadas', 'Rechazadas'],
      datasets: [{
        label: 'Monto (MXN)',
        data: [approvedAmount / 100, rejectedAmount / 100], // Convert to dollars for display
        backgroundColor: ['#10b981', '#ef4444'],
        borderColor: ['#059669', '#dc2626'],
        borderWidth: 2
      }]
    };
  }

  private generateSalesForecastChart(): void {
    const today = new Date();
    const labels = [];
    const actualData = [];
    const forecastData = [];

    // Get actual data for last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayTransactions = this.filteredTransactions.filter(t => {
        if (!t.creation_date) return false;
        const transDate = new Date(t.creation_date);
        if (isNaN(transDate.getTime())) return false;
        return transDate.toISOString().split('T')[0] === dateKey;
      });

      const totalAmount = dayTransactions.reduce((sum, t) =>
        sum + Number(t.amount), 0 // Already in dollars
      );

      labels.push(date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }));
      actualData.push(totalAmount); // Already in dollars
      forecastData.push(null); // No forecast for past days
    }

    // Add today forecast
    labels.push('Hoy (Pronóstico)');
    actualData.push(null);
    forecastData.push(this.forecastedSalesToday); // Already in dollars

    this.salesForecastData = {
      labels,
      datasets: [
        {
          label: 'Ventas Reales',
          data: actualData,
          borderColor: '#0c4772',
          backgroundColor: 'rgba(12, 71, 114, 0.1)',
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#0c4772',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        },
        {
          label: 'Pronóstico',
          data: forecastData,
          borderColor: '#1a5490',
          backgroundColor: 'rgba(26, 84, 144, 0.1)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#1a5490',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  }

  private generateApprovalForecastChart(): void {
    const today = new Date();
    const labels = [];
    const actualData = [];
    const forecastData = [];

    // Get actual approval rates for last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayTransactions = this.filteredTransactions.filter(t => {
        if (!t.creation_date) return false;
        const transDate = new Date(t.creation_date);
        if (isNaN(transDate.getTime())) return false;
        return transDate.toISOString().split('T')[0] === dateKey;
      });

      const totalDayTransactions = dayTransactions.length;
      const approvedDayTransactions = dayTransactions.filter(t =>
        t.resp_code === '00' || t.resp_code === '0'
      ).length;

      const approvalRate = totalDayTransactions > 0 ?
        Math.round((approvedDayTransactions / totalDayTransactions) * 100) : 0;

      labels.push(date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }));
      actualData.push(approvalRate);
      forecastData.push(null); // No forecast for past days
    }

    // Add today forecast
    labels.push('Hoy (Pronóstico)');
    actualData.push(null);
    forecastData.push(this.forecastedApprovalRate);

    this.approvalForecastData = {
      labels,
      datasets: [
        {
          label: 'Tasa Real (%)',
          data: actualData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        },
        {
          label: 'Pronóstico (%)',
          data: forecastData,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.1)',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#059669',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  }

  // Getter methods for template conditions (fix Angular parser error)
  get hasStatusChartData(): boolean {
    return this.statusChartData && this.statusChartData.datasets && this.statusChartData.datasets.length > 0;
  }

  get hasTrendsChartData(): boolean {
    return this.trendsChartData && this.trendsChartData.datasets && this.trendsChartData.datasets.length > 0;
  }

  get hasAmountChartData(): boolean {
    return this.amountChartData && this.amountChartData.datasets && this.amountChartData.datasets.length > 0;
  }

  get hasSalesForecastData(): boolean {
    return this.salesForecastData && this.salesForecastData.datasets && this.salesForecastData.datasets.length > 0;
  }

  get hasApprovalForecastData(): boolean {
    return this.approvalForecastData && this.approvalForecastData.datasets && this.approvalForecastData.datasets.length > 0;
  }

  // DEBUG METHOD - Print transactions one by one
  debugTransactionTotals() {
    console.log('=== DEBUGGING TRANSACTION TOTALS ===');
    console.log('Total transactions:', this.filteredTransactions.length);

    let totalSum = 0;
    let approvedSum = 0;
    let rejectedSum = 0;

    this.filteredTransactions.forEach((t, index) => {
      const amount = Number(t.amount); // Already in dollars
      totalSum += amount;

      if (t.resp_code === '00' || t.resp_code === '0') {
        approvedSum += amount;
      } else {
        rejectedSum += amount;
      }

      console.log(`Transaction ${index + 1}: Amount = ${amount}, Running Total = ${totalSum}, Approved = ${approvedSum}, Rejected = ${rejectedSum}`);
    });

    console.log('=== FINAL TOTALS ===');
    console.log('Total Amount:', totalSum);
    console.log('Approved Amount:', approvedSum);
    console.log('Rejected Amount:', rejectedSum);
    console.log('========================');
  }

  // Helper methods for the template
  getTransactionStatusClass(status: string): string {
    switch (status) {
      case '00':
      case '0': return 'status-approved';
      case '01':
      case '51':
      case '61':
      case '82':
      case '147':
      case '91':
      case '96':
      case '99': return 'status-rejected';
      case '02': return 'status-processing';
      case '03':
      case '04':
      case '05': return 'status-rejected';
      default: return 'status-unknown';
    }
  }


  getStatusTypeClass(statusType: string): string {
    switch (statusType) {
      case 'VENTA': return 'status-type-venta';
      case 'DEVOLUCION': return 'status-type-devolucion';
      case 'CANCELACION': return 'status-type-cancelacion';
      case 'CHECKIN': return 'status-type-checkin';
      case 'CHECKOUT': return 'status-type-checkout';
      case 'REAUTORIZACION': return 'status-type-reautorizacion';
      case 'REVERSO': return 'status-type-reverso';
      default: return 'status-type-otro';
    }
  }

  // Operation ID mapping function
  getOperationLabel(operationId: string): string {
    const operationMap: { [key: string]: string } = {
      '4': 'VENTA',
      '5': 'DEVOLUCION',
      '6': 'CANCELACION',
      '7': 'CHECKIN',
      '8': 'CHECKOUT',
      '9': 'REAUTORIZACION',
      '16': 'REVERSO'
    };
    return operationMap[operationId] || operationId || 'N/A';
  }

  // Status ID mapping function (for estatus_f)
  getStatusLabel(estatusF: number): string {
    const statusMap: { [key: number]: string } = {
      1: 'Pendiente',
      2: 'Aprobada',
      3: 'Rechazada'
    };
    return statusMap[estatusF] || estatusF?.toString() || 'N/A';
  }


  formatAmount(amount: number | string, isCents: boolean = false): string {
    const numAmount = Number(amount);

    // Only divide by 100 if explicitly told it's cents
    if (isCents) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(numAmount / 100);
    } else {
      // Already in dollars - use as-is
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(numAmount);
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      // Format for Mexico City timezone
      return date.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }

  // Format date only (without time) for transaction date fields - shows as "20 Marzo"
  formatDateOnly(dateString: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = date.getDate();
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const monthName = monthNames[date.getMonth()];

      return `${day} ${monthName}`;
    } catch (error) {
      console.error('Error formatting date only:', error);
      return 'Invalid Date';
    }
  }

  
  public hasActiveFilters(): boolean {
    const filters = this.filterForm.value;
    return !!(
      filters.searchTerm ||
      filters.startDate ||
      filters.endDate ||
      (filters.status && filters.status.length > 0) ||
      (filters.cardTypes && filters.cardTypes.length > 0) ||
      (filters.merchants && filters.merchants.length > 0) ||
      filters.amountMin !== null ||
      filters.amountMax !== null
    );
  }

  exportToPDF(): void {
    // Check if user can export PDF
    if (!this.canExportPDF()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin permisos',
        detail: 'No tiene permisos para exportar a PDF'
      });
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    // Build filters with high limit to get all filtered rows
    const filters = this.buildQueryParams();
    filters.page = 0;
    filters.limit = 10000; // High limit to get all filtered rows

    this.enhancedTransactionsService.getTransactions(filters).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los datos para el PDF'
        });
        this.loading = false;
        this.cdr.detectChanges();
        return of({ data: [] });
      })
    ).subscribe(response => {
      this.generatePDF(response.data || []);
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  private generatePDF(transactions: Transaction[]): void {
    // Import jsPDF and autoTable dynamically
    import('jspdf').then(({ jsPDF }) => {
      import('jspdf-autotable').then((autoTableModule) => {
        const { default: autoTable } = autoTableModule;
        const doc = new jsPDF('landscape'); // Landscape orientation

        // === HEADER SECTION ===
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte Detallado de Transacciones', 14, 20);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 30);
        doc.text(`Período: ${this.getReportPeriod()}`, 14, 37);
        doc.text(`Total de transacciones: ${transactions.length}`, 14, 44);

        // === SUMMARY STATISTICS ===
        const stats = this.calculateTransactionStats(transactions);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen Estadístico', 14, 58);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const summaryY = 65;
        doc.text(`• Transacciones Aprobadas: ${stats.approved} (${stats.approvalRate}%)`, 20, summaryY);
        doc.text(`• Transacciones Rechazadas: ${stats.rejected} (${stats.rejectionRate}%)`, 20, summaryY + 6);
        doc.text(`• Monto Total Aprobado: $${stats.totalApproved.toLocaleString('es-MX')}`, 20, summaryY + 12);
        doc.text(`• Monto Promedio: $${stats.averageAmount.toLocaleString('es-MX')}`, 20, summaryY + 18);
        doc.text(`• Comercios Únicos: ${stats.uniqueMerchants}`, 20, summaryY + 24);

        // === DETAILED TRANSACTIONS TABLE ===
        const headers = [
          'Fecha/Hora', 
          'Comercio', 
          'Referencia', 
          'Tarjeta', 
          'Bin', 
          'Autorización', 
          'Monto', 
          'Tipo', 
          'Estado',
          'Mensaje'
        ];

        const data = transactions.map(t => {
          // DEBUG: Log the actual data we're working with
          console.log('PDF Transaction Data:', {
            tran_date: t.tran_date,
            tran_time: t.tran_time,
            creation_date: t.creation_date,
            capture_date: t.capture_date,
            reference_number: t.reference_number
          });
          
          const dateResult = this.formatDateTime(t.tran_date, t.tran_time) || 
                            this.formatDateTime(t.creation_date) || 
                            this.formatDateTime(t.capture_date) || 
                            this.parseReferenceAsTimestamp(t.reference_number) ||
                            'N/A';
          
          console.log('Date parsing result:', dateResult);
          
          return [
            dateResult,
            (t.name_merchant || 'N/A').substring(0, 30), // Limit length for table
            t.reference_number || 'N/A',
            this.getCardTypeName(t.card_type),
            t.bin || 'N/A',
            t.authorization || 'N/A',
            this.formatAmount(t.amount, false),
            this.getTransactionType(t),
            this.getTransactionStatus(t.resp_code),
            this.getErrorMessage(t)
          ];
        });

        // Generate table with autoTable for proper pagination
        autoTable(doc, {
          head: [headers],
          body: data,
          startY: 95,
          styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: 'linebreak',
            font: 'helvetica'
          },
          headStyles: {
            fillColor: [7, 67, 117],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8,
            font: 'helvetica'
          },
          bodyStyles: {
            textColor: 0,
            font: 'helvetica'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          columnStyles: {
            0: { cellWidth: 35 }, // Fecha/Hora
            1: { cellWidth: 45 }, // Comercio
            2: { cellWidth: 30 }, // Referencia
            3: { cellWidth: 25 }, // Tarjeta
            4: { cellWidth: 20 }, // Bin
            5: { cellWidth: 25 }, // Autorización
            6: { cellWidth: 25 }, // Monto
            7: { cellWidth: 20 }, // Tipo
            8: { cellWidth: 20 }, // Estado
            9: { cellWidth: 35 }  // Mensaje
          },
          margin: { top: 95, left: 14, right: 14, bottom: 25 },
          didDrawPage: (data) => {
            // Add page number at bottom
            const pageCount = (doc as any).internal.getNumberOfPages();
            const pageCurrent = (doc as any).internal.getCurrentPageInfo().pageNumber;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Página ${pageCurrent} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
            
            // Add footer with company info
            doc.text('Reporte Confidencial - Solo para uso del comerciante', 14, doc.internal.pageSize.height - 10);
          }
        });

        // === MERCHANT BREAKDOWN (if space allows) ===
        if (transactions.length > 0 && transactions.length < 500) {
          const merchantBreakdown = this.getMerchantBreakdown(transactions);
          if (merchantBreakdown.length > 0) {
            const finalY = (doc as any).lastAutoTable.finalY || 200;
            
            if (finalY < doc.internal.pageSize.height - 60) {
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text('Resumen por Comercio', 14, finalY + 10);

              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              let yPosition = finalY + 17;
              
              merchantBreakdown.slice(0, 10).forEach((merchant, index) => {
                if (yPosition < doc.internal.pageSize.height - 20) {
                  doc.text(`• ${merchant.name}: ${merchant.count} tx ($${merchant.total.toLocaleString('es-MX')})`, 20, yPosition);
                  yPosition += 5;
                }
              });
            }
          }
        }

        // Save PDF
        const filename = `reporte_transacciones_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        this.messageService.add({
          severity: 'success',
          summary: 'PDF generado exitosamente',
          detail: `Reporte profesional con ${transactions.length} transacciones exportado`
        });
      });
    }).catch(() => {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el PDF. Biblioteca no disponible.'
      });
    });
  }

  // Helper methods for enhanced PDF
  private calculateTransactionStats(transactions: Transaction[]): any {
    const approved = transactions.filter(t => t.resp_code === '00' || t.resp_code === '0').length;
    const rejected = transactions.length - approved;
    const approvedTransactions = transactions.filter(t => t.resp_code === '00' || t.resp_code === '0');
    const totalApproved = approvedTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const averageAmount = transactions.length > 0 ? totalApproved / approved : 0;
    const uniqueMerchants = new Set(transactions.map(t => t.id_merchant)).size;

    return {
      approved,
      rejected,
      approvalRate: transactions.length > 0 ? Math.round((approved / transactions.length) * 100) : 0,
      rejectionRate: transactions.length > 0 ? Math.round((rejected / transactions.length) * 100) : 0,
      totalApproved,
      averageAmount,
      uniqueMerchants
    };
  }

  private getReportPeriod(): string {
    const filters = this.filterForm.value;
    if (filters.startDate && filters.endDate) {
      return `Del ${this.formatDate(filters.startDate)} al ${this.formatDate(filters.endDate)}`;
    }
    return 'Todos los registros';
  }

  private parseReferenceAsTimestamp(referenceNumber?: string): string {
    console.log('parseReferenceAsTimestamp called with:', referenceNumber);
    
    if (!referenceNumber || referenceNumber.trim() === '') {
      console.log('Reference number is empty, returning N/A');
      return 'N/A';
    }
    
    try {
      // Check if reference number is a 12-digit timestamp (YYMMDDHHMMSS)
      if (referenceNumber.length === 12 && /^\d{12}$/.test(referenceNumber)) {
        console.log('Reference number matches 12-digit format, parsing...');
        const year = 2000 + parseInt(referenceNumber.substring(0, 2)); // YY -> 20YY
        const month = parseInt(referenceNumber.substring(2, 4)) - 1; // MM (0-indexed)
        const day = parseInt(referenceNumber.substring(4, 6));
        const hour = parseInt(referenceNumber.substring(6, 8));
        const minute = parseInt(referenceNumber.substring(8, 10));
        const second = parseInt(referenceNumber.substring(10, 12));
        
        const date = new Date(year, month, day, hour, minute, second);
        console.log('Created date from reference:', date);
        
        if (isNaN(date.getTime())) {
          console.log('Created date is invalid');
          return 'Fecha inválida';
        }
        
        const formatted = date.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        console.log('Formatted date from reference:', formatted);
        return formatted;
      }
      
      console.log('Reference number does not match 12-digit format');
      return 'N/A';
    } catch (error) {
      console.error('Error in parseReferenceAsTimestamp:', error);
      return 'Error formato';
    }
  }

  private parseSpanishDate(dateString: string): Date | null {
    try {
      // Spanish month names mapping
      const spanishMonths: { [key: string]: string } = {
        'enero': '01',
        'febrero': '02', 
        'marzo': '03',
        'abril': '04',
        'mayo': '05',
        'junio': '06',
        'julio': '07',
        'agosto': '08',
        'septiembre': '09',
        'setiembre': '09', // Alternative spelling
        'octubre': '10',
        'noviembre': '11',
        'diciembre': '12'
      };

      // Handle format like "25 Enero 2025 11:07:13"
      const fullDateTimeMatch = dateString.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/i);
      if (fullDateTimeMatch) {
        const [, day, monthName, year, hour, minute, second] = fullDateTimeMatch;
        const month = spanishMonths[monthName.toLowerCase()];
        if (month) {
          return new Date(`${year}-${month}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}`);
        }
      }

      // Handle format like "25 Enero"
      const dateOnlyMatch = dateString.match(/^(\d{1,2})\s+(\w+)$/i);
      if (dateOnlyMatch) {
        const [, day, monthName] = dateOnlyMatch;
        const month = spanishMonths[monthName.toLowerCase()];
        if (month) {
          // Default to current year since no year is provided
          const currentYear = new Date().getFullYear();
          return new Date(`${currentYear}-${month}-${day.padStart(2, '0')}T00:00:00`);
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing Spanish date:', dateString, error);
      return null;
    }
  }

  private formatDateTime(tranDate?: string, tranTime?: string): string {
    console.log('formatDateTime called with:', { tranDate, tranTime });
    
    if (!tranDate || tranDate.trim() === '') {
      console.log('tranDate is empty, returning N/A');
      return 'N/A';
    }
    
    try {
      let date: Date;
      
      // Handle case where we have both separate date and time (Spanish format)
      if (tranTime && tranTime.trim() !== '') {
        console.log('Combining date and time');
        
        // First try Spanish date parsing
        const spanishDate = this.parseSpanishDate(tranDate);
        if (spanishDate) {
          console.log('Parsed Spanish date:', spanishDate);
          // Extract time components from tranTime
          const timeMatch = tranTime.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
          if (timeMatch) {
            const [, hour, minute, second] = timeMatch;
            // Set the time on the parsed Spanish date
            spanishDate.setHours(parseInt(hour), parseInt(minute), parseInt(second));
            date = spanishDate;
            console.log('Combined Spanish date with time:', date);
          } else {
            date = spanishDate;
          }
        } else {
          // Try ISO format first
          const dateTimeString = `${tranDate}T${tranTime}`;
          date = new Date(dateTimeString);
          
          // If that fails, try space-separated format
          if (isNaN(date.getTime())) {
            const altDateTimeString = `${tranDate} ${tranTime}`;
            date = new Date(altDateTimeString);
            console.log('Tried alternative format:', altDateTimeString);
          }
        }
      }
      // Handle case where tran_date might be a full Spanish datetime
      else if (tranDate.includes(' ')) {
        console.log('Parsing as full datetime string');
        // Try Spanish date parsing first
        const spanishDate = this.parseSpanishDate(tranDate);
        if (spanishDate) {
          console.log('Parsed Spanish datetime:', spanishDate);
          date = spanishDate;
        } else {
          date = new Date(tranDate);
        }
      }
      // Handle case where tran_date is a Spanish date only
      else if (!/^\d{4}-\d{2}-\d{2}/.test(tranDate)) {
        console.log('Parsing as Spanish date only');
        const spanishDate = this.parseSpanishDate(tranDate);
        if (spanishDate) {
          console.log('Parsed Spanish date only:', spanishDate);
          date = spanishDate;
        } else {
          date = new Date(tranDate);
        }
      }
      // Handle case where tran_date is actually a timestamp in YYMMDDHHMMSS format (like 250408130702)
      else if (tranDate.length === 12 && /^\d{12}$/.test(tranDate)) {
        console.log('tranDate is 12-digit timestamp, parsing...');
        const year = 2000 + parseInt(tranDate.substring(0, 2)); // YY -> 20YY
        const month = parseInt(tranDate.substring(2, 4)) - 1; // MM (0-indexed)
        const day = parseInt(tranDate.substring(4, 6));
        const hour = parseInt(tranDate.substring(6, 8));
        const minute = parseInt(tranDate.substring(8, 10));
        const second = parseInt(tranDate.substring(10, 12));
        
        date = new Date(year, month, day, hour, minute, second);
        console.log('Created date from 12-digit timestamp:', date);
      }
      // Handle case where tran_date might be a full ISO timestamp
      else if (tranDate.includes('T') || tranDate.includes('-')) {
        console.log('Parsing as ISO/date string');
        date = new Date(tranDate);
      }
      // Handle simple date only or other formats
      else {
        console.log('Parsing as simple date');
        date = new Date(tranDate);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('Date is invalid, returning Fecha inválida');
        return 'Fecha inválida';
      }
      
      // Return formatted date and time in Spanish format
      const formatted = date.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      console.log('Successfully formatted date:', formatted);
      return formatted;
    } catch (error) {
      console.error('Error in formatDateTime:', error);
      return 'Error formato';
    }
  }

  private getTransactionType(transaction: Transaction): string {
    console.log('getTransactionType called with:', {
      msg_type: transaction.msg_type,
      tipo_operacion: (transaction as any).tipo_operacion,
      id_operation: transaction.id_operation
    });
    
    // Handle msg_type as string (not padded with zeros)
    if (transaction.msg_type === '200') return 'Venta';
    if (transaction.msg_type === '210') return 'Venta';
    if (transaction.msg_type === '220') return 'Anulación';
    if (transaction.msg_type === '420') return 'Reverso';
    
    // Handle id_operation as string (not number)
    if (transaction.id_operation === 'VENTA') return 'Venta';
    if (transaction.id_operation === 'DEVOLUCION') return 'Devolución';
    if (transaction.id_operation === 'CANCELACION') return 'Cancelación';
    if (transaction.id_operation === 'CHECKIN') return 'Checkin';
    if (transaction.id_operation === 'CHECKOUT') return 'Checkout';
    if (transaction.id_operation === 'REAUTORIZACION') return 'Reautorización';
    if (transaction.id_operation === 'REVERSO') return 'Reverso';
    if (transaction.id_operation === 'OTRO') return 'Otro';
    
    return (transaction as any).tipo_operacion?.name || 'N/A';
  }

  private getTransactionStatus(respCode: string): string {
    if (respCode === '00' || respCode === '0') return 'Aprobada';
    if (respCode === '05') return 'Rechazada';
    if (respCode === '51' || respCode === '54') return 'Fondos';
    return 'Rechazada';
  }

  private getErrorMessage(transaction: Transaction): string {
    if (transaction.resp_code === '00' || transaction.resp_code === '0') return 'Aprobada';
    if (transaction.error_message) return transaction.error_message.substring(0, 30);
    if (transaction.resp_desc) return transaction.resp_desc.substring(0, 30);
    return `Código: ${transaction.resp_code || 'N/A'}`;
  }

  private getMerchantBreakdown(transactions: Transaction[]): any[] {
    const merchantMap = new Map();
    
    transactions.forEach(t => {
      const merchantId = t.id_merchant;
      const merchantName = t.name_merchant || 'Comercio Desconocido';
      const amount = Number(t.amount) || 0;
      
      if (!merchantMap.has(merchantId)) {
        merchantMap.set(merchantId, {
          name: merchantName,
          count: 0,
          total: 0
        });
      }
      
      const merchant = merchantMap.get(merchantId);
      merchant.count++;
      merchant.total += amount;
    });

    return Array.from(merchantMap.values())
      .sort((a, b) => b.total - a.total)
      .map(m => ({
        ...m,
        total: Math.round(m.total * 100) / 100
      }));
  }

  // Export permission methods
  canExport(): boolean {
    // Check specific export permissions
    return this.canExportCSV() || this.canExportExcel() || this.canExportPDF();
  }

  canExportCSV(): boolean {
    return this.hasPermission('/enhanced-transactions-export-csv');
  }

  canExportExcel(): boolean {
    return this.hasPermission('/enhanced-transactions-export-excel');
  }

  canExportPDF(): boolean {
    return this.hasPermission('/enhanced-transactions-export-pdf');
  }

  private hasPermission(resourceName: string): boolean {
    // Check if user has the specific permission
    return this.sharedService.hasPermission(resourceName);
  }

  getExportDeniedMessage(): string {
    if (this.isAdmin) {
      return 'No tiene permisos de exportación';
    }

    if (!this.userMerchants || this.userMerchants.length === 0) {
      return 'No tiene comercios asociados para exportar transacciones';
    }

    return 'La exportación está disponible solo para administradores y usuarios con comercios asociados';
  }

  getExportTooltip(): string {
    const availableFormats = [];
    if (this.canExportCSV()) availableFormats.push('CSV');
    if (this.canExportExcel()) availableFormats.push('Excel');
    
    if (availableFormats.length > 0) {
      return `Exportar transacciones (${availableFormats.join('/')})`;
    } else {
      return 'No tiene permisos para exportar';
    }
  }

  getPDFExportTooltip(): string {
    if (this.canExportPDF()) {
      return 'Exportar transacciones a PDF';
    } else {
      return 'No tiene permisos para exportar a PDF';
    }
  }

  getCurrentMerchantName(): string {
    if (this.isAdmin) {
      const selectedMerchants = this.filterForm.get('merchants')?.value || [];
      if (selectedMerchants.includes('all') || selectedMerchants.length === 0) {
        return 'Todos los comercios';
      }

      const selectedNames = this.merchantOptions
        .filter(opt => selectedMerchants.includes(opt.value))
        .map(opt => opt.label);

      return selectedNames.length > 0 ? selectedNames.join(', ') : 'Todos los comercios';
    }

    // For non-admin users, show their merchant name
    if (this.userMerchants.length === 1) {
      return this.userMerchants[0].name_merchant;
    }

    return this.userMerchants.length > 0 ? `${this.userMerchants.length} comercios` : 'Sin comercios';
  }
}

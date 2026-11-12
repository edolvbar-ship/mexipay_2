import { TransactionsService } from '@/app/services/movements/transactions/transactions.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CalendarComponent } from '@/app/shared/components/calendar/calendar.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { CardDounutChartComponent } from '@/app/shared/components/card-dounut-chart/card-dounut-chart.component';
import { DateRange } from '@/app/shared/interfaces/types-interface';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { CommonModule } from '@angular/common';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";
import { ProfilesService } from '@/app/services/security/profiles/profiles.service';
import { SharedService } from '@/app/services/shared/shared.service';
import { map, Observable, of, Subject, takeUntil, catchError } from 'rxjs';

@Component({
  selector: 'app-transactions',
  imports: [
    CalendarComponent,
    TableLayoutComponent,
    CardContainerComponent,
    CardDounutChartComponent,
    SectionTitleComponent,
    CommonModule,
    ActionButtonComponent,
  ],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.css'
})
export default class TransactionsComponent implements OnInit, OnDestroy {

  @ViewChild(CalendarComponent) calendarComponent!: CalendarComponent;

  constructor(
    private transactionService: TransactionsService,
    private toastSrv: ToastrService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    private profileService: ProfilesService,
    private sharedService: SharedService,
  ) {
    // Set initial dates to last 24 hours - FIXED: Use local dates
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    this.initialDates = [yesterday, now];
  }

  search: string = '';
  initialDates: Date[] = [];
  dateRange: string = '';
  movements: any[] = [];
  movementsTable: any = [];
  movementsTableFiltered: any = [];
  private allMovementsTable: any[] = [];
  isLiquidation: boolean = false;

  isLoading: boolean = true;

  donutInfoChartTxt: any = {};
  donutInfoChartCardType: any = {};
  donutInfoChartAccountType: any = {};

  profileId: string | number | undefined = undefined;
  columnsWithSum: string[] = [];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initializeSearch();
    this.sharedService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.profileId = data?.userProfile;

        if (this.profileId) {
          this.hasPermissions.subscribe(hasPermissions => {
            if (hasPermissions) {
              this.columnsWithSum = ['Monto'];
            }
          });
        }
        // Load initial data with the 24-hour range
        if (this.initialDates.length === 2) {
          // Create date range string for initial load
          const startDate = this.createLocalDate(this.initialDates[0]);
          const endDate = this.createLocalDate(this.initialDates[1]);

          // Set time to start/end of day
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);

          this.dateRange = `${startDate.toISOString()} ${endDate.toISOString()}`;

          console.log('Initial date range for API:', this.dateRange);
          console.log('Start date local:', startDate.toString());
          console.log('End date local:', endDate.toString());

          this.getElements(this.dateRange);
        }
      });
  }

  /**
   * Creates a date in local timezone (not UTC)
   * Handles both Date objects and string inputs
   */
  private createLocalDate(dateInput: Date | string): Date {
    if (typeof dateInput === 'string') {
      // Parse string to local date
      const parts = dateInput.split(/[-T:.]/).map(Number);

      if (dateInput.includes('T')) {
        // ISO string: "2025-12-11T06:00:00.000Z"
        const year = parts[0];
        const month = parts[1] - 1; // Month is 0-indexed
        const day = parts[2];
        const hour = parts[3] || 0;
        const minute = parts[4] || 0;
        const second = parts[5] || 0;
        const millisecond = parts[6] || 0;

        return new Date(year, month, day, hour, minute, second, millisecond);
      } else {
        // Date-only string: "2025-12-11"
        const year = parts[0];
        const month = parts[1] - 1; // Month is 0-indexed
        const day = parts[2] || 1;

        return new Date(year, month, day, 0, 0, 0, 0);
      }
    } else {
      // Already a Date object, create new one with local components
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

  get hasPermissions(): Observable<boolean> {
    if (!this.profileId) {
      console.warn('No profile ID available');
      return of(false);
    }

    console.log('Getting permissions for profile ID:', this.profileId);
    return this.profileService.getProfileById(this.profileId).pipe(
      takeUntil(this.destroy$),
      map(response => {
        const datos = response?.data?.datos_bancarios;
        const hasAccess = datos !== undefined && datos !== null && datos === 1;
        console.log('Profile data:', response?.data, 'Has access:', hasAccess);
        return hasAccess;
      }),
      catchError((error: any) => {
        console.error('Error in hasPermissions:', error);
        return of(false);
      })
    );
  }

  initializeSearch() {
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => {
        this.movementsTableFiltered = filteredData;
        this.cdr.detectChanges();
      });

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => {
        if (this.allMovementsTable.length > 0) {
          this.searchService.emitText(searchText, this.allMovementsTable);
        }
      });
  }

  // FIXED: Properly handle date range from calendar
  handleDates(event: DateRange) {
    try {
      console.log('Date range received:', event);
      console.log('Type of initial:', typeof event.initial, 'value:', event.initial);
      console.log('Type of final:', typeof event.final, 'value:', event.final);

      if (!event.initial || !event.final) {
        console.warn('Incomplete date range received:', event);
        this.toastSrv.warning('Por favor seleccione un rango de fechas completo');
        return;
      }

      // FIXED: Use local date creation instead of new Date(string)
      const startDate = this.createLocalDate(event.initial);
      const endDate = this.createLocalDate(event.final);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid dates received:', event);
        this.toastSrv.error('Fechas inválidas recibidas');
        return;
      }

      // Set time to start/end of day for full coverage
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      console.log('Processed dates:', {
        start: startDate.toString(),
        end: endDate.toString(),
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        startLocalHours: startDate.getHours(),
        endLocalHours: endDate.getHours(),
        startUTCHours: startDate.getUTCHours(),
        endUTCHours: endDate.getUTCHours()
      });

      // Create the date range string in the format backend expects
      this.dateRange = `${startDate.toISOString()} ${endDate.toISOString()}`;

      console.log('Formatted date range for API:', this.dateRange);

      // Reset state
      this.search = '';
      this.movementsTableFiltered = [];
      this.allMovementsTable = [];
      this.movements = [];
      this.currentPage = 1;
      this.allDataLoaded = false;
      this.totalItems = 0;
      this.totalPages = 1;

      this.searchService.emitText('', this.allMovementsTable);

      // Fetch data with the new date range
      this.getElements(this.dateRange);

    } catch (error) {
      console.error('Error handling date range:', error);
      this.toastSrv.error('Error al procesar el rango de fechas');
    }
  }

  currentPage: number = 1;
  pageSize: number = 500;
  totalItems: number = 0;
  totalPages: number = 1;
  isLoadingMore: boolean = false;
  allDataLoaded: boolean = false;

  getElements(dateRange: string, loadMore: boolean = false) {
    if (loadMore && this.allDataLoaded) return;

    if (!loadMore) {
      this.currentPage = 1;
      this.allDataLoaded = false;
      this.movements = [];
      this.movementsTableFiltered = [];
      this.allMovementsTable = [];
    }

    this.isLoading = !loadMore;
    this.isLoadingMore = loadMore;

    console.log('Fetching transactions with date range:', dateRange);

    // FIXED: Use the dateRange parameter that was passed
    this.transactionService.getMovementsAll(
      dateRange, // Use the parameter that contains the correct date range
      this.currentPage,
      this.pageSize
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: any) => {
        console.log('API Response:', {
          totalItems: response.total,
          dataLength: response.data?.length,
          hasData: !!response.data
        });

        this.totalItems = response.total || 0;
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);

        // Append new data or replace if it's the first load
        if (loadMore) {
          this.movements = [...this.movements, ...(response.data || [])];
        } else {
          this.movements = response.data || [];
        }

        // Check if we've loaded all available data
        this.allDataLoaded = this.movements.length >= this.totalItems || (response.data?.length || 0) < this.pageSize;

        console.log('Data loaded:', {
          totalLoaded: this.movements.length,
          totalExpected: this.totalItems,
          allDataLoaded: this.allDataLoaded
        });

        // Process the data
        this.getTableData();
        const withoutInitialitationData = this.deletInitialitationData(this.movements);
        this.getTotalTxt(withoutInitialitationData);
        this.getCardType(withoutInitialitationData);
        this.getProductType(withoutInitialitationData);

        // Increment page for next load if needed
        if (!this.allDataLoaded && (response.data?.length || 0) > 0) {
          this.currentPage++;
        }
      },
      error: (error) => {
        console.error('Error loading transactions:', error);
        this.toastSrv.error('Error al cargar las transacciones. Por favor, intente con un rango de fechas más pequeño.');
      },
      complete: () => {
        this.isLoading = false;
        this.isLoadingMore = false;
      }
    });
  }

  loadMoreData() {
    if (!this.isLoadingMore && !this.allDataLoaded && this.dateRange) {
      this.getElements(this.dateRange, true);
    }
  }

  deletInitialitationData(data: any) {
    return data.filter((e: any) => e.TipoT !== 'INICIALIZACION');
  }

  getTableData() {
    try {
      this.movementsTable = this.transactionService.getDataTable({ data: this.movements });

      this.movementsTableFiltered = (this.isLiquidation) ?
        this.movementsTable.filter((element: any) =>
          element["Tipo Trans."] == 'VENTA' &&
          element.Estatus == 'APROBADA' &&
          element.draftCapture == 'Si'
        ) : this.movementsTable;

      this.allMovementsTable = this.movementsTableFiltered;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error processing table data:', error);
      this.toastSrv.error('Error al procesar los datos de la tabla');
    }
  }

  getTotalTxt(data: any) {
    const approvedCount = data.filter((element: any) => element.Estatus === 'APROBADA' && element.TipoT !== 'INICIALIZACION').length;
    const rejectCount = data.filter((element: any) => element.Estatus !== 'APROBADA' && element.TipoT !== 'INICIALIZACION').length;
    this.donutInfoChartTxt = [
      { name: `${approvedCount} Aprobadas`, count: approvedCount, color: '#0C4772' },
      { name: `${rejectCount} Rechazadas`, count: rejectCount, color: '#a60d0d' }
    ];
  }

  getCardType(data: any) {
    const items = this.getTotalItems(data, 'TipoProd');
    this.donutInfoChartCardType = this.getObjectChart(items);
  }

  getProductType(data: any) {
    const items = this.getTotalItems(data, 'Método');
    this.donutInfoChartAccountType = this.getObjectChart(items);
  }

  getTotalItems(dataArray: any, key: string) {
    let registro: { [key: string]: any } = {};
    dataArray.forEach((objeto: any) => {
      let objectKey = objeto[key];
      if (registro[objectKey]) {
        registro[objectKey]++;
      } else {
        registro[objectKey] = 1;
      }
    });
    return registro;
  }

  getObjectChart(items: any): any {
    const colors = ['#0C4772', '#1F7766', '#0C4772', '#6D91AA', '#4CA8E2', '#6CB7AE'];
    return Object.entries(items).map(([key, value], index) => (
      {
        name: key.length === 0 ? 'Otras' : key,
        count: value,
        color: key.length === 0 ? '#9F9F9F' : colors[index % colors.length]
      }));
  }

  changeLiquidatibs() {
    this.isLiquidation = !this.isLiquidation;
    this.getTableData();
  }

  exportToExcel() {
    this.toastSrv.info('Generando reporte en Excel...');
    this.exportToXLSXForAdmin();
  }

  exportToPDF() {
    this.toastSrv.info('Generando reporte en PDF...');
    this.generatePDFFile();
  }


  private generateXLSXFile() {
    const headersExcel = [
      'Fecha',
      'Hora',
      'Cliente',
      'Comercio',
      'Afiliación',
      'Tarjeta',
      'Naturaleza Contable',
      'Estatus',
      'Estatus Finan.',
      'Método',
      'Terminal',
      'Tipo Entrada',
      'Tipo Trans.',
      'Folio',
      'Referencia',
      'Referencia anterior',
      'Autorización',
      'Meses',
      'Mesero',
      'Propina',
      'Monto',
      'Tasa Agregador',
      'IVA',
      'Total Comisión',
      'Agregador fija',
      'IVA 2',
      'Total Comisión Fija',
      'Total Comisiones',
      'Total IVA',
      'Gran Total',
      'Total Depositar'
    ];

    const headerKeyMap: { [key: string]: string } = {
      'Naturaleza Contable': 'TipoProd',
    };

    const filteredItems = this.movementsTableFiltered;

    const rows = filteredItems.map((item: any) => {
      return headersExcel.map(header => {
        const key = headerKeyMap[header] || header;
        const value = item[key] ?? '-';
        return value === '-' ? '-' : value;
      });
    });

    let totalSum = 0;
    if (this.columnsWithSum.length > 0) {
      const columnKey = this.columnsWithSum[0];
      totalSum = this.movementsTableFiltered.reduce((acc: number, item: { [x: string]: string; }) => {
        const value = parseFloat(item[columnKey]) || 0;
        return acc + value;
      }, 0);
    }

    const totalRow = new Array(headersExcel.length).fill('-');
    if (this.columnsWithSum.length > 0) {
      const columnIndex = headersExcel.indexOf(this.columnsWithSum[0]);
      if (columnIndex !== -1) {
        totalRow[columnIndex] = `${totalSum.toFixed(2)}`;
      }
    }
    rows.push(totalRow);

    const worksheet = XLSX.utils.aoa_to_sheet([headersExcel, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const fileName = this.isLiquidation ? 'liquidaciones' : 'transacciones';
    const xlsxFileName = `${fileName}-${this.dateRange}.xlsx`;

    XLSX.writeFile(workbook, xlsxFileName);
    console.log('XLSX file saved for internal records:', xlsxFileName);
  }

  private generatePDFFile() {
    const pdfData = this.preparePDFData();
    this.generatePDFWithjsPDF(pdfData);
    this.toastSrv.success('PDF generado para distribución');
  }

  private preparePDFData(): any {
    const headersPDF = [
      'Fecha', 'Cliente', 'Comercio', 'Tarjeta', 'Estatus',
      'Método', 'Tipo Trans.', 'Folio', 'Monto', 'Total Depositar'
    ];

    const headerKeyMap: { [key: string]: string } = {
      'Tipo Trans.': 'Tipo Trans.',
      'Total Depositar': 'Total Depositar'
    };

    const filteredItems = this.movementsTableFiltered;

    const rows = filteredItems.map((item: any) => {
      return headersPDF.map(header => {
        const key = headerKeyMap[header] || header;
        const value = item[key] ?? '-';
        return value === '-' ? '-' : value;
      });
    });

    return {
      headers: headersPDF,
      data: rows,
      summary: this.getPDFSummary(),
      dateRange: this.dateRange,
      isLiquidation: this.isLiquidation
    };
  }

  private getPDFSummary() {
    const totalTransactions = this.movementsTableFiltered.length;
    const approvedTransactions = this.movementsTableFiltered.filter((item: any) =>
      item.Estatus === 'APROBADA').length;

    let totalAmount = 0;
    if (this.columnsWithSum.length > 0) {
      const columnKey = this.columnsWithSum[0];
      totalAmount = this.movementsTableFiltered.reduce((acc: number, item: { [x: string]: string; }) => {
        const value = parseFloat(item[columnKey]) || 0;
        return acc + value;
      }, 0);
    }

    return {
      totalTransactions,
      approvedTransactions,
      rejectedTransactions: totalTransactions - approvedTransactions,
      totalAmount
    };
  }

  private generatePDFWithjsPDF(pdfData: any) {
    import('jspdf').then((jsPDFModule) => {
      import('jspdf-autotable').then((autoTableModule) => {
        const { jsPDF } = jsPDFModule;
        const { default: autoTable } = autoTableModule;

        const doc = new jsPDF('landscape'); // Changed to landscape orientation

        // Title
        const title = pdfData.isLiquidation ? 'Reporte de Liquidaciones' : 'Reporte de Transacciones';
        doc.setFontSize(16);
        doc.text(title, 14, 15);

        // Date range
        doc.setFontSize(10);
        doc.text(`Período: ${pdfData.dateRange}`, 14, 25);

        // Summary
        doc.setFontSize(12);
        doc.text(`Resumen:`, 14, 40);
        doc.setFontSize(10);
        doc.text(`- Total de transacciones: ${pdfData.summary.totalTransactions}`, 14, 50);
        doc.text(`- Aprobadas: ${pdfData.summary.approvedTransactions}`, 14, 57);
        doc.text(`- Rechazadas: ${pdfData.summary.rejectedTransactions}`, 14, 64);
        doc.text(`- Monto total: $${pdfData.summary.totalAmount.toFixed(2)}`, 14, 71);

        // Table
        autoTable(doc, {
          head: [pdfData.headers],
          body: pdfData.data,
          startY: 80,
          styles: { 
            fontSize: 8,
            cellPadding: 3,
            overflow: 'linebreak'
          },
          headStyles: { 
            fillColor: [7, 67, 117],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            textColor: 0
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { top: 80, left: 14, right: 14, bottom: 20 },
          didDrawPage: (data) => {
            // Add page number at bottom
            const pageCount = (doc as any).internal.getNumberOfPages();
            const pageCurrent = (doc as any).internal.getCurrentPageInfo().pageNumber;
            doc.setFontSize(8);
            doc.text(`Página ${pageCurrent} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
          }
        });

        const fileName = pdfData.isLiquidation ? 'liquidaciones' : 'transacciones';
        const pdfFileName = `${fileName}-${this.dateRange}.pdf`;

        doc.save(pdfFileName);
      });
    }).catch(error => {
      console.error('Error generating PDF:', error);
      this.toastSrv.error('Error al generar PDF');
      this.toastSrv.info('Usando formato XLSX como alternativa');
    });
  }

  exportToXLSXForAdmin() {
    this.hasPermissions.subscribe(hasPermissions => {
      if (hasPermissions) {
        this.generateXLSXFile();
        this.toastSrv.success('XLSX generado para registros internos');
      } else {
        this.toastSrv.warning('No tiene permisos para exportar en formato XLSX');
      }
    });
  }

  // FIXED: Proper method to handle calendar date changes
  onDateRangeChange(dateRange: DateRange) {
    console.log('Date range changed:', dateRange);
    this.handleDates(dateRange);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

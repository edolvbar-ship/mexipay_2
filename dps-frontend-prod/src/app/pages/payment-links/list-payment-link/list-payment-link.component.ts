
import { LinkService } from '@/app/services/links/link.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CalendarComponent } from '@/app/shared/components/calendar/calendar.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { CustomTableAction, DateRange } from '@/app/shared/interfaces/types-interface';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PrimeIcons } from 'primeng/api';
import { Subject, takeUntil, tap } from 'rxjs';
import * as XLSX from 'xlsx';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";

@Component({
    selector: 'app-transactions',
    imports: [
        CalendarComponent,
        TableLayoutComponent,
        CardContainerComponent,
        SectionTitleComponent,
        ActionButtonComponent
    ],
    templateUrl: './list-payment-link.component.html',
    styleUrl: './list-payment-link.component.css'
})
export default class ListPaymentLinkComponent implements OnInit, OnDestroy{

  constructor(
    private linkService: LinkService,
    private toastSrv: ToastrService,
    private searchService: SearchService,
    private toastService: ToastrService,
  ) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    this.initialDates = [sevenDaysAgo, today];
  }

  search: string = '';
  initialDates: Date[] = [];
  dateRange = ``;
  allData:any[] = [];
  linksTable:any = [];
  private allLinksTable: any[] = []

  private destroy$ = new Subject<void>();

  customActions: CustomTableAction<any>[] = [
    {
      icon: PrimeIcons.COPY,
      handler:  async (index, item) => {
        navigator.clipboard.writeText(item.link).then(() => {
          this.toastService.info('Copiado en el portapapeles.'); 
        }).catch(err => {
          this.toastService.error('No se ha podido copiar al portapapeles.'); 
        });
      }
    }
  ];

  ngOnInit(): void {
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.linksTable = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allLinksTable));
  }

  handleDates(event: DateRange){
    this.dateRange = `${event.initial} ${event.final}`
    this.getElements({ fechas: this.dateRange});
  }

  getElements(date: any) {
    this.linkService.getLinksByDateRange(date).pipe(
      tap((response) => {
        this.allData = response;
        this.getTableData();
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  getTableData(){
    this.linksTable = this.linkService.getDataTable(this.allData);
    this.allLinksTable = this.linkService.getDataTable(this.allData);
  }


  exportToExcel(){
    const headersExcel = [
      'Fecha',
      'Comercio',
      'Concepto',
      'Monto',
      'Estatus',
      'Fecha de expiración',
      'Link',
  ];

  const rows = this.linksTable.map((item: any) => {
      return [
        item.Fecha,
        item.Comercio,
        item.Concepto,
        item.Monto,
        item.Estatus,
        item["Fecha de expiración"],
        item.link
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headersExcel, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const fileName =  'Links';
    XLSX.writeFile(workbook, `${fileName}-${this.dateRange}.xlsx`);

    this.toastSrv.info('Exportando a Excel'); 
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}

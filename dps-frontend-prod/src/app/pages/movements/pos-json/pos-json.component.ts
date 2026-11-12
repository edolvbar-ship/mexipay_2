import { PosjsonService } from '@/app/services/movements/posjson/posjson.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CalendarComponent } from '@/app/shared/components/calendar/calendar.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, NgModule, OnDestroy  } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil, tap } from 'rxjs';
import * as XLSX from 'xlsx';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";
import { formatDateRangeToISO } from '@/app/utils/transformedData';

interface DateRange {
  initial: string;
  final: string;
}
@Component({
    selector: 'app-pos-json',
    imports: [
        CalendarComponent,
        TableLayoutComponent,
        CardContainerComponent,
        CommonModule,
        SectionTitleComponent,
        ActionButtonComponent
    ],
    templateUrl: './pos-json.component.html',
    styleUrl: './pos-json.component.css'
})
export default  class PosJsonComponent implements OnInit, OnDestroy {

  @ViewChild('calendarRef') calendarInput!: ElementRef;

  constructor(
    private posJSONService: PosjsonService,
    private toastSrv: ToastrService,
    private searchService: SearchService
  ) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    this.initialDates = [sevenDaysAgo, today];
  }

  isModalOpen = false;
  movements:any = {};
  jsonData:any = {};
  movementsTable: any = [];
  private allMovementsTable: any = []
  search: string = '';
  initialDates: Date[] = [];
  dateRange: string = '';
  actions = [
    {
      params: { confirm: true },
      ico: 'pi pi-ellipsis-v',
      labelOne: 'Json In',
      callbackEdit: this.printIn.bind(this),
      labelTwo: 'Json Out',
      callbackDelet: this.printOut.bind(this),
    }
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.movementsTable = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allMovementsTable));
  }

  sendSearch(search: string): void {
    this.search = search;
    if(search !== '') {
      const date = {
        fechas: `${this.dateRange}`
      };
      this.posJSONService.getDataSearched(this.search, date).subscribe(filterInformation => {
        this.movements = filterInformation;
        this.getTableData();
      });
    } else if(this.dateRange){
      // reload data on change event - calendar range.
      const date = {
        fechas: `${this.dateRange}`
      };
      this.getElements(date);
    }
  }

  handleDates(event: DateRange){
    this.dateRange = formatDateRangeToISO(event)
    this.getElements({ fechas: this.dateRange});
  }

  getElements(date: any){
    this.posJSONService.getPosJSON(date).pipe(
      tap((response => {
        this.movements = response;
        this.getTableData();
      })),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  getTableData(){
    this.movementsTable = this.posJSONService.getDataTable(this.movements);
    this.allMovementsTable = this.movementsTable
  }

  printIn(item:any){
    const { data } = this.movements;
    const row  = data.find( (element: any) => element.id_request == item["Id Request"]);
    const temp = JSON.parse(row.request);
    this.jsonData = JSON.stringify(temp, null, 2);
    this.openModal();
  }

  printOut(item:any){
    const { data } = this.movements;
    const row  = data.find( (element: any) => element.id_request == item["Id Request"]);    
    const temp = JSON.parse(row.response);
    this.jsonData = JSON.stringify(temp, null, 2);
    this.openModal();
  }

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.jsonData).then(() => {
      this.toastSrv.info('Copiado en el portapapeles.'); 
    }).catch(err => {
      this.toastSrv.error('No se ha podido copiar al portapapeles.'); 
    });
  }

  exportToExcel(){
    const headersExcel = [ 
      'Fecha', 
      'Hora', 
      'Id Request',
      'referencia',
      'URI', 
      'Método', 
      'Fecha Inicio',
      'Fecha Final',
      'Solicitud',
      'Respuesta',
    ];

    const rows = this.movements.data.map((item: any) => {
      const requestInfo = JSON.parse(item.request);
        return [
            item.fecha_,
            item.fecha_hora,
            item.id_request,
            (requestInfo.reference != undefined) ? requestInfo.reference : '-',
            item.uri,
            item.method,
            item.f_i,
            item.f_f,
            item.request,  
            item.response, 
        ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headersExcel, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const fileName = `posjson-${this.dateRange}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    this.toastSrv.info('Exportando a Excel'); 

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


}

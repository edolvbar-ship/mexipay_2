import { ContrachargesService } from '@/app/services/movements/contracharges/contracharges.service';
import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CalendarComponent } from '@/app/shared/components/calendar/calendar.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { CardDounutChartComponent } from '@/app/shared/components/card-dounut-chart/card-dounut-chart.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { DateRange } from '@/app/shared/interfaces/types-interface';
import { formatDateRangeToISO } from '@/app/utils/transformedData';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil, tap } from 'rxjs';
import * as XLSX from 'xlsx';



@Component({
    selector: 'app-contracharges',
    imports: [CommonModule, CalendarComponent, TableLayoutComponent, CardContainerComponent, SectionTitleComponent, ActionButtonComponent, CardDounutChartComponent
    ],
    templateUrl: './contracharges.component.html',
    styleUrl: './contracharges.component.css'
})
export default class ContrachargesComponent implements OnDestroy{

  initialDates: Date[] = [];
  dateRange: string = '';

  isLoading: boolean = true;

  donutInfoChartTxt: any = {};
  donutInfoChartCardType: any = {};
  donutInfoChartAccountType: any = {};

  movementsTable: any[] = [];

  constructor(
    private contrachargeService: ContrachargesService,
    private toastSrv: ToastrService,
  ) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    this.initialDates = [sevenDaysAgo, today];
  }

  actions = [
    {
      //callbackDelet: this.deleteItem.bind(this),
      params: { confirm: true },
      ico: 'pi pi-ellipsis-v',
      labelOne: 'Editar',
      labelTwo: 'Eliminar',
      //callbackEdit: this.editItem.bind(this)
    }
  ];

  movements: any[] = [];

  private destroy$ = new Subject<void>();


  handleDates(event: DateRange) {
    this.dateRange = formatDateRangeToISO(event)
    this.getElements({ fechas: this.dateRange });
  }


  getElements(date: any) {
    this.contrachargeService.getMovements(date).pipe(
      tap((response: any) => {
        if (response && response.data) {
          this.movementsTable = response || [];
          this.getTableData();
          this.getTotalTxt(response.data);
          this.getCardType(response.data);
          this.getProductType(response.data);
        } else {
          this.movementsTable = [];
        }
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }
  

  getTableData(){
    this.isLoading = true;

    this.isLoading = false;

  }

  getTotalTxt(data: any) {
    if (!Array.isArray(data)) {
      return;
    }
    const approvedCount = data.filter((element: any) => element.Estatus === 'APROBADA').length;
    const rejectCount = data.filter((element: any) => element.Estatus !== 'APROBADA').length;
    this.donutInfoChartTxt = [
      { name: `${approvedCount} Aprobadas`, count: approvedCount, color: '#613ECE' },
      { name: `${rejectCount} Rechazadas`, count: rejectCount, color: '#87CFF9' }
    ];
  }
  

  getCardType(data: any){
    const items = this.getTotalItems(data, 'TipoProd')
    this.donutInfoChartCardType = this.getObjectChart(items)
  }

  getProductType(data: any){
    const items = this.getTotalItems(data, 'Método')
    this.donutInfoChartAccountType = this.getObjectChart(items)
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
    const colors = ['#613ECE', '#87CFF9', '#F987CB']
    return Object.entries(items).map(([key, value],index) => (
    {
      name: key.length === 0 ? 'Otras' : key,
      count: value,
      color: key.length === 0 ? '#9F9F9F' : colors[index % colors.length]
    }));
  }


  exportToExcel() {
    if (!Array.isArray(this.movementsTable)) {
      this.toastSrv.error('No hay datos para exportar.');
      return;
    }
  
    const headersExcel = [
      'Id', 'Fecha', 'Fecha Cargo', 'Afiliación', 'Tarjeta', 'Tipo CC',
      'Monto', 'Referencia', 'Autorización', 'Razón', 'Folio', 'Comentarios',
    ];
  
    const rows = this.movementsTable.map((item: any) => {
      return [
        item['Id'] || '',
        item['Fecha'] || '',
        item['Fecha Cargo'] || '',
        item['Afiliación'] || '',
        item['Tarjeta'] || '',
        item['Tipo CC'] || '',
        item['Monto'] || '',
        item['Referencia'] || '',
        item['Autorización'] || '',
        item['Razón'] || '',
        item['Folio'] || '',
        item['Comentarios'] || '',
      ];
    });
  
    const worksheet = XLSX.utils.aoa_to_sheet([headersExcel, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  
    const fileName = 'contracargos';
    XLSX.writeFile(workbook, `${fileName}-${this.dateRange}.xlsx`);
  
    this.toastSrv.info('Exportando a Excel');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import { DevicesService } from '@/app/services/devices/devices.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { ShowDevicesDataInterface } from '@/app/shared/interfaces/devices.interface';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { catchError, of, Subject, takeUntil, tap } from 'rxjs';

@Component({
    selector: 'app-devices',
    imports: [SectionTitleComponent, CardContainerComponent, TableLayoutComponent, TextTitleComponent, CommonModule ],
    templateUrl: './devices.component.html',
    styleUrl: './devices.component.css'
})
export class DevicesComponent implements OnInit, OnDestroy {

  constructor(
    private deviceService: DevicesService,
    private searchService: SearchService,
  ) { }

  devices: ShowDevicesDataInterface[] = [];
  allDevices: ShowDevicesDataInterface[] = [];
  search: string = '';
  isLoading: boolean = false;
  hiddenColumns: string[] = ['email', 'version', 'status', 'firmware']
  detailDevice: any = null;
  actions: any[] = [
    {
      callback: this.getDevice.bind(this),
      params: { confirm: true },
      ico: 'pi pi-eye',
    }
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadData();

    this.searchService.DataObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(filteredData => this.devices = filteredData);

    this.searchService.textObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe(searchText => this.searchService.emitText(searchText, this.allDevices));
  }


  loadData(): void {
    this.deviceService.getDevices().pipe(
      tap(devices => {
        this.devices = devices
        this.allDevices = devices
      }),
      catchError(error => {
        console.error('Error trayendo datos', error);
        return of([]);
      }),
      takeUntil(this.destroy$)).subscribe()
  }

  getDevice(data: any, toggleAction: boolean): void {
    data.status ? 'Activo' : 'Inactivo';
    const device = data;
    const isVissible = toggleAction
    this.controllData(device, isVissible)
  }

  controllData(data: any, isVissible: boolean) {
    this.isLoading = true;
    this.detailDevice = null
    if (isVissible) {
      setTimeout(() => {
        this.detailDevice = data;
        this.isLoading = false;
      }, 500)

    } else {
      this.detailDevice = null;
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}

import { endpoints } from '@/app/config/endpoints.config';
import { DevicesInterface, ShowDevicesDataInterface } from '@/app/shared/interfaces/devices.interface';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DevicesService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.devices);
  dataSearch: ShowDevicesDataInterface[] = [];
  private dataRecoveredSubject = new BehaviorSubject<any>([])
  dataRecovered$= this.dataRecoveredSubject;

  getDevices(): Observable<ShowDevicesDataInterface[]>{
    return this.http.post<DevicesInterface>(this.API_URL, {})
      .pipe( 
        tap((response: any) => this.dataRecoveredSubject.next(response)),
        map(this.getDataTable),
        catchError(error => {
          return throwError(() => error);
        })
      )
    }

    private getDataTable(response: DevicesInterface): ShowDevicesDataInterface[] {
      const devicesList: ShowDevicesDataInterface[] = response.data.map( device => {
        return  {
          Cliente: device.name,
          Comercio: device.name_merchant,
          Afiliación: device.afiliation_number,
          Dispositivo: device.serial,
          SO: device.os_version,
          Terminal: device.uuid,
          Usuario: device.email,
          email: device.email,
          version: device.app_version,
          status: device.active,
          firmware: device.firmware

        }
      })
      return devicesList;
    }

    getDataSearched(search: string): Observable<ShowDevicesDataInterface[]> {
      return this.getDevices().pipe(
        map(devices => this.filterData(search, devices))
      );
    }

    private filterData(search: string, devices: ShowDevicesDataInterface[]): ShowDevicesDataInterface[] {
      return this.dataSearch = devices.filter(device =>
        device.Cliente.toLowerCase().includes(search.toLowerCase()) ||
        device.Comercio.toLowerCase().includes(search.toLowerCase()) ||
        device.Afiliación.toLowerCase().includes(search.toLowerCase()) ||
        device.Dispositivo.toLowerCase().includes(search.toLowerCase()) ||
        device.SO.toLowerCase().includes(search.toLowerCase()) ||
        device.Terminal.toLowerCase().includes(search.toLowerCase()) ||
        device.Usuario.toString().includes(search));
    }
}
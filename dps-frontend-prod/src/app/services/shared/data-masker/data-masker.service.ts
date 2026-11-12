import { DatePipe } from '@angular/common';
import { Injectable } from '@angular/core';
import { NgxMaskService } from 'ngx-mask';

@Injectable({
  providedIn: 'root',
  
})
export class DataMaskerService {

  private masks: { [key: string]: string } = {
    mobile_contact: '(00)-000-0000',
    tel1_contact: '(00)-000-0000',
    t_credito: 'separator.2',
    t_debito: 'separator.2',
    t_amex: 'separator.2'
  };

  constructor(private maskApplierService: NgxMaskService, private datePipe: DatePipe ) {}

  applyMasks(dataObject: { [key: string]: string }): { [key: string]: string } {
    const maskedData: { [key: string]: string } = {};

    for (const key in dataObject) {
      if (this.masks[key]) {
        maskedData[key] = this.maskApplierService.applyMask(dataObject[key], this.masks[key]);
        if (key === 't_amex' || key === 't_debito'|| key === 't_credito' ) {
          //TODO: esto se puede mejorar trayendo la data de un array
          maskedData[key] += '%';
        }
      } else if (key === 'creation_date' || key === 'last_update') {
        maskedData[key] = this.applyDateMask(dataObject[key]);
      } else {
        maskedData[key] = dataObject[key];
      }
    }
    return maskedData;
  }

  //TODO: aplicar este método a las fechas necesarias, pasarlo a utils

  private applyDateMask(isoDateString: string): string {
    const date = new Date(isoDateString);
    return this.datePipe.transform(date, 'dd / MMM / yyyy, HH:mm:ss') || '';
  }

}

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '@/app/services/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {

  constructor(
    private http: HttpClient,
    private toastService: ToastrService,
    private authService: AuthService
  ) { }

  private API_URL = `${endpoints.apiBaseUrl}`;

  getConsolidationFile(data:any):any{

    const token = this.authService.getToken();
      fetch(`${this.API_URL}/report/consolidation/${data.day}/${data.client}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error en la descarga del archivo');
        }
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.date}-dispersión.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        this.toastService.success(`Archivo descargado.`);
      })
      .catch(error => {
        this.toastService.info(`Es necesario que se llenen todos los campos para poder descargar el archivo.`);
      });
  }

  getConsolidationUrl = (data:any) => {
    return `${this.API_URL}/report/consolidation/${data.day}/${data.cliente}`
  }

  getAccountState( data:any ):any{
    const token = this.authService.getToken();
      fetch(`${this.API_URL}/report/estados/make`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...data })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error en la descarga del archivo');
        }
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Estado-Cuenta.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        this.toastService.success(`Archivo descargado.`);
      })
      .catch(error => {
        this.toastService.info(`Es necesario que se llenen todos los campos para poder descargar el archivo.`);
      });


  }
  
}

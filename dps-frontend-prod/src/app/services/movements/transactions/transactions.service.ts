import { endpoints } from '@/app/config/endpoints.config';
import { MovementsAllInterface } from '@/app/shared/interfaces/movements/transactions/transactions';
import { transformedTime } from '@/app/utils/transformedData';
import { transformedDate, utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TransactionsService {

  constructor(private http: HttpClient) { }

  private API_URL: string = utils.buildUrl(endpoints.apiV02, endpoints.movements);
  dataSearch: any[] = [];

  getMovementsAll(fechas: any, page: number = 1, pageSize: number = 500): Observable<{data: any[], total: number, page: number, pageSize: number}> {
    // The date range should already be in the format "YYYY-MM-DDTHH:mm:ss.SSSZ YYYY-MM-DDTHH:mm:ss.SSSZ"
    console.log("Received:", fechas )
    let dateRange = fechas || '';

    // If no date range is provided, default to last 24 hours
    if (!dateRange) {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setHours(now.getHours() - 24);

      // Format dates with proper milliseconds and timezone
      const formatDate = (date: Date) => {
        const pad = (num: number) => num.toString().padStart(3, '0');
        const ms = pad(date.getMilliseconds());
        const iso = date.toISOString();
        return iso.replace(/\.\d+/, `.${ms}`);
      };

      dateRange = `${formatDate(yesterday)} ${formatDate(now)}`;
    }

    const params = {
      fechas: dateRange,
      page: page.toString(),
      pageSize: pageSize.toString()
    };

    console.log('Sending request to /all with params:', JSON.stringify(params, null, 2));

    return this.http.post<any>(`${this.API_URL}/all`, params).pipe(
      map((response: any) => {
        console.log('Received transactions response:', {
          count: response.data?.length || 0,
          total: response.total || 0,
          page: page,
          pageSize: pageSize
        });

        return {
          data: response.data || [],
          total: response.total || 0,
          page: page,
          pageSize: pageSize
        };
      }),
      catchError(error => {
        console.error('Error fetching transactions:', {
          error: error,
          status: error.status,
          message: error.message,
          url: error.url,
          params: params
        });
        return throwError(() => error);
      })
    );
  }
getDataTable(response: any): any[] {
  const dataList: MovementsAllInterface[] = response.data
    .filter((movements: any) => movements.TipoT !== 'INICIALIZACION')
    .map((movements: any) => {
      // ALWAYS compute Monto from raw cents field – works for both modes
      const rawCents = movements.reg?.amount ?? movements.amount ?? '0';
      const montoCorrecto = this.formatAmountFromCents(rawCents);

      return {
        Fecha: transformedDate(movements.reg.creation_date),
        Hora: transformedTime(movements.reg.creation_date),
        Cliente: movements.Cliente,
        Comercio: movements.Comercio,
        Afiliación: movements.Afiliación,
        Tarjeta: movements.Tarjeta,
        TipoProd: movements.TipoProd,
        'Tipo Entrada': movements.entryMode,
        Estatus: movements.Estatus,
        'Estatus Finan.': movements.EstatusF,
        Método: movements.Método,
        Terminal: movements.Terminal,
        'Tipo Trans.': movements.TipoT,
        Folio: movements.reg.folio,
        Referencia: movements.reg.reference_number,
        draftCapture: movements.reg.draft_capture == '1' ? 'Si' : 'No',
        'Referencia Anterior': movements.reg.reference_number_ant,
        Autorización: movements.Autorización,
        Meses: movements.msi_months,
        Mesero: movements.mesero,
        Propina: movements.propina,
        Monto: parseFloat(this.formatAmountFromCents(
          movements.reg?.amount ??          // ✅ CORRECT - always use raw cents from database
          movements.amount ??               // Fallback to raw amount
          '0'
        )),
        'Tasa Agregador': movements.MPHS1,
        IVA: movements.IVA1,
        'Total Comisión': movements.TotalC1,
        'Agregador fija': movements.MPHS2,
        'IVA 2': movements.IVA2,
        'Total Comisión Fija': movements.TotalC2,
        'Total Comisiones': movements.TotalC,
        'Total IVA': movements.TotalI,
        'Gran Total': movements.GranT,
        'Total Depositar': movements.TotalFinal,
      };
    });

  return dataList;
}

// Add this private method in the same service class
private formatAmountFromCents(amount: string | number): string {
  if (!amount) return '0.00';
  
  // Convert to number first to ensure proper arithmetic
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) return '0.00';
  
  // If already has decimal point (e.g. from liquidation), just fix precision
  if (String(amount).includes('.')) {
    return numericAmount.toFixed(2);
  }
  
  // Convert cents to dollars (divide by 100)
  const dollars = numericAmount / 100;
  return dollars.toFixed(2);
}

  getDataSearched(search: string, date: any): Observable<any> {
    // For search, we'll need to fetch all data and filter client-side
    // This could be optimized further with a server-side search endpoint
    return this.getMovementsAll(date, 1, 10000).pipe(
      map((response: any) => ({
        ...response,
        data: this.filterData(search, { data: response.data })
      }))
    );
  }

  private filterData(search: string, data: any): any {
    const searchLower      = search.toLowerCase();
    this.dataSearch = data.data.filter( (item:any) => {
      return  (typeof item["Fecha"] === 'string' && item["Fecha"].toLowerCase().includes(searchLower)) ||
              (typeof item["Hora"] === 'string' && item["Hora"].toLowerCase().includes(searchLower)) ||
              (typeof item["Cliente"] === 'string' && item["Cliente"].toLowerCase().includes(searchLower)) ||
              (typeof item["Comercio"] === 'string' && item["Comercio"].toLowerCase().includes(searchLower)) ||
              (typeof item["Afilación"] === 'string' && item["Afilación"].toLowerCase().includes(searchLower)) ||
              (typeof item["TipoProd"] === 'string' && item["TipoProd"].toLowerCase().includes(searchLower)) ||
              (typeof item["idTrans"] === 'string' && item["idTrans"].toLowerCase().includes(searchLower)) ||
              (typeof item["Estatus"] === 'string' && item["Estatus"].toLowerCase().includes(searchLower)) ||
              (typeof item["EstatusF"] === 'string' && item["EstatusF"].toLowerCase().includes(searchLower)) ||
              (typeof item["Método"] === 'string' && item["Método"].toLowerCase().includes(searchLower)) ||
              (typeof item["Terminal"] === 'string' && item["Terminal"].toLowerCase().includes(searchLower)) ||
              (typeof item["TipoT"] === 'string' && item["TipoT"].toLowerCase().includes(searchLower)) ||
              (typeof item["Autorización"] === 'string' && item["Autorización"].toLowerCase().includes(searchLower)) ||
              (typeof item["Monto"] === 'string' && item["Monto"].toLowerCase().includes(searchLower)) ||
              (typeof item["MPHS1"] === 'string' && item["MPHS1"].toLowerCase().includes(searchLower)) ||
              (typeof item["IVA1"] === 'string' && item["IVA1"].toLowerCase().includes(searchLower)) ||
              (typeof item["TotalC1"] === 'string' && item["TotalC1"].toLowerCase().includes(searchLower)) ||
              (typeof item["MPHS2"] === 'string' && item["MPHS2"].toLowerCase().includes(searchLower)) ||
              (typeof item["IVA2"] === 'string' && item["IVA2"].toLowerCase().includes(searchLower)) ||
              (typeof item["TotalC2"] === 'string' && item["TotalC2"].toLowerCase().includes(searchLower)) ||
              (typeof item["tbanco"] === 'string' && item["tbanco"].toLowerCase().includes(searchLower)) ||
              (typeof item["TotalC"] === 'string' && item["TotalC"].toLowerCase().includes(searchLower)) ||
              (typeof item["TotalI"] === 'string' && item["TotalI"].toLowerCase().includes(searchLower)) ||
              (typeof item["GranT"] === 'string' && item["GranT"].toLowerCase().includes(searchLower)) ||
              (typeof item["TotalFinal"] === 'string' && item["TotalFinal"].toLowerCase().includes(searchLower)) ||
              (typeof item["propina"] === 'string' && item["propina"].toLowerCase().includes(searchLower)) ||
              (typeof item["mesero"] === 'string' && item["mesero"].toLowerCase().includes(searchLower)) ||
              (typeof item.reg.folio === 'string' && item.reg.folio.toLowerCase().includes(searchLower)) ||
              (typeof item["msi_months"] === 'string' && item["msi_months"].toLowerCase().includes(searchLower));

      });

      return { data: this.dataSearch};
  }



}

import { endpoints } from '@/app/config/endpoints.config';
import { ShowDataTicket, TicketDownloadInterface, TicketEmailInterface, TicketEmailResponseInterface, TicketsDataInterface, TicketsInterface } from '@/app/shared/interfaces/movements/tickets.interface';
import { transformedDate, transformedTime } from '@/app/utils/transformedData';
import { utils } from '@/app/utils/utils';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TicketsService {


  private API_URL: string = utils.buildUrl(endpoints.apiV02, endpoints.tickets);
  private API_BASE_URL = endpoints.apiBaseUrl;

  tickets: ShowDataTicket[] = [];
 
  constructor(private http: HttpClient) { }

  getTickets(dates: string): Observable<TicketsDataInterface[]> {
    return this.http.post<TicketsInterface>(this.API_URL, {fechas: dates}).pipe(
      map( response => response.data),
      catchError(error => {
        return throwError(() => error)
      })
    );
  }

  getTicketsSummary(dates: string): Observable<ShowDataTicket[]> {
    return this.getTickets(dates).pipe(
      map(tickets => {
        this.tickets = tickets.map(ticket => {
          const data = { ...ticket, F1: transformedDate(ticket.creation_date), F2: transformedTime(ticket.creation_date) };
  
          return {
            'Fecha': transformedDate(ticket.creation_date) || '',
            'Hora': transformedTime(ticket.creation_date) || '',
            'Banco adquirente': ticket.merchant_por_id?.banco_adq.name || '-',
            comercio: ticket.merchant_por_id?.name_merchant || '-',
            'afiliación': ticket.merchant_por_id?.afiliation_number || '-',
            'No. Referencia': ticket.reference_number,
            'Monto': ticket.amount,
            '4 Dígitos': ticket.last4 || '',
            'Mesero': ticket.more_info.waiter || '',
            metadata: {
              originalData: JSON.stringify(data)
            }
          };
        });
        return this.tickets;
      })
    );
  }
  

  getTicketPdf(ticket: ShowDataTicket): Observable<TicketDownloadInterface> {
    return this.http.post<TicketDownloadInterface>(`${endpoints.apiBaseUrl}/${endpoints.downloadTicket}`, { data: ticket.metadata?.originalData }).pipe(
      catchError(error => {
        return throwError(() => error)
      })
    );
  }


  getTicketPdfWhitBlob(ticket: ShowDataTicket): Observable<TicketDownloadInterface> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/pdf',
      Accept: 'application/pdf',
    });
    return this.getTicketPdf(ticket).pipe(
      switchMap( ticketInfo =>  this.http.get(ticketInfo.path, { headers, responseType: 'blob' }).pipe(
        map( blob => ({ ...ticketInfo, blob })))
      ))
  }


  getDataSearched(search: string): Observable<ShowDataTicket[]> {
    return of(this.tickets).pipe(
      map(tickets => this.filterData(search, tickets))
    );
  }
  
  private filterData(search: string, tickets: ShowDataTicket[]): ShowDataTicket[] {
    const searchLower = search.toLowerCase();
    
    return tickets.filter(ticket => {
        return ticket['Fecha'].toString().includes(searchLower) ||
              ticket['Hora'].toLowerCase().includes(searchLower) ||
              ticket['Banco adquirente'].toLowerCase().includes(searchLower) ||
              ticket['comercio'].toLowerCase().includes(searchLower) ||
              ticket['afiliación'].toLowerCase().includes(searchLower) ||
              ticket['No. Referencia'].toLowerCase().includes(searchLower) ||
              ticket['Monto'].toLowerCase().includes(searchLower) ||
              ticket['4 Dígitos'].toLowerCase().includes(searchLower) ||
              ticket['Mesero'].toLowerCase().includes(searchLower);
    });
  }


  sendByEmail(ticket: TicketEmailInterface): Observable<TicketEmailResponseInterface> {
    return this.http.post<TicketEmailResponseInterface>(`${this.API_BASE_URL}/api/getTicket`, ticket).pipe(
      catchError(error => {
        return throwError(() => error)
      })
    );
  }

  
}

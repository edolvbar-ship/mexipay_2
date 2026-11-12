import { endpoints } from '@/app/config/endpoints.config';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MovementsDetailService {
  private API_URL: string;

  constructor(private http: HttpClient) {
    this.API_URL = utils.buildUrl(endpoints.apiV02, `${endpoints.movements}/summary`);
  }

  getSummary(dateRange: { fechas: string }): Observable<any> {
    if (!dateRange?.fechas) {
      throw new Error('Date range is required');
    }

    // Parse the date range string to validate it
    const [startDateStr, endDateStr] = dateRange.fechas.split(' ');
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format in date range');
    }

    // Ensure the date range is reasonable (max 90 days)
    const maxDays = 90;
    const maxEndDate = new Date(startDate);
    maxEndDate.setDate(startDate.getDate() + maxDays);
    
    if (endDate > maxEndDate) {
      console.warn(`Date range exceeds ${maxDays} days. Adjusting end date.`);
      dateRange.fechas = `${startDateStr} ${maxEndDate.toISOString()}`;
    }

    console.log('Sending request to:', this.API_URL);
    console.log('With date range:', dateRange);

    return this.http.post<any>(this.API_URL, dateRange).pipe(
      tap({
        next: (response) => {
          console.log('Received response with data points:', 
            response?.label?.length || 0);
        },
        error: (error) => {
          console.error('Error in getSummary:', error);
        }
      }),
      catchError(error => {
        console.error('Error in getSummary (catchError):', error);
        throw error;
      })
    );
  }
}

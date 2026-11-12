import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '@/app/services/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || ''}`
    });
  }

  getMyActivities(limit: number = 50, offset: number = 0, filters: any = {}): Observable<any> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    // Add filter parameters
    if (filters.search) params = params.set('search', filters.search);
    if (filters.action) params = params.set('action', filters.action);
    if (filters.statusCode) params = params.set('statusCode', filters.statusCode);
    if (filters.method) params = params.set('method', filters.method);
    
    // Convert datetime-local to ISO format for URL safety
    if (filters.startDate) {
      const isoStartDate = new Date(filters.startDate).toISOString();
      params = params.set('startDate', isoStartDate);
    }
    if (filters.endDate) {
      const isoEndDate = new Date(filters.endDate).toISOString();
      params = params.set('endDate', isoEndDate);
    }

    console.log('🔍 Fetching activities with filters:', filters);
    console.log('📡 API params:', params.toString());

    return this.http.get(`${this.apiUrl}/api/v2/activities/my-activities`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(error => {
        console.error('❌ Error fetching my activities:', error);
        console.error('🌐 Error URL:', error.url);
        console.error('📊 Error status:', error.status);
        return throwError(() => new Error(error.message || 'Failed to fetch activities'));
      })
    );
  }

  getAllActivities(page: number = 1, limit: number = 50, userId?: number, action?: string): Observable<any> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    if (userId) params = params.set('userId', userId.toString());
    if (action) params = params.set('action', action);
    return this.http.get(`${this.apiUrl}/api/activities/all`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(error => {
        console.error('Error fetching all activities:', error);
        return throwError(() => new Error(error.message || 'Failed to fetch activities'));
      })
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  MsiNationalBin,
  MsiBinRange,
  MsiBinFormData,
  MsiValidationResult,
  MsiBinValidationRequest,
  MsiWebserviceResponse
} from '../shared/interfaces/msi.interface';

@Injectable({
  providedIn: 'root'
})
export class MsiBinesService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Get all Mexican BIN ranges for MSI
   */
  getNationalBines(): Observable<MsiNationalBin[]> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.get<MsiNationalBin[]>(
      `${this.baseUrl}/msi-bins/national`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Add new Mexican BIN range
   */
  addNationalBin(binData: MsiBinFormData): Observable<MsiNationalBin> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<MsiNationalBin>(
      `${this.baseUrl}/msi-bins/national`,
      binData,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update existing Mexican BIN range
   */
  updateNationalBin(id: number, binData: MsiBinFormData): Observable<MsiNationalBin> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.put<MsiNationalBin>(
      `${this.baseUrl}/msi-bins/${id}`,
      binData,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Remove Mexican BIN range
   */
  removeNationalBin(id: number): Observable<void> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.delete<void>(
      `${this.baseUrl}/msi-bins/${id}`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Check BIN eligibility for MSI via terminal webservice
   */
  checkBinEligibility(request: MsiBinValidationRequest): Observable<MsiWebserviceResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<MsiWebserviceResponse>(
      `${this.baseUrl}/msi-bins/check-eligibility`,
      request,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Validate BIN format and check eligibility
   */
  validateBin(bin: string): MsiValidationResult {
    // Basic BIN format validation
    if (!bin || bin.length < 6) {
      return {
        is_mexican: false,
        is_msi_eligible: false,
        bin_info: null,
        error: 'BIN must be at least 6 digits'
      };
    }

    if (!/^\d+$/.test(bin)) {
      return {
        is_mexican: false,
        is_msi_eligible: false,
        bin_info: null,
        error: 'BIN must contain only digits'
      };
    }

    // Check against known Mexican BIN ranges (hardcoded for now)
    const mexicanBinRanges: MsiBinRange[] = [
      { start: '400000', end: '499999', brand: 'Visa', active: true },
      { start: '510000', end: '559999', brand: 'Mastercard', active: true },
      { start: '340000', end: '349999', brand: 'Amex', active: true }
    ];

    const isMexican = mexicanBinRanges.some(range =>
      bin >= range.start && bin <= range.end && range.active
    );

    const binInfo = mexicanBinRanges.find(range =>
      bin >= range.start && bin <= range.end
    );

    return {
      is_mexican: isMexican,
      is_msi_eligible: isMexican,
      bin_info: binInfo ? {
        brand: binInfo.brand,
        range: `${binInfo.start}-${binInfo.end}`,
        bank_name: binInfo.bank_name
      } : null
    };
  }

  /**
   * Get BIN bank information
   */
  getBinBankInfo(bin: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.get<any>(
      `${this.baseUrl}/msi-bines/bank-info/${bin}`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Bulk import BIN ranges
   */
  importBinRanges(binRanges: MsiBinFormData[]): Observable<MsiNationalBin[]> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<MsiNationalBin[]>(
      `${this.baseUrl}/msi-bines/import`,
      { bin_ranges: binRanges },
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Export BIN ranges to CSV
   */
  exportBinRanges(): Observable<Blob> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.get(
      `${this.baseUrl}/msi-bines/export`,
      {
        headers,
        responseType: 'blob'
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get BIN statistics
   */
  getBinStatistics(): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.get<any>(
      `${this.baseUrl}/msi-bines/statistics`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Activate/deactivate BIN range
   */
  toggleBinRange(id: number, active: boolean): Observable<MsiNationalBin> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.put<MsiNationalBin>(
      `${this.baseUrl}/msi-bins/${id}`,
      { active },
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('MSI Bines Service Error:', error);

    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.error?.data || error.message}`;
    }

    return throwError(() => new Error(errorMessage));
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface MsiConfig {
  id_merchant: number;
  name_merchant: string;
  msi_config: Array<{
    type: string;
    min_mount: string;
    percent: string;
  }>;
  enabled: boolean;
  enabled_operations: Array<{
    id_operation: number;
    name: string;
    msi_enabled: number;
  }>;
  national_only: boolean;
  token_q6_supported: boolean;
  months_options: number[];
  min_amounts: { [key: number]: number };
  last_updated: string;
}

export interface MsiUpdate {
  months: number;
  min_amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class MsiConfigService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Get MSI configuration for a merchant
   */
  getMsiConfig(idMerchant: number): Observable<MsiConfig> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.get<MsiConfig>(
      `${this.baseUrl}/merchants/${idMerchant}/msi-config`,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update MSI configuration for a merchant
   */
  updateMsiConfig(idMerchant: number, updates: MsiUpdate[]): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      msi_updates: updates
    };

    return this.http.put(
      `${this.baseUrl}/merchants/${idMerchant}/msi-config`,
      body,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get MSI configuration via terminal webservice
   */
  getMsiConfigForTerminal(idMerchant: number, terminalId: string, authToken: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      id_merchant: idMerchant,
      terminal_id: terminalId,
      auth_token: authToken
    };

    return this.http.post(
      `${this.baseUrl}/terminal/msi-config`,
      body,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update MSI configuration via terminal webservice
   */
  updateMsiConfigForTerminal(
    idMerchant: number,
    terminalId: string,
    authToken: string,
    updates: MsiUpdate[]
  ): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      id_merchant: idMerchant,
      terminal_id: terminalId,
      auth_token: authToken,
      msi_updates: updates
    };

    return this.http.put(
      `${this.baseUrl}/terminal/msi-config`,
      body,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Validate BIN for MSI eligibility via terminal webservice
   */
  validateBinForTerminal(
    bin: string,
    idMerchant: number,
    terminalId: string,
    authToken: string
  ): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      bin: bin,
      id_merchant: idMerchant,
      terminal_id: terminalId,
      auth_token: authToken
    };

    return this.http.post(
      `${this.baseUrl}/terminal/validate-bin`,
      body,
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('MSI Config Service Error:', error);

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

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { AuthService } from '@/app/services/auth/auth.service';

export interface Transaction {
  id_message: number;
  id_merchant: number;
  name_merchant: string;
  terminal: string;
  msg_type: string;
  reference_number: string;
  amount: number;
  amount_cents?: number; // ✅ NEW: Amount in cents (consistent with TransactionContext)
  resp_code: string;
  status_type: string;
  resp_code_info?: { description: string; terminalMessage?: string; type?: string };
  authorization: string;
  bin: string;
  last4: string;
  creation_date: string;
  id_operation: string;
  estatus_f: number;
  card_type: string;
  tran_date: string;
  tran_time: string;
  capture_date: string;
  card_acceptor: string;
  folio: string;
  trace_number: string;
  entry_mode: string;
  reverse_code: string;
  draft_capture: string;
  more_info?: string;
  error_message?: string; // Error message from payment processor
  resp_desc?: string; // Response description
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  status?: string[];
  cardTypes?: string[];
  merchants?: string[];
  amountMin?: number;
  amountMax?: number;
  merchantIds?: number[];
}

export interface TransactionResponse {
  success: boolean;
  responseCodeLabels?: { [key: string]: { description: string; terminalMessage?: string; type?: string } };
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  statistics: {
    total: number;
    approved: number;
    rejected: number;
    approvalRate: number;
    totalAmount: number;
    approvedAmount: number;
  };
}

export interface TransactionStats {
  date: string;
  total_transactions: number;
  approved_transactions: number;
  rejected_transactions: number;
  total_amount: number;
  approved_amount: number;
}

export interface Merchant {
  id_merchant: number;
  name_merchant: string;
  client_name: string;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeDetails: boolean;
  transactionIds?: number[];
}

export interface TransactionSummary {
  totalTransactions: number;
  totalAmount: number;
  approvedTransactions: number;
  rejectedTransactions: number;
  approvalRate: number;
  dailyStats: TransactionStats[];
  averageTransactionValue: number;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedTransactionsService {
  private apiUrl = utils.buildUrl(endpoints.apiV02, 'movements/enhanced-transactions');

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private buildParams(filters: TransactionFilters): HttpParams {
    console.log('🔧 service buildParams received filters:', filters);

    // Clean the filters object: remove undefined/null/empty values
    const cleanFilters: any = {};
    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof TransactionFilters];
      if (value !== undefined && value !== null &&
          !(Array.isArray(value) && value.length === 0) &&
          !(typeof value === 'string' && value.trim() === '')) {
        cleanFilters[key] = value;
      }
    });

    const params = new HttpParams({ fromObject: cleanFilters });
    console.log('🔧 service buildParams final HttpParams:', params.toString());
    return params;
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);

      // Extract error message from backend response
      let errorMessage = 'An error occurred';
      if (error.error && error.error.error) {
        errorMessage = error.error.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Return user-friendly error
      return throwError(() => ({
        success: false,
        error: errorMessage,
        details: error
      }));
    };
  }

  // Get transactions with filtering and pagination
  getTransactions(filters: TransactionFilters = {}): Observable<TransactionResponse> {
    const params = this.buildParams(filters);

    return this.http.get<any>(`${this.apiUrl}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Failed to load transactions');
        }
        return response;
      }),
      catchError(this.handleError<TransactionResponse>('getTransactions'))
    );
  }

  // Get specific transaction by ID
  getTransactionById(id: number): Observable<{ success: boolean; data: Transaction }> {
    // Try enhanced endpoint first
    return this.http.get<any>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Transaction not found');
        }
        return response;
      }),
      catchError(error => {
        // Fallback to basic transactions endpoint
        console.log('Enhanced endpoint failed, trying fallback...');
        return this.http.get<any>(`${this.apiUrl}/transactions/${id}`, {
          headers: this.getHeaders()
        }).pipe(
          map(response => {
            if (!response.success) {
              throw new Error(response.error || 'Transaction not found');
            }
            return response;
          })
        );
      }),
      catchError(this.handleError<{ success: boolean; data: Transaction }>('getTransactionById'))
    );
  }

  // Get transaction statistics
  getTransactionStats(filters: TransactionFilters = {}): Observable<{ success: boolean; data: TransactionStats[] }> {
    const params = this.buildParams(filters);

    return this.http.get<any>(`${this.apiUrl}/stats`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Failed to load statistics');
        }
        return response;
      }),
      catchError(this.handleError<{ success: boolean; data: TransactionStats[] }>('getTransactionStats'))
    );
  }

  // Get transaction summary for dashboard
  getTransactionSummary(dateRange?: { startDate: string; endDate: string }): Observable<{ success: boolean; data: TransactionSummary }> {
    const params = new HttpParams();

    if (dateRange?.startDate) {
      params.set('startDate', dateRange.startDate);
    }
    if (dateRange?.endDate) {
      params.set('endDate', dateRange.endDate);
    }

    return this.http.get<any>(`${this.apiUrl}/stats`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Failed to load summary');
        }
        return response;
      }),
      catchError(this.handleError<{ success: boolean; data: TransactionSummary }>('getTransactionSummary'))
    );
  }

  // Get user's accessible merchants
  getUserMerchants(): Observable<{ success: boolean; data: Merchant[] }> {
    return this.http.get<{ success: boolean; data: Merchant[] }>(`${this.apiUrl}/merchants/list`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError<{ success: boolean; data: Merchant[] }>('getUserMerchants'))
    );
  }

  // Export transactions
  exportTransactions(exportOptions: ExportOptions, filters?: TransactionFilters): Observable<Blob> {
    const body = {
      ...exportOptions,
      ...filters
    };

    return this.http.post(`${this.apiUrl}/export`, body, {
      headers: this.getHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError<Blob>('exportTransactions'))
    );
  }

  // Validate access to transaction
  validateTransactionAccess(id: number): Observable<{ success: boolean; hasAccess: boolean }> {
    return this.http.get<any>(`${this.apiUrl}/validate/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Failed to validate access');
        }
        return response;
      }),
      catchError(this.handleError<{ success: boolean; hasAccess: boolean }>('validateTransactionAccess'))
    );
  }

  // Bulk export transactions
  bulkExportTransactions(transactionIds: number[], exportOptions: ExportOptions): Observable<Blob> {
    const body = {
      transactionIds,
      exportOptions
    };

    return this.http.post(`${this.apiUrl}/bulk-export`, body, {
      headers: this.getHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError<Blob>('bulkExportTransactions'))
    );
  }

  // Download file helper
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Format amount helper
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  // Format date helper
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get status label helper
  getStatusLabel(status: string): string {
    switch (status) {
      case '00': return 'Aprobada';
      case '01': return 'Rechazada';
      case '02': return 'En Proceso';
      default: return 'Desconocido';
    }
  }

  // Get status class helper
  getStatusClass(status: string): string {
    switch (status) {
      case '00': return 'status-approved';
      case '01': return 'status-rejected';
      case '02': return 'status-processing';
      default: return 'status-unknown';
    }
  }

  // Mask card number helper
  maskCardNumber(bin: string, last4: string): string {
    const maskedBin = bin ? `*${bin.substring(0, 3)}` : '****';
    const maskedLast4 = last4 || '****';
    return `${maskedBin}-****-****-${maskedLast4}`;
  }

  // Calculate approval rate helper
  calculateApprovalRate(approved: number, total: number): number {
    return total > 0 ? Math.round((approved / total) * 100) : 0;
  }

  // Search transactions with debouncing
  searchTransactions(searchTerm: string, filters: TransactionFilters = {}): Observable<TransactionResponse> {
    const searchFilters = {
      ...filters,
      searchTerm,
      page: 1, // Reset to first page for new search
      limit: 25
    };

    return this.getTransactions(searchFilters);
  }

  // Get transaction trends
  getTransactionTrends(days: number = 30): Observable<{ success: boolean; data: TransactionStats[] }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const filters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };

    return this.getTransactionStats(filters);
  }
}

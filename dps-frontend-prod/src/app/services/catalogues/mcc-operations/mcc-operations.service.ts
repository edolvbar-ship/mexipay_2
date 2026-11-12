import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError } from 'rxjs';
import { AuthService } from '@/app/services/auth/auth.service';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';

export interface MccOperation {
  id_operation: number;
  mcc_code: string;
  name: string;
  description: string;
  operation_code: string;
  msg_type: string;
  processing_code: string;
  requires_amount: number;
  requires_tip: number;
  active: number;
  display_order: number;
  icon_name: string;
  category_code: string;
  creation_date: string;
  updated_at: string;
}

export interface MccCategory {
  code: string;
  name: string;
  description: string;
  operations: MccOperation[];
}

@Injectable({
  providedIn: 'root'
})
export class MccOperationsService {
  private apiUrl = '/api/mcc-operations';
  private catalogApiUrl = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): { [key: string]: string } {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    };
  }

  // Get all operations
  getAllOperations(): Observable<MccOperation[]> {
    return this.http.get<MccOperation[]>(this.apiUrl);
  }

  // Get operations grouped by MCC ranges
  getOperationsByCategory(): Observable<MccCategory[]> {
    return this.http.get<MccCategory[]>(`${this.apiUrl}/categories`);
  }

  // Get operations for specific MCC code
  getOperationsByMccCode(mccCode: string): Observable<MccOperation[]> {
    return this.http.get<MccOperation[]>(`${this.apiUrl}/mcc/${mccCode}`);
  }

  // Create new operation
  createOperation(operation: Partial<MccOperation>): Observable<MccOperation> {
    return this.http.post<MccOperation>(this.apiUrl, operation);
  }

  // Update operation
  updateOperation(id: number, operation: Partial<MccOperation>): Observable<MccOperation> {
    return this.http.put<MccOperation>(`${this.apiUrl}/${id}`, operation);
  }

  // Delete operation
  deleteOperation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Toggle operation active status
  toggleOperation(id: number, active: number): Observable<MccOperation> {
    return this.http.patch<MccOperation>(`${this.apiUrl}/${id}/toggle`, { active });
  }

  // Get available icons
  getAvailableIcons(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/icons`);
  }

  // Get MCC range descriptions
  getMccRangeDescriptions(): Observable<{code: string, name: string, description: string}[]> {
    return this.http.get<{code: string, name: string, description: string}[]>(`${this.apiUrl}/mcc-ranges`);
  }

  /**
   * Register a smart device for MCC operations
   */
  registerDevice(deviceInfo: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register-device`, deviceInfo, {
      headers: this.getHeaders()
    }).pipe(
      map((response: any) => {
        // Enhanced response handling for smart device registration
        if (response && response.success) {
          console.log('📱 Device registered successfully:', response);
          return response;
        } else {
          console.error('❌ Device registration failed:', response);
          return response;
        }
      }),
      catchError((error: any) => {
        console.error('💥 Device registration error:', error);
        throw error;
      })
    );
  }

  // New methods for MCC-specific operations management

  /**
   * Get available operations that can be assigned to a specific MCC
   */
  getAvailableOperationsForMcc(mccCode: string): Observable<MccOperation[]> {
    return this.http.get<MccOperation[]>(`${this.apiUrl}/available/${mccCode}`);
  }

  /**
   * Assign an existing operation to a specific MCC
   */
  assignOperationToMcc(mccCode: string, operationCode: string, displayOrder?: number): Observable<MccOperation> {
    return this.http.post<MccOperation>(`${this.apiUrl}/mcc/${mccCode}/assign`, {
      operation_code: operationCode,
      display_order: displayOrder
    });
  }

  /**
   * Remove an operation from a specific MCC
   */
  removeOperationFromMcc(mccCode: string, operationCode: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/mcc/${mccCode}/operation/${operationCode}`);
  }

  /**
   * Get MCC information with operations count
   */
  getMccInfo(mccCode: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mcc-info/${mccCode}`);
  }

  /**
   * Get all MCC codes for selector
   */
  getAllMccCodes(): Observable<any[]> {
    console.log('Fetching all MCC codes from:', `${this.catalogApiUrl}/merchantCategoryCodes?page=1&pageSize=1000`);
    return this.http.get<any[]>(`${this.catalogApiUrl}/merchantCategoryCodes?page=1&pageSize=1000`).pipe(
      map((response: any) => {
        console.log('Raw catalog API response:', response);
        const result = response.data || [];
        console.log('Processed MCC codes:', result);
        return result;
      }),
      catchError((error) => {
        console.error('Error fetching MCC codes:', error);
        throw error;
      })
    );
  }
}

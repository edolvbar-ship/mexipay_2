import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
  LinkValidationInterface,
  PaymentInformationInterface,
  PaymentResponse3DSInterface,
  PaymentResponseInterface,
  VerifyPaymentInformationInterface,
  SeliaPaymentResponseInterface,
  SeliaPaymentInformationInterface,
  AnyPaymentResponse
} from '@/app/shared/interfaces/payment-links.interface';
import { MerchantsInterface } from '@/app/shared/interfaces/merchants.interface';
import { DatePipe } from '@angular/common';

/**
 * Service for managing payment links and payment processing operations
 *
 * This service provides comprehensive functionality for:
 * - CRUD operations on payment links
 * - Payment processing (regular and 3DSecure)
 * - Selia payment integration
 * - Link validation and merchant management
 * - Data filtering and transformation for UI display
 */
@Injectable({
  providedIn: 'root'
})
export class LinkService {

  constructor(private http: HttpClient, private datePipe: DatePipe) { }

  // Temporary storage for search results
  dataSearch: any[] = [];

  // API URLs constructed from configuration endpoints
  private API_URL = utils.buildUrl(endpoints.apiV02, "");
  // /gateway/api/v2/links/merchants
  private API_BASE_URL = endpoints.apiBaseUrl;

  /**
   * Retrieves paginated list of payment links from the server
   * @param page - Page number for pagination (default: 1)
   * @param limit - Number of items per page (default: 10000)
   * @returns Observable containing the paginated link data
   */
  getLinks(page = 1, limit = 10000): Observable<any> {
    return this.http.post<any>(`${this.API_URL}link/get`, { page, limit })
      .pipe(
        map(response => response),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Creates a new payment link
   * @param data - Payment link configuration data
   * @returns Observable with the created link response
   */
  saveData(data: any): Observable<any> {
    return this.http.post(`${this.API_URL}link`, data);
  }

  /**
   * Retrieves payment links filtered by date range
   * @param dates - Date range string for filtering
   * @returns Observable containing links within the specified date range
   */
  getLinksByDateRange(dates: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}link/links`, dates)
      .pipe(
        map(response => {
          return response;
        }),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Transforms raw API response into formatted table data for UI display
   * @param response - Raw API response containing link data
   * @returns Array of formatted table rows with human-readable values
   */
  getDataTable(response: any): any[] {
    const dataList: any[] = response.data.map((item: any) => {
      return {
        Fecha: this.datePipe.transform(item.created_at, 'dd/MM/yyyy'),           // Formatted creation date
        Comercio: item.merchantName,                                            // Merchant name
        Concepto: item.concepto,                                                // Payment concept/description
        Monto: `$${item.monto}`,                                                // Formatted amount with currency symbol
        Estatus: item.status,                                                   // Link status
        "Fecha de expiración": this.datePipe.transform(item.expire_date, 'dd/MM/yyyy') || 'N/A', // Formatted expiration date
        link: `${window.location.host}/payment${item.url}`,                     // Full payment URL
      }
    })
    return dataList;
  }

  /**
   * Retrieves list of available merchants for link creation
   * @returns Observable containing array of merchant objects
   */
  getLinkMerchants(): Observable<MerchantsInterface[]> {
    return this.http.get<MerchantsInterface[]>(`${this.API_URL}link/merchants`).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /**
   * Searches and filters links by text search within a date range
   * @param search - Search string to filter results
   * @param date - Date range for filtering
   * @returns Observable containing filtered link data
   */
  getDataSearched(search: string, date: any): Observable<any[]> {
    return this.getLinksByDateRange(date).pipe(
      map((row: any) => {
          return this.filterData(search, row)
        }
      )
    )
  }

  /**
   * Filters link data based on search criteria across multiple fields
   * @param search - Search string to filter by
   * @param data - Raw data to filter
   * @returns Filtered data containing only matching records
   */
  private filterData(search: string, data: any): any {
    const searchLower = search.toLowerCase();
    this.dataSearch = data.data.filter((item: any) => {
      // Search across multiple text fields: concepto, monto, status, merchantName
      return (typeof item.concepto === 'string' && item.concepto.toLowerCase().includes(searchLower)) ||
        (typeof item.monto === 'string' && item.monto.toLowerCase().includes(searchLower)) ||
        (typeof item.status === 'string' && item.status.toLowerCase().includes(searchLower)) ||
        (typeof item.merchantName === 'string' && item.merchantName.toLowerCase().includes(searchLower));
    });

    return { data: this.dataSearch };
  }

  /**
   * Sends payment link via email
   * @param bodyRequest - Email configuration and recipient data
   * @returns Observable with email sending response
   */
  sendByEmail(bodyRequest: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}link/email`, bodyRequest)
      .pipe(
        map(response => response),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Validates a payment link and retrieves its current status
   * @param queryStrings - Query parameters from the payment URL
   * @returns Observable with link validation results and status
   */
  getLinkValid(queryStrings: string): Observable<LinkValidationInterface> {
    return this.http.get<LinkValidationInterface>(`${this.API_BASE_URL}/api/payment?${queryStrings}`).pipe(
      map((resp) => {
        // Enhance response with user-friendly status descriptions
        resp.description = resp.statusCode == 0 ? 'Pendiente' : resp.description;

        // Convert string dates to Date objects for easier handling
        if (resp.data) {
          resp.data.created_at = resp.data.created_at ? new Date(resp.data.created_at) : undefined;
          resp.data.updated_at = resp.data.updated_at ? new Date(resp.data.updated_at) : undefined;
          resp.data.expire_date = resp.data.expire_date ? new Date(resp.data.expire_date) : undefined;
        }
        return resp;
      })
    );
  }

  /**
   * Processes a payment transaction
   * @param data - Payment information including card details and amount
   * @returns Observable with payment response (may include 3DSecure data)
   */
  makePayment( data: PaymentInformationInterface ): Observable<PaymentResponse3DSInterface | PaymentResponseInterface> {
    // Encode payment data in base64 for security during transmission
    const body = { data: btoa(JSON.stringify(data))};
    return this.http.post<PaymentResponse3DSInterface | PaymentResponseInterface>(`${this.API_BASE_URL}/api/payment/payout`, body)
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Verifies and completes a 3DSecure payment transaction
   * @param data - 3DSecure verification data including transaction reference
   * @returns Observable with final payment result
   */
  verifyPayment3DS( data: VerifyPaymentInformationInterface ): Observable<PaymentResponseInterface> {
    const body = { ...data };
    return this.http.post<PaymentResponseInterface>(`${this.API_BASE_URL}/api/payment/paymentVerify`, body)
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Processes a payment through Selia payment gateway
   * @param data - Selia-specific payment information
   * @returns Observable with Selia payment response
   */
  makeSeliaPayment(data: SeliaPaymentInformationInterface): Observable<SeliaPaymentResponseInterface> {
    // Encode payment data in base64 for security
    const body = { data: btoa(JSON.stringify(data)) };
    return this.http.post<SeliaPaymentResponseInterface>(`${this.API_BASE_URL}/api/payment/selia`, body)
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
   * Queries the status of a Selia transaction
   * @param transactionId - Unique identifier for the Selia transaction
   * @returns Observable with current transaction status and details
   */
  querySeliaTransaction(transactionId: string): Observable<SeliaPaymentResponseInterface> {
    return this.http.post<SeliaPaymentResponseInterface>(`${this.API_BASE_URL}/api/payment/selia/query`, { transactionId })
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }
}

  // verifyPayment3DS(data: VerifyPaymentInformationInterface): Observable<PaymentResponseInterface> {
  //   const body = { ...data };
  //   return this.http.post<PaymentResponseInterface>(`${this.API_BASE_URL}/api/payment/paymentVerify`, body)
  //     .pipe(
  //       catchError(error => {
  //         return throwError(() => error);
  //       })
  //     );
  // }
// }

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap, catchError, throwError } from 'rxjs';
import { endpoints } from '@/app/config/endpoints.config';
import { utils } from '@/app/utils/utils';
import { AuthService } from '@/app/services/auth/auth.service';

// Interfaces
export interface TableInfo {
  tableName: string;
  description: string;
  rowCount: number;
  primaryKey: string | null;
  hasRelationships: boolean;
  relationshipCount: number;
  error?: boolean;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
  defaultValue: string | null;
  description: string;
  extra: string;
  maxLength: number | null;
}

export interface RelationshipInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  updateRule: string;
  deleteRule: string;
}

export interface IndexInfo {
  indexName: string;
  columnName: string;
  nonUnique: number;
}

export interface ReferenceInfo {
  tableName: string;
  columnName: string;
  referencedColumn: string;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  primaryKey: string | null;
  relationships: RelationshipInfo[];
  indexes: IndexInfo[];
  references: ReferenceInfo[];
  rowCount: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RecordsResponse {
  records: any[];
  pagination: PaginationInfo;
  columns: ColumnInfo[];
}

export interface DatabaseStats {
  totalTables: number;
  totalRecords: number;
  totalSizeMB: number;
  dataSizeMB: number;
  indexSizeMB: number;
  tableStats: TableStats[];
}

export interface TableStats {
  tableName: string;
  recordCount: number;
  sizeMB: number;
  error?: boolean;
}

export interface BatchOperationResult {
  success: { id: number; data: any }[];
  failed: { record: any; error: string }[];
}

export interface FilterValue {
  value?: any;
  min?: any;
  max?: any;
  from?: string;
  to?: string;
}

export interface QueryRecordsRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: { [key: string]: FilterValue };
  search?: string;
  columns?: string[];
  includeRelations?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseExplorerService {
  private readonly API_URL = utils.buildUrl(endpoints.apiV02, '');
  private readonly EXPLORER_URL = `${this.API_URL}/database-explorer`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    console.log('[DB Explorer] Service initialized');
    console.log('[DB Explorer] API URL:', this.EXPLORER_URL);
    console.log('[DB Explorer] Token available:', !!this.authService.getToken());
    console.log('[DB Explorer] User isAdmin:', this.authService.userInfo?.isAdmin);
  }

  private logRequest(method: string, url: string) {
    console.log(`[DB Explorer] ${method} ${url}`);
    console.log('[DB Explorer] Token:', this.authService.getToken()?.substring(0, 20) + '...');
  }

  // ============================================================================
  // SCHEMA AND METADATA
  // ============================================================================

  getTables(): Observable<TableInfo[]> {
    const url = `${this.EXPLORER_URL}/tables`;
    this.logRequest('GET', url);
    return this.http.get<{ success: boolean; data: TableInfo[] }>(url)
      .pipe(
        tap(response => console.log('[DB Explorer] getTables response:', response)),
        catchError(error => {
          console.error('[DB Explorer] getTables error:', error);
          return throwError(() => error);
        }),
        map(response => response.data)
      );
  }

  getTableSchema(tableName: string): Observable<TableSchema> {
    return this.http.get<{ success: boolean; data: TableSchema }>(
      `${this.EXPLORER_URL}/tables/${tableName}/schema`
    ).pipe(map(response => response.data));
  }

  getDatabaseStats(): Observable<DatabaseStats> {
    return this.http.get<{ success: boolean; data: DatabaseStats }>(
      `${this.EXPLORER_URL}/stats`
    ).pipe(map(response => response.data));
  }

  getEnumValues(tableName: string, columnName: string): Observable<{ type: string; values: any[] }> {
    return this.http.get<{ success: boolean; data: { type: string; values: any[] } }>(
      `${this.EXPLORER_URL}/tables/${tableName}/columns/${columnName}/enum`
    ).pipe(map(response => response.data));
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  getRecords(tableName: string, request: QueryRecordsRequest): Observable<RecordsResponse> {
    return this.http.post<{ success: boolean; data: RecordsResponse }>(
      `${this.EXPLORER_URL}/tables/${tableName}/records`,
      request
    ).pipe(map(response => response.data));
  }

  getRecordById(tableName: string, id: string | number): Observable<any> {
    return this.http.get<{ success: boolean; data: any }>(
      `${this.EXPLORER_URL}/tables/${tableName}/records/${id}`
    ).pipe(map(response => response.data));
  }

  createRecord(tableName: string, data: any): Observable<any> {
    return this.http.post<{ success: boolean; data: any; message: string }>(
      `${this.EXPLORER_URL}/tables/${tableName}/records`,
      data
    ).pipe(map(response => response.data));
  }

  updateRecord(tableName: string, id: string | number, data: any): Observable<any> {
    return this.http.put<{ success: boolean; data: any; message: string }>(
      `${this.EXPLORER_URL}/tables/${tableName}/records/${id}`,
      data
    ).pipe(map(response => response.data));
  }

  deleteRecord(tableName: string, id: string | number, force: boolean = false): Observable<any> {
    const options = force ? { body: { force: true } } : {};
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.EXPLORER_URL}/tables/${tableName}/records/${id}`,
      options
    ).pipe(map(response => response));
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  batchOperation(
    tableName: string,
    operation: 'create' | 'update' | 'delete',
    records: any[]
  ): Observable<{ success: boolean; message: string; data: BatchOperationResult }> {
    return this.http.post<{ success: boolean; message: string; data: BatchOperationResult }>(
      `${this.EXPLORER_URL}/tables/${tableName}/batch`,
      { operation, records }
    );
  }

  // ============================================================================
  // RELATIONSHIPS
  // ============================================================================

  getRelatedData(tableName: string, column: string, search?: string, limit: number = 50): Observable<any> {
    let params = new HttpParams()
      .set('column', column)
      .set('limit', limit.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<{ success: boolean; data: any }>(
      `${this.EXPLORER_URL}/tables/${tableName}/related`,
      { params }
    ).pipe(map(response => response.data));
  }

  // ============================================================================
  // ADVANCED
  // ============================================================================

  executeQuery(query: string): Observable<any[]> {
    return this.http.post<{ success: boolean; data: any[]; count: number }>(
      `${this.EXPLORER_URL}/query`,
      { query }
    ).pipe(map(response => response.data));
  }

  exportDatabase(format: 'json' | 'csv' = 'json', tables?: string[]): Observable<Blob> {
    return this.http.post(
      `${this.EXPLORER_URL}/export`,
      { format, tables },
      { responseType: 'blob' }
    );
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  downloadExport(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  getDataTypeIcon(dataType: string): string {
    const type = dataType.toLowerCase();
    if (type.includes('int')) return 'pi pi-hashtag';
    if (type.includes('decimal') || type.includes('float') || type.includes('double')) return 'pi pi-percentage';
    if (type.includes('varchar') || type.includes('text') || type.includes('char')) return 'pi pi-align-left';
    if (type.includes('date') || type.includes('time')) return 'pi pi-calendar';
    if (type.includes('tinyint(1)') || type.includes('bool')) return 'pi pi-check-circle';
    if (type.includes('blob') || type.includes('binary')) return 'pi pi-file';
    if (type.includes('json')) return 'pi pi-code';
    return 'pi pi-database';
  }

  isNumericType(dataType: string): boolean {
    const type = dataType.toLowerCase();
    return type.includes('int') || type.includes('decimal') || type.includes('float') ||
           type.includes('double') || type.includes('numeric');
  }

  isDateType(dataType: string): boolean {
    const type = dataType.toLowerCase();
    return type.includes('date') || type.includes('time');
  }

  isTextType(dataType: string): boolean {
    const type = dataType.toLowerCase();
    return type.includes('varchar') || type.includes('text') || type.includes('char');
  }

  isBooleanType(dataType: string): boolean {
    const type = dataType.toLowerCase();
    return type.includes('tinyint(1)') || type.includes('bool');
  }
}

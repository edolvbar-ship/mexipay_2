import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, of, forkJoin } from 'rxjs';
import { takeUntil, catchError, map } from 'rxjs/operators';

interface User {
  id: number;
  username: string;
  fullName: string;
  mail: string;
  id_profile: number;
  profile_name?: string;
}

interface Resource {
  id: number;
  resource_name: string;
  resource_url: string;
  is_group: number;
  father_resource?: number;
}

interface PermissionTest {
  resource: Resource;
  expectedPermissions: {
    create: number;
    edit: number;
    delete: number;
    select: number;
  };
  actualResults: {
    success: boolean;
    error?: string;
    response?: any;
    statusCode?: number;
  };
  permissionMatch: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    select: boolean;
  };
  overallStatus: 'pending' | 'testing' | 'passed' | 'failed';
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  duration: number;
}

@Component({
  selector: 'app-permission-tester',
  templateUrl: './permission-tester.component.html',
  styleUrls: ['./permission-tester.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    ProgressBarModule,
    ToastModule,
    CardModule,
    ChipModule,
    TagModule,
    TooltipModule
  ],
  providers: [MessageService]
})
export class PermissionTesterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Form
  testForm: FormGroup;

  // Data
  users: User[] = [];
  resources: Resource[] = [];
  permissionTests: PermissionTest[] = [];
  selectedUser: User | null = null;
  currentUser: User | null = null;

  // UI State
  loading: boolean = false;
  testing: boolean = false;
  testProgress: number = 0;
  testSummary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    duration: 0
  };

  // Admin check
  isAdmin: boolean = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private messageService: MessageService
  ) {
    this.testForm = this.fb.group({
      selectedUser: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadCurrentUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentUser(): void {
    this.http.get<any>('/gateway/api/v2/auth/user-info').pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading current user:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la información del usuario actual'
        });
        return of(null);
      })
    ).subscribe(response => {
      if (response && response.success && response.data) {
        this.currentUser = response.data;
        this.isAdmin = this.currentUser?.id_profile === 1; // Admin profile check
        
        if (this.isAdmin) {
          this.loadUsers();
          this.loadResources();
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Acceso Denegado',
            detail: 'Esta herramienta es solo para administradores'
          });
        }
      }
    });
  }

  private loadUsers(): void {
    this.loading = true;
    this.http.get<any>('/gateway/api/v2/admin/permission-test/users').pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading users:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los usuarios'
        });
        return of({ data: [] });
      })
    ).subscribe(response => {
      this.users = response.data || [];
      this.loading = false;
    });
  }

  private loadResources(): void {
    this.loading = true;
    this.http.get<any>('/gateway/api/v2/profiles/matrix/all').pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading resources:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los recursos'
        });
        return of({ data: [] });
      })
    ).subscribe(response => {
      this.resources = response.data || [];
      this.loading = false;
    });
  }

  onUserSelect(user: User): void {
    this.selectedUser = user;
    this.resetTests();
  }

  private resetTests(): void {
    this.permissionTests = [];
    this.testProgress = 0;
    this.testSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      duration: 0
    };
  }

  testAllResources(): void {
    if (!this.selectedUser) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor seleccione un usuario primero'
      });
      return;
    }

    this.testing = true;
    this.testProgress = 0;
    this.testSummary = {
      total: this.resources.length,
      passed: 0,
      failed: 0,
      errors: 0,
      duration: 0
    };

    // Initialize test results
    this.permissionTests = this.resources.map(resource => ({
      resource,
      expectedPermissions: {
        create: 0,
        edit: 0,
        delete: 0,
        select: 0
      },
      actualResults: {
        success: false,
        error: undefined,
        response: undefined,
        statusCode: undefined
      },
      permissionMatch: {
        create: false,
        edit: false,
        delete: false,
        select: false
      },
      overallStatus: 'pending' as const
    }));

    // Load expected permissions first
    this.loadExpectedPermissions().then(() => {
      // Start testing resources
      this.testResourcesSequentially(0);
    });
  }

  private async loadExpectedPermissions(): Promise<void> {
    // Permissions are now loaded directly from the test results
    // This method is kept for compatibility but does nothing
  }

  private testResourcesSequentially(index: number): void {
    if (index >= this.permissionTests.length) {
      this.completeTesting();
      return;
    }

    const test = this.permissionTests[index];
    test.overallStatus = 'testing';
    this.testProgress = Math.round((index / this.permissionTests.length) * 100);

    // Test the resource
    this.testResource(test).then(() => {
      // Test next resource
      setTimeout(() => {
        this.testResourcesSequentially(index + 1);
      }, 100); // Small delay between tests
    });
  }

  private async testResource(test: PermissionTest): Promise<void> {
    try {
      const resourceId = test.resource.id;
      
      try {
        const response = await this.http.get<any>(`/gateway/api/v2/admin/permission-test/resource/${resourceId}`, { 
          headers: { 
            'X-Test-User-ID': this.selectedUser?.id?.toString() || '',
            'X-Test-Mode': 'permission-check'
          }
        }).toPromise();

        if (response && (response as any).success) {
          const testData = (response as any).data;
          
          test.actualResults = {
            success: true,
            response: testData,
            statusCode: 200 // Default to success status
          };

          // Update expected permissions from actual test results
          test.expectedPermissions = {
            create: testData.expectedPermissions.create,
            edit: testData.expectedPermissions.edit,
            delete: testData.expectedPermissions.delete,
            select: testData.expectedPermissions.select
          };

          // Update permission match based on test results
          test.permissionMatch = testData.permissionMatch;
          test.overallStatus = testData.permissionMatch.select ? 'passed' : 'failed';

          if (testData.permissionMatch.select) {
            this.testSummary.passed++;
          } else {
            this.testSummary.failed++;
          }
        } else {
          throw new Error('Invalid response format');
        }

      } catch (error: any) {
        test.actualResults = {
          success: false,
          error: error.message || 'Request failed',
          statusCode: error.status
        };
        test.overallStatus = 'failed';
        this.testSummary.failed++;
      }

    } catch (error) {
      test.actualResults = {
        success: false,
        error: 'Test execution failed'
      };
      test.overallStatus = 'failed';
      this.testSummary.errors++;
    }
  }

  private completeTesting(): void {
    this.testing = false;
    this.testProgress = 100;
    
    this.messageService.add({
      severity: this.testSummary.failed === 0 ? 'success' : 'warn',
      summary: 'Prueba Completada',
      detail: `Resultados: ${this.testSummary.passed} pasaron, ${this.testSummary.failed} fallaron, ${this.testSummary.errors} errores`
    });
  }

  getSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'passed': return 'success';
      case 'failed': return 'danger';
      case 'testing': return 'info';
      case 'pending': return 'secondary';
      default: return 'secondary';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'passed': return 'pi pi-check-circle';
      case 'failed': return 'pi pi-times-circle';
      case 'testing': return 'pi pi-spin pi-spinner';
      case 'pending': return 'pi pi-clock';
      default: return 'pi pi-question-circle';
    }
  }

  exportResults(): void {
    if (this.permissionTests.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay resultados para exportar'
      });
      return;
    }

    const results = {
      user: this.selectedUser,
      testDate: new Date().toISOString(),
      summary: this.testSummary,
      results: this.permissionTests
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permission-test-${this.selectedUser?.username}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportado',
      detail: 'Resultados exportados correctamente'
    });
  }
}

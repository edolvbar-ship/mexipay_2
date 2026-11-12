import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { ModalConfirmComponent } from '@/app/shared/components/modal-confirm/modal-confirm.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService } from '@/app/services/shared/search/search.service';
import { MccOperationsService } from '@/app/services/catalogues/mcc-operations/mcc-operations.service';
import { MccTableInterface, MccCategoryInterface } from '@/app/shared/interfaces/mcc-operations-interface';
import { SmartDeviceResponseHandler, SmartDeviceResponse, SmartDeviceInterceptor } from '@/app/shared/utils/smart-device-response-handler';

@Component({
    selector: 'app-mcc-operations',
    imports: [
        CommonModule,
        SectionTitleComponent,
        TableLayoutComponent,
        CardContainerComponent,
        ModalConfirmComponent
    ],
    templateUrl: './mcc-operations.component.html',
    styleUrl: './mcc-operations.component.css'
})
export default class MccOperationsComponent implements OnInit, OnDestroy {

  @ViewChild(ModalConfirmComponent) modal!: ModalConfirmComponent;

  constructor(
    private mccOperationsService: MccOperationsService,
    private toastSrv: ToastrService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private searchSrv: SearchService
  ) {}

  // Data
  operationsData: MccTableInterface[] = [];
  categories: MccCategoryInterface[] = [];
  selectedCategory: MccCategoryInterface | null = null;

  // UI State
  loading = false;
  canCreate = true;
  linkNewRow = ['/pages/catalogs/mcc-operations/new'];

  // Table Configuration
  actions = [
    { name: 'Edit', icon: 'edit', action: 'edit' },
    { name: 'Delete', icon: 'delete', action: 'delete' },
    { name: 'Toggle Active', icon: 'toggle_on', action: 'toggle' }
  ];

  // Table Headers
  headers = [
    { key: 'id_operation', label: 'ID', sortable: true },
    { key: 'mcc_range', label: 'MCC Range', sortable: true },
    { key: 'name', label: 'Operation Name', sortable: true },
    { key: 'description', label: 'Description', sortable: false },
    { key: 'operation_code', label: 'Code', sortable: true },
    { key: 'msg_type', label: 'Msg Type', sortable: true },
    { key: 'requires_amount', label: 'Amount', sortable: false },
    { key: 'requires_tip', label: 'Tip', sortable: false },
    { key: 'active', label: 'Status', sortable: true },
    { key: 'display_order', label: 'Order', sortable: true },
    { key: 'icon_name', label: 'Icon', sortable: false }
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadOperations();
    this.loadCategories();
    this.setupSearch();
  }

  loadOperations(): void {
    this.loading = true;
    this.mccOperationsService.getAllOperations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operations) => {
          this.operationsData = this.formatOperationsForTable(operations);
          this.loading = false;
        },
        error: (error) => {
          this.toastSrv.error('Error loading operations');
          this.loading = false;
          console.error('Error loading operations:', error);
        }
      });
  }

  loadCategories(): void {
    this.mccOperationsService.getOperationsByCategory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
        }
      });
  }

  formatOperationsForTable(operations: any[]): MccTableInterface[] {
    return operations.map(op => ({
      id_operation: op.id_operation,
      mcc_code: op.mcc_code || '',
      name: op.name,
      description: op.description || '',
      operation_code: op.operation_code,
      msg_type: op.msg_type || '',
      requires_amount: op.requires_amount ? 'Yes' : 'No',
      requires_tip: this.getTipLabel(op.requires_tip),
      active: op.active ? 'Active' : 'Inactive',
      display_order: op.display_order,
      icon_name: op.icon_name || '',
      actions: 'actions'
    }));
  }

  getTipLabel(requiresTip: number): string {
    switch (requiresTip) {
      case 0: return 'No';
      case 1: return 'Optional';
      case 2: return 'Required';
      default: return 'No';
    }
  }

  setupSearch(): void {
    this.searchSrv.getSearchObservable()
      .pipe(takeUntil(this.destroy$))
      .subscribe((searchTerm: string) => {
        if (searchTerm) {
          this.filterOperations(searchTerm);
        } else {
          this.loadOperations();
        }
      });
  }

  filterOperations(searchTerm: string): void {
    const filtered = this.operationsData.filter(op =>
      op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.operation_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.mcc_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    this.operationsData = filtered;
  }

  // Enhanced error handling with smart device responses
  handleDeviceOperationResponse(response: any, operation: string, deviceInfo?: any): void {
    const deviceResponse = SmartDeviceInterceptor.interceptResponse(response, deviceInfo);
    const displayResponse = SmartDeviceResponseHandler.formatForDisplay(deviceResponse);

    if (deviceResponse.success) {
      this.toastSrv.success(displayResponse.message);
      console.log(`✅ ${operation} successful:`, deviceResponse);
    } else {
      this.toastSrv.error(displayResponse.message);
      console.error(`❌ ${operation} failed:`, deviceResponse);

      // Show specific error details in console for debugging
      if (deviceResponse.error) {
        console.error('Error Code:', deviceResponse.error.code);
        console.error('Error Details:', deviceResponse.error.details);
        console.error('Timestamp:', deviceResponse.error.timestamp);
      }
    }
  }

  // Smart device registration for MCC operations
  registerSmartDevice(operation: MccTableInterface): void {
    const deviceInfo = {
      deviceId: `mcc_${operation.id_operation}_${operation.operation_code}`,
      deviceType: 'mcc_operation_terminal',
      operationCode: operation.operation_code,
      mccCode: operation.mcc_code
    };

    this.mccOperationsService.registerDevice(deviceInfo).subscribe({
      next: (response) => {
        this.handleDeviceOperationResponse(response, 'Device Registration', deviceInfo);
      },
      error: (error) => {
        this.handleDeviceOperationResponse(error, 'Device Registration', deviceInfo);
      }
    });
  }

  // Table Actions
  onTableAction(row: any): void {
    // Cast row to MccTableInterface and assume edit action
    const operation = row as MccTableInterface;
    this.editOperation(operation.id_operation);
  }

  editOperation(id: number): void {
    this.router.navigate([`/pages/catalogs/mcc-operations/edit/${id}`]);
  }

  confirmDelete(operation: MccTableInterface): void {
    this.modal.openModal(
      'Delete Operation',
      `Are you sure you want to delete "${operation.name}"?`,
      'Delete',
      'Cancel'
    );
    this.modal.accept.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.deleteOperation(operation.id_operation);
    });
  }

  deleteOperation(id: number): void {
    this.mccOperationsService.deleteOperation(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastSrv.success('Operation deleted successfully');
          this.loadOperations();
        },
        error: (error) => {
          this.toastSrv.error('Error deleting operation');
          console.error('Error deleting operation:', error);
        }
      });
  }

  getActiveCount(): number {
    return this.operationsData.filter(op => op.active === 'Active').length;
  }

  getInactiveCount(): number {
    return this.operationsData.filter(op => op.active === 'Inactive').length;
  }

  handleAccept(): void {
    // Modal accept handler - can be used for future modal functionality
  }

  handleReject(): void {
    // Modal reject handler - can be used for future modal functionality
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleOperation(operation: MccTableInterface): void {
    const newStatus = operation.active === 'Active' ? 0 : 1;
    this.mccOperationsService.toggleOperation(operation.id_operation, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastSrv.success(`Operation ${newStatus ? 'activated' : 'deactivated'} successfully`);
          this.loadOperations();
        },
        error: (error) => {
          this.toastSrv.error('Error toggling operation');
          console.error('Error toggling operation:', error);
        }
      });
  }

  // Category filtering
  selectCategory(category: MccCategoryInterface): void {
    this.selectedCategory = category;
    this.operationsData = this.formatOperationsForTable(category.operations);
  }

  clearCategoryFilter(): void {
    this.selectedCategory = null;
    this.loadOperations();
  }

  // Get category name for display
  getCategoryName(mccRange: string): string {
    const prefix = mccRange.split('-')[0];
    const category = this.categories.find(cat =>
      cat.code.includes(prefix) ||
      cat.name.toLowerCase().includes(prefix)
    );
    return category ? category.name : 'Unknown';
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { MccOperationsService, MccOperation } from '@/app/services/catalogues/mcc-operations/mcc-operations.service';

export interface MccWithOperations {
  id_mcc: number;
  mcc: string;
  description: string;
  operations_count: number;
  category: any;
  loading?: boolean;
}

@Component({
  selector: 'app-mcc-operations-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './mcc-operations-management.component.html',
  styleUrls: ['./mcc-operations-management.component.css']
})
export class MccOperationsManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  mccList: MccWithOperations[] = [];
  selectedMcc: MccWithOperations | null = null;
  currentOperations: MccOperation[] = [];
  availableOperations: MccOperation[] = [];
  selectedAvailableOperation: MccOperation | null = null;

  // UI State
  loading = false;
  loadingOperations = false;
  loadingAvailable = false;
  showAvailableOperations = false;
  searchTerm = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private mccOperationsService: MccOperationsService,
    private toastService: ToastrService
  ) {}

  ngOnInit(): void {
    console.log('MccOperationsManagementComponent initialized');

    // Check for URL parameters
    this.route.paramMap.subscribe(params => {
      const mccCode = params.get('mccCode');
      if (mccCode) {
        console.log('URL MCC Code found:', mccCode);
        // Load MCC codes first, then select the specific MCC
        this.loadMccCodesAndSelect(mccCode);
      } else {
        // No MCC code parameter, load all MCC codes
        this.loadMccCodes();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadMccCodes(): void {
    this.loading = true;
    this.mccOperationsService.getAllMccCodes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (mccCodes) => {
          // Load operations count for each MCC
          this.loadMccWithOperations(mccCodes);
        },
        error: (error) => {
          console.error('Error loading MCC codes:', error);
          this.toastService.error('Error loading MCC codes');
          this.loading = false;
        }
      });
  }

  private async loadMccCodesAndSelect(mccCode: string): Promise<void> {
    console.log('Loading MCC codes and selecting:', mccCode);
    this.loading = true;
    try {
      const mccCodes = (await this.mccOperationsService.getAllMccCodes().toPromise()) || [];
      console.log('Raw MCC codes from API:', mccCodes);

      // Load operations count for each MCC
      await this.loadMccWithOperations(mccCodes);

      console.log('Looking for MCC:', mccCode, 'in list:', this.mccList.map(m => ({ mcc: m.mcc, description: m.description })));

      // Select the specific MCC after data is loaded
      const targetMcc = this.mccList.find(m => m.mcc === mccCode);
      if (targetMcc) {
        console.log('✅ Auto-selecting MCC:', targetMcc);
        this.selectedMcc = targetMcc;
        this.loadMccOperations(targetMcc.mcc);
      } else {
        console.error('❌ MCC not found:', mccCode);
        console.log('Available MCCs:', this.mccList.map(m => ({ mcc: m.mcc, description: m.description })));

        // Try to find similar MCC codes for debugging
        const similarCodes = this.mccList.filter(m => m.mcc.includes(mccCode) || mccCode.includes(m.mcc));
        if (similarCodes.length > 0) {
          console.log('Similar MCC codes found:', similarCodes);
        }

        this.toastService.error(`MCC ${mccCode} not found`);
      }
    } catch (error) {
      console.error('Error loading MCC codes:', error);
      this.toastService.error('Error loading MCC codes');
    } finally {
      this.loading = false;
    }
  }

  private async loadMccWithOperations(mccCodes: any[]): Promise<void> {
    console.log('Loading MCC with operations for:', mccCodes.length, 'MCC codes');

    const mccList: MccWithOperations[] = [];

    for (const mcc of mccCodes) {
      try {
        console.log('Processing MCC:', mcc);

        // Get MCC info with operations count - add timeout to prevent hanging
        const info = await Promise.race([
          this.mccOperationsService.getMccInfo(mcc.mcc).toPromise(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout getting MCC info')), 5000)
          )
        ]);

        const mccWithOps: MccWithOperations = {
          id_mcc: mcc.id_mcc,
          mcc: mcc.mcc,
          description: mcc.description,
          operations_count: info?.operations_count || 0,
          category: info?.category || null,
          loading: false
        };

        console.log('MCC with ops:', mccWithOps);
        mccList.push(mccWithOps);
      } catch (error) {
        console.error(`Error loading info for MCC ${mcc.mcc}:`, error);
        // Still add the MCC with 0 operations - ensure list is always populated
        const fallbackMcc = {
          id_mcc: mcc.id_mcc,
          mcc: mcc.mcc,
          description: mcc.description,
          operations_count: 0,
          category: null,
          loading: false
        };
        console.log('Fallback MCC:', fallbackMcc);
        mccList.push(fallbackMcc);
      }
    }

    // Sort by MCC code and ensure list is never empty
    this.mccList = mccList.sort((a, b) => a.mcc.localeCompare(b.mcc));
    console.log('Final MCC List:', this.mccList);
    this.loading = false;
  }


  manageMcc(mcc: MccWithOperations): void {
    console.log('MANAGE BUTTON CLICKED!');
    console.log('MCC DATA:', mcc);
    const targetUrl = `/catalogos/mcc-operations/manage/${mcc.mcc}`;
    console.log('TARGET URL:', targetUrl);

    // Use direct navigation - this WORKS!
    window.location.href = targetUrl;
  }

  viewMcc(mcc: MccWithOperations): void {
    console.log('VIEW BUTTON CLICKED!');
    console.log('MCC DATA:', mcc);
    const targetUrl = `/catalogos/mcc-operations/view/${mcc.mcc}`;
    console.log('TARGET URL:', targetUrl);

    // Use direct navigation - this WORKS!
    window.location.href = targetUrl;
  }

  testDirectNavigation(): void {
    console.log('DIRECT NAVIGATION TEST!');
    alert('TEST BUTTON WORKS!');

    // Try direct URL navigation
    window.location.href = '/catalogos/mcc-operations/management';
  }

  private loadMccOperations(mccCode: string): void {
    console.log('loadMccOperations called with mccCode:', mccCode);
    this.loadingOperations = true;
    this.loadingAvailable = true;

    // Load current operations for this MCC
    this.mccOperationsService.getOperationsByMccCode(mccCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operations) => {
          console.log('Operations loaded:', operations);
          this.currentOperations = operations.sort((a, b) => a.display_order - b.display_order);
          this.loadingOperations = false;
        },
        error: (error) => {
          console.error('Error loading operations:', error);
          this.toastService.error('Error loading operations for this MCC');
          this.loadingOperations = false;
        }
      });

    // Load available operations that can be assigned
    this.mccOperationsService.getAvailableOperationsForMcc(mccCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (operations) => {
          this.availableOperations = operations;
          this.loadingAvailable = false;
        },
        error: (error) => {
          console.error('Error loading available operations:', error);
          this.toastService.error('Error loading available operations');
          this.loadingAvailable = false;
        }
      });
  }

  toggleAvailableOperations(): void {
    this.showAvailableOperations = !this.showAvailableOperations;
  }

  assignOperation(): void {
    if (!this.selectedAvailableOperation || !this.selectedMcc) {
      this.toastService.warning('Please select an operation to assign');
      return;
    }

    const selectedMcc = this.selectedMcc;
    const operationCode = this.selectedAvailableOperation.operation_code;

    this.mccOperationsService.assignOperationToMcc(
      selectedMcc.mcc,
      operationCode,
      this.currentOperations.length + 1
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newOperation) => {
          this.toastService.success(`Operation "${newOperation.name}" assigned to MCC ${selectedMcc.mcc}`);
          this.selectedAvailableOperation = null;
          this.showAvailableOperations = false;
          // Reload operations and update count
          this.loadMccOperations(selectedMcc.mcc);
          this.updateMccOperationsCount(selectedMcc.mcc);
        },
        error: (error) => {
          console.error('Error assigning operation:', error);
          this.toastService.error('Error assigning operation to MCC');
        }
      });
  }

  removeOperation(operation: MccOperation): void {
    if (!this.selectedMcc) return;

    const selectedMcc = this.selectedMcc;
    const operationName = operation.name;

    if (confirm(`Are you sure you want to remove "${operationName}" from MCC ${selectedMcc.mcc}?`)) {
      this.mccOperationsService.removeOperationFromMcc(
        selectedMcc.mcc,
        operation.operation_code
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.success(`Operation "${operationName}" removed from MCC ${selectedMcc.mcc}`);
            // Reload operations and update count
            this.loadMccOperations(selectedMcc.mcc);
            this.updateMccOperationsCount(selectedMcc.mcc);
          },
          error: (error) => {
            console.error('Error removing operation:', error);
            this.toastService.error('Error removing operation from MCC');
          }
        });
    }
  }

  private async updateMccOperationsCount(mccCode: string): Promise<void> {
    try {
      const info = await this.mccOperationsService.getMccInfo(mccCode).toPromise();
      const mccIndex = this.mccList.findIndex(m => m.mcc === mccCode);
      if (mccIndex !== -1 && this.selectedMcc) {
        this.mccList[mccIndex].operations_count = info?.operations_count || 0;
        this.selectedMcc.operations_count = info?.operations_count || 0;
      }
    } catch (error) {
      console.error('Error updating operations count:', error);
    }
  }

  getFilteredMccList(): MccWithOperations[] {
    if (!this.searchTerm) {
      return this.mccList || [];
    }

    const searchLower = this.searchTerm.toLowerCase();
    return (this.mccList || []).filter(mcc =>
      mcc.mcc.toLowerCase().includes(searchLower) ||
      mcc.description.toLowerCase().includes(searchLower)
    );
  }

  getTipLabel(requiresTip: number): string {
    switch (requiresTip) {
      case 0: return 'No';
      case 1: return 'Optional';
      case 2: return 'Required';
      default: return 'No';
    }
  }

  getCategoryColor(categoryCode: string): string {
    const colors: { [key: string]: string } = {
      'FOOD_58X': 'success',
      'SERVICES_3XX': 'primary',
      'TRANSPORT_4XX': 'info',
      'RETAIL_5XX': 'warning',
      'BUSINESS_7XX': 'secondary',
      'PROFESSIONAL_8XX': 'dark'
    };
    return colors[categoryCode] || 'light';
  }

  getCategoryBadgeClass(categoryCode: string): string {
    const classes: { [key: string]: string } = {
      'FOOD_58X': 'bg-success',
      'SERVICES_3XX': 'bg-primary',
      'TRANSPORT_4XX': 'bg-info',
      'RETAIL_5XX': 'bg-warning',
      'BUSINESS_7XX': 'bg-secondary',
      'PROFESSIONAL_8XX': 'bg-dark'
    };
    return classes[categoryCode] || 'bg-light';
  }

  getTotalOperations(): number {
    return this.mccList.reduce((sum, mcc) => sum + mcc.operations_count, 0);
  }

  trackByMcc(index: number, mcc: MccWithOperations): string {
    return mcc.mcc;
  }

  getTipBadgeClass(requiresTip: number): string {
    switch (requiresTip) {
      case 0: return 'bg-light';
      case 1: return 'bg-warning';
      case 2: return 'bg-danger';
      default: return 'bg-light';
    }
  }

  closeMccDetails(): void {
    this.selectedMcc = null;
    this.currentOperations = [];
    this.availableOperations = [];
    this.showAvailableOperations = false;
  }
}

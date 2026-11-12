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
  selector: 'app-mcc-operations-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './mcc-operations-view.component.html',
  styleUrls: ['./mcc-operations-view.component.css']
})
export class MccOperationsViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  mccList: MccWithOperations[] = [];
  selectedMcc: MccWithOperations | null = null;
  currentOperations: MccOperation[] = [];

  // UI State
  loading = false;
  loadingOperations = false;
  searchTerm = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private mccOperationsService: MccOperationsService,
    private toastService: ToastrService
  ) {}

  ngOnInit(): void {
    console.log('MccOperationsViewComponent initialized - VIEW MODE');
    alert('VIEW COMPONENT LOADED!');

    // Check for URL parameters
    this.route.paramMap.subscribe(params => {
      const mccCode = params.get('mccCode');
      console.log('URL MCC Code found:', mccCode);
      if (mccCode) {
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
    this.loading = true;
    try {
      const mccCodes = (await this.mccOperationsService.getAllMccCodes().toPromise()) || [];

      // Load operations count for each MCC
      await this.loadMccWithOperations(mccCodes);

      // Select the specific MCC after data is loaded
      const targetMcc = this.mccList.find(m => m.mcc === mccCode);
      if (targetMcc) {
        console.log('Auto-selecting MCC:', targetMcc);
        this.selectedMcc = targetMcc;
        this.loadMccOperations(targetMcc.mcc);
      } else {
        console.error('MCC not found:', mccCode);
        console.log('Available MCCs:', this.mccList.map(m => m.mcc));
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
    const mccList: MccWithOperations[] = [];

    for (const mcc of mccCodes) {
      try {
        // Get MCC info with operations count
        const info = await this.mccOperationsService.getMccInfo(mcc.mcc).toPromise();

        const mccWithOps: MccWithOperations = {
          id_mcc: mcc.id_mcc,
          mcc: mcc.mcc,
          description: mcc.description,
          operations_count: info?.operations_count || 0,
          category: info?.category || null,
          loading: false
        };

        mccList.push(mccWithOps);
      } catch (error) {
        console.error(`Error loading info for MCC ${mcc.mcc}:`, error);
        // Still add the MCC with 0 operations
        mccList.push({
          id_mcc: mcc.id_mcc,
          mcc: mcc.mcc,
          description: mcc.description,
          operations_count: 0,
          category: null,
          loading: false
        });
      }
    }

    // Sort by MCC code
    this.mccList = mccList.sort((a, b) => a.mcc.localeCompare(b.mcc));
    this.loading = false;
  }

  viewMcc(mcc: MccWithOperations): void {
    console.log('VIEW BUTTON CLICKED!');
    console.log('MCC DATA:', mcc);
    const targetUrl = `/catalogos/mcc-operations/view/${mcc.mcc}`;
    console.log('TARGET URL:', targetUrl);

    // Use direct navigation
    window.location.href = targetUrl;
  }

  manageMcc(mcc: MccWithOperations): void {
    console.log('MANAGE BUTTON CLICKED!');
    console.log('MCC DATA:', mcc);
    const targetUrl = `/catalogos/mcc-operations/manage/${mcc.mcc}`;
    console.log('TARGET URL:', targetUrl);

    // Navigate to management view
    window.location.href = targetUrl;
  }

  private loadMccOperations(mccCode: string): void {
    console.log('loadMccOperations called with mccCode:', mccCode);
    this.loadingOperations = true;

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
  }

  testDirectNavigation(): void {
    console.log('TEST NAVIGATION IN VIEW COMPONENT!');
    alert('VIEW COMPONENT TEST BUTTON WORKS!');
  }
}

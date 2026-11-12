import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { MccOperationsService } from '@/app/services/catalogues/mcc-operations/mcc-operations.service';
import { MccOperationInterface } from '@/app/shared/interfaces/mcc-operations-interface';

@Component({
  selector: 'app-mcc-operations-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mcc-operations-form.component.html',
  styleUrl: './mcc-operations-form.component.css'
})
export default class MccOperationsFormComponent implements OnInit {

  operationForm: FormGroup;
  isEdit = false;
  operationId: number | null = null;
  loading = false;
  submitted = false;

  // Options for form
  mccRangeOptions = [
    { value: '300', label: '300-399: Travel & Entertainment' },
    { value: '400', label: '400-499: Transportation' },
    { value: '500', label: '500-599: Retail Stores' },
    { value: '700', label: '700-799: Business Services' },
    { value: '800', label: '800-899: Professional Services' }
  ];

  tipOptions = [
    { value: 0, label: 'No' },
    { value: 1, label: 'Optional' },
    { value: 2, label: 'Required' }
  ];

  msgTypeOptions = [
    { value: '0200', label: '0200 - Authorization' },
    { value: '0220', label: '0220 - Reversal' },
    { value: '0420', label: '0420 - Reversal' }
  ];

  iconOptions = [
    'login', 'logout', 'restaurant', 'shopping_cart', 'car', 'route', 
    'wallet', 'briefcase', 'arrow_in', 'arrow_out', 'download', 
    'medical', 'pill', 'user_tie', 'book', 'plus', 'calendar', 'return'
  ];

  constructor(
    private fb: FormBuilder,
    private mccOperationsService: MccOperationsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private toastSrv: ToastrService
  ) {
    this.operationForm = this.createForm();
  }

  ngOnInit(): void {
    this.checkEditMode();
  }

  createForm(): FormGroup {
    return this.fb.group({
      mcc_range_start: ['', Validators.required],
      mcc_range_end: [''],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
      operation_code: ['', [Validators.required, Validators.maxLength(20)]],
      msg_type: ['0200'],
      processing_code: ['000000', Validators.maxLength(6)],
      requires_amount: [1, Validators.required],
      requires_tip: [0, Validators.required],
      active: [1, Validators.required],
      display_order: [0, Validators.required],
      icon_name: ['']
    });
  }

  checkEditMode(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.operationId = parseInt(id);
      this.loadOperation(this.operationId);
    }
  }

  loadOperation(id: number): void {
    this.loading = true;
    this.mccOperationsService.getAllOperations().subscribe({
      next: (operations) => {
        const operation = operations.find(op => op.id_operation === id);
        if (operation) {
          this.operationForm.patchValue(operation);
        } else {
          this.toastSrv.error('Operation not found');
          this.router.navigate(['/pages/catalogs/mcc-operations']);
        }
        this.loading = false;
      },
      error: (error) => {
        this.toastSrv.error('Error loading operation');
        this.loading = false;
        console.error('Error loading operation:', error);
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;
    
    if (this.operationForm.invalid) {
      return;
    }

    this.loading = true;
    const operationData = this.operationForm.value;

    if (this.isEdit && this.operationId) {
      this.mccOperationsService.updateOperation(this.operationId, operationData).subscribe({
        next: () => {
          this.toastSrv.success('Operation updated successfully');
          this.router.navigate(['/pages/catalogs/mcc-operations']);
        },
        error: (error) => {
          this.toastSrv.error('Error updating operation');
          this.loading = false;
          console.error('Error updating operation:', error);
        }
      });
    } else {
      this.mccOperationsService.createOperation(operationData).subscribe({
        next: () => {
          this.toastSrv.success('Operation created successfully');
          this.router.navigate(['/pages/catalogs/mcc-operations']);
        },
        error: (error) => {
          this.toastSrv.error('Error creating operation');
          this.loading = false;
          console.error('Error creating operation:', error);
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/pages/catalogs/mcc-operations']);
  }

  // Helper methods
  getMccRangeDisplay(): string {
    const start = this.operationForm.get('mcc_range_start')?.value;
    const end = this.operationForm.get('mcc_range_end')?.value;
    return end ? `${start}-${end}` : start;
  }

  getSelectedIcon(): string {
    return this.operationForm.get('icon_name')?.value || '';
  }

  // Form validation helpers
  get f() {
    return this.operationForm.controls;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.operationForm.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched || this.submitted)) : false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.operationForm.get(fieldName);
    if (!field) return '';

    if (field.errors?.['required']) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    if (field.errors?.['maxlength']) {
      return `Maximum length is ${field.errors['maxlength'].requiredLength} characters`;
    }
    return '';
  }
}

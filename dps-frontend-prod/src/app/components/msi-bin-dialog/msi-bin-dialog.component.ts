import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MsiBinFormData } from '../../shared/interfaces/msi.interface';

export interface BinDialogData {
  mode: 'add' | 'edit';
  bin?: {
    id_msi_bin: number;
    bin_start: string;
    bin_end: string;
    bank_name: string;
    card_brand: string;
    active: boolean;
  };
}

export interface BinDialogResult {
  action: 'add' | 'edit' | 'delete' | 'cancel';
  data?: MsiBinFormData;
  id?: number;
}

@Component({
  selector: 'app-msi-bin-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    ReactiveFormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.mode === 'add' ? 'add_circle' : 'edit' }}</mat-icon>
      {{ data.mode === 'add' ? 'Agregar Nuevo Rango BIN' : 'Editar Rango BIN' }}
    </h2>
    <mat-dialog-content>
      <form [formGroup]="binForm" class="bin-dialog-form">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>BIN Inicio</mat-label>
            <input matInput
                   formControlName="bin_start"
                   placeholder="400000"
                   maxlength="6">
            <mat-hint>6 dígitos del BIN inicial</mat-hint>
            <mat-error *ngIf="binForm.get('bin_start')?.hasError('required')">
              BIN inicio es requerido
            </mat-error>
            <mat-error *ngIf="binForm.get('bin_start')?.hasError('pattern')">
              Debe ser exactamente 6 dígitos
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>BIN Fin</mat-label>
            <input matInput
                   formControlName="bin_end"
                   placeholder="499999"
                   maxlength="6">
            <mat-hint>6 dígitos del BIN final</mat-hint>
            <mat-error *ngIf="binForm.get('bin_end')?.hasError('required')">
              BIN fin es requerido
            </mat-error>
            <mat-error *ngIf="binForm.get('bin_end')?.hasError('pattern')">
              Debe ser exactamente 6 dígitos
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Banco</mat-label>
            <input matInput
                   formControlName="bank_name"
                   placeholder="Nombre del banco">
            <mat-error *ngIf="binForm.get('bank_name')?.hasError('required')">
              El nombre del banco es requerido
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Marca de Tarjeta</mat-label>
            <mat-select formControlName="card_brand">
              <mat-option value="Visa">Visa</mat-option>
              <mat-option value="Mastercard">Mastercard</mat-option>
              <mat-option value="Amex">American Express</mat-option>
              <mat-option value="Discover">Discover</mat-option>
            </mat-select>
            <mat-error *ngIf="binForm.get('card_brand')?.hasError('required')">
              La marca es requerida
            </mat-error>
          </mat-form-field>
        </div>

        <div class="form-row toggle-row" *ngIf="data.mode === 'edit'">
          <mat-slide-toggle formControlName="active" color="primary">
            {{ binForm.get('active')?.value ? 'Activo' : 'Inactivo' }}
          </mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button
              color="primary"
              (click)="onSubmit()"
              [disabled]="!binForm.valid">
        <mat-icon>{{ data.mode === 'add' ? 'add' : 'save' }}</mat-icon>
        {{ data.mode === 'add' ? 'Agregar' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .bin-dialog-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 400px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .toggle-row {
      grid-template-columns: 1fr;
      align-items: center;
    }

    h2 mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 600px) {
      .bin-dialog-form {
        min-width: auto;
      }
      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MsiBinDialogComponent {
  binForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MsiBinDialogComponent, BinDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: BinDialogData
  ) {
    this.binForm = this.fb.group({
      bin_start: [
        { value: data.bin?.bin_start || '', disabled: data.mode === 'edit' },
        [Validators.required, Validators.pattern('^[0-9]{6}$')]
      ],
      bin_end: [
        { value: data.bin?.bin_end || '', disabled: data.mode === 'edit' },
        [Validators.required, Validators.pattern('^[0-9]{6}$')]
      ],
      bank_name: [data.bin?.bank_name || '', Validators.required],
      card_brand: [data.bin?.card_brand || 'Visa', Validators.required],
      active: [data.bin?.active ?? true]
    });
  }

  onSubmit(): void {
    if (this.binForm.invalid) return;

    const formData: MsiBinFormData = {
      bin_start: this.binForm.get('bin_start')?.value,
      bin_end: this.binForm.get('bin_end')?.value,
      bank_name: this.binForm.get('bank_name')?.value,
      card_brand: this.binForm.get('card_brand')?.value,
      active: this.binForm.get('active')?.value
    };

    this.dialogRef.close({
      action: this.data.mode,
      data: formData,
      id: this.data.bin?.id_msi_bin
    });
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }
}

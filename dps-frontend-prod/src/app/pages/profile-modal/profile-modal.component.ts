import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { InputTextComponent } from "../../shared/components/inputs/input-text/input-text.component";
import { ModalContentComponent } from "../../shared/components/modal-content/modal-content.component";
import { CommonModule } from '@angular/common';
import { ActionButtonComponent } from "../../shared/components/action-button/action-button.component";
import { TextTypeComponent } from "../../shared/components/text-type/text-type.component";
import { SharedService } from '@/app/services/shared/shared.service';
import { UsersService } from '@/app/services/security/users/users.service';
import { filter, map, Subject, takeUntil, tap } from 'rxjs';
import { utils } from '@/app/utils/utils';
import { sameAs, strongPassword } from '@/app/shared/validations/general.valiation';
import { ToastrService } from 'ngx-toastr';
import { UserInfo } from '@/app/shared/interfaces/user-info.interface';

@Component({
    selector: 'app-profile-modal',
    imports: [InputTextComponent, ModalContentComponent, CommonModule, ReactiveFormsModule, ActionButtonComponent, TextTypeComponent],
    templateUrl: './profile-modal.component.html',
    styleUrl: './profile-modal.component.css'
})
export class ProfileModalComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  formGroup: FormGroup;
  userInfo: UserInfo | null = null;
  idClient: any = null;

  @Input() isVisible: boolean = false;

  @Output() visibleChange = new EventEmitter<boolean>();


  constructor(
    private sharedService: SharedService,
    private fb: FormBuilder,
    private userService: UsersService,
    private toastService: ToastrService
  ) {
    this.formGroup = this.fb.group({
      name: [''],
      lastName: [''],
      telephone: [''],
      mail: ['', [Validators.required, Validators.email]],
      oldPass: [''],
      newPass: ['', strongPassword()],
      confirmPass: ['', sameAs('newPass')],
    },
    );
  }

  get userCapital(): string {
    if (this.userInfo && this.userInfo.name && this.userInfo.last_name) {
        const firstNameInitial = this.userInfo.name.charAt(0).toUpperCase();
        const lastNameInitial = this.userInfo.last_name.charAt(0).toUpperCase();
        return `${firstNameInitial}${lastNameInitial}`;
    }
    return '';
}



ngOnInit(): void {
  this.sharedService.userInfo$.pipe(
    tap(response => {
      this.userInfo = response as UserInfo;
      this.fillForm();
    }),
    takeUntil(this.destroy$)
  ).subscribe();
}

  fillForm() {
    this.formGroup.patchValue({
      name: this.userInfo?.name,
      lastName: this.userInfo?.last_name,
      telephone: this.userInfo?.telephone,
      mail: this.userInfo?.mail
    })
  }

  getDataForm() {
    this.formGroup.markAllAsTouched();
    const dataChanged = this.getChangedValues();
    const isFormChanged = Object.keys(dataChanged).length !== 0;
    if (!this.formGroup.invalid) {
      isFormChanged ? this.filterData(dataChanged) : this.closeModal()
    } else {
      this.toastService.info('Revisa la información ingresada.')
    }
  }

  filterData(data: any) {
    if (data.newPass) {
      const isPassValid = this.newPassValidator();
      if (isPassValid) {
        const newData = this.encryptData(data)
        this.updateDataUser(newData);
      }
    } else {
      const newData = this.nonPassData(data);
      this.updateDataUser(newData);
    }
  }

  updateDataUser(body: any) {
    this.userService.updateOwnUser(body).pipe(
      tap(response => {
        if (response.error) {
          this.toastService.error(response.msg)
        } else {
          this.toastService.success(response.message)
          this.isVisible = false;
          this.visibleChange.emit(this.isVisible);
          this.updateSharedInfo(body);
        }
      }),
    ).subscribe()
  }

  private newPassValidator(): boolean {
    const newPass = this.formGroup.get('newPass')?.value;
    const confirmPass = this.formGroup.get('confirmPass')?.value;
    const oldPass = this.formGroup.get('oldPass')?.value;

    if (newPass && confirmPass) {
      if (oldPass) {
        return true;
      } else {
        this.toastService.error('El campo Contraseña Actual es requerido')
        return false;
      }
    }

    if (newPass && !confirmPass) {
      ('newPassValidator')
      this.toastService.info('Revisa la información ingresada.')
      return false
    }
    ('newPassValidator')
    return false
  }

  nonPassData(data: any): any {
    const { oldPass, ...filteredData } = data;
    return filteredData
  }

  closeModal() {
    if (this.isVisible) {
      this.isVisible = false;
      this.visibleChange.emit(this.isVisible);
      this.fillForm()
    }
  }

  getChangedValues() {
    const changedValues: { [key: string]: any } = {};

    Object.keys(this.formGroup.controls).forEach(key => {
      const control = this.formGroup.get(key);
      if (control?.dirty) {
        changedValues[key] = control.value;
      }
    });
    return changedValues;
  }

  encryptData(data: any): any {
    const fieldsToEncrypt = ['oldPass', 'newPass', 'confirmPass'];

    return Object.keys(data).reduce((acc: any, key) => {
      acc[key] = fieldsToEncrypt.includes(key) ? this.encryptPsw(data[key]) : data[key];
      return acc;
    }, {});
  }

  private encryptPsw(password: string) {
    const sha256: string = utils.getSHA256(password)
    return btoa(sha256)
  }

  updateSharedInfo(data: any){
    if(this.userInfo) {
      if (data.mail) this.userInfo.mail = data.mail;
      if (data.telephone) this.userInfo.telephone = data.telephone;
      if (data.name) this.userInfo.name = data.name;
      if (data.lastName) this.userInfo.last_name = data.lastName;
      this.userInfo.fullName = `${this.userInfo.name || ''} ${this.userInfo.last_name || ''}`.trim();
      this.sharedService.shareUserInfo(this.userInfo);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['isVisible'] && !changes['isVisible'].currentValue) {
      this.formGroup.patchValue({
        oldPass: '',
        newPass: '',
        confirmPass: ''
      });

      this.formGroup.get('oldPass')?.markAsPristine();
      this.formGroup.get('newPass')?.markAsPristine();
      this.formGroup.get('confirmPass')?.markAsPristine();

      this.formGroup.markAsUntouched();

      this.destroy$.next();
      this.destroy$.complete();
    }
  }

}

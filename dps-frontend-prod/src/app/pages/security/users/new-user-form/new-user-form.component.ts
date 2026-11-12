import { ClientsService } from '@/app/services/clients/clients.service';
import { ProfilesService } from '@/app/services/security/profiles/profiles.service';
import { UsersService } from '@/app/services/security/users/users.service';
import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { SubmitTypeInterface } from '@/app/shared/interfaces/submit-type';
import { utils } from '@/app/utils/utils';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { map, Subject, takeUntil, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { sameAs, strongPassword } from '@/app/shared/validations/general.valiation';
import { SharedService } from '@/app/services/shared/shared.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-user-form',
    imports: [CommonModule, SectionTitleComponent, CardContainerComponent, InputTextComponent, ActionButtonComponent, InputSelectComponent, TextTitleComponent, ReactiveFormsModule],
    templateUrl: './new-user-form.component.html',
    styleUrl: './new-user-form.component.css'
})
export class NewUserFormComponent implements OnInit, OnDestroy{


  constructor(
    private profileService: ProfilesService,
    private router: Router,
    private formBuilder: FormBuilder,
    private toastService: ToastrService,
    private userService: UsersService,
    private clientService: ClientsService,
    private route: ActivatedRoute,
    private sharedService: SharedService,
    private formTrimService: FormTrimService
  ) {
    this.userFormGroup = this.formBuilder.group({
      username: [{ value: '', disabled: false }, Validators.required],
      mail: ['', [Validators.required, Validators.email]],
      name: ['', Validators.required],
      last_name: [''],
      telephone: [''],
      password: ['', strongPassword()],
      retryPassword: ['', sameAs('password')],
      id_profile: ['', Validators.required],
      id_cliente: ['', Validators.required],
    })
  }

  linkText: string[] = ['/usuarios'];
  title: string = 'Nuevo Usuario';
  subtitle: string = 'Datos Para Nuevo Usuario'
  userFormGroup: FormGroup;
  idProfile: SubmitTypeInterface = {};
  idClient: SubmitTypeInterface = {};
  idUser: number | null = null;
  isOwnUser: boolean = false;
  currentUser: any | null = null;


  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.getClient();
    this.getProfiles();

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.idUser = parseInt(id);

    if (this.idUser) {
      this.userService.getUsers().pipe(
        map((users: any[]) => users.find((user: any) => user.id_user === this.idUser)),
        takeUntil(this.destroy$)
      ).subscribe(user => {
        if (user) {
          this.title = `Editando Usuario: ${user.name}`;
          this.subtitle = `Datos de ${user.name}`;
          this.fillFormToEdit(user);
        } else {
          const passwordControl = this.userFormGroup.get('password');
          const confirm = this.userFormGroup.get('retryPassword');
          confirm?.addValidators(Validators.required);
          confirm?.updateValueAndValidity();
          passwordControl?.addValidators(Validators.required);
          passwordControl?.updateValueAndValidity();
        }
      });
    }

    this.sharedService.userInfo$.pipe(
      map(response => 
        this.currentUser = response)
    ).subscribe();
  }

  getOwnUser(user: number): boolean {
    return this.currentUser.idClient === user;
}

  fillFormToEdit(data: any) {
    this.userFormGroup.patchValue({
      username: data.username,
      mail: data.mail,
      name: data.name,
      last_name: data.last_name,
      telephone: data.telephone,
      id_profile: data.id_profile,
      id_cliente: data.id_cliente == null ? 0 : data.id_cliente
    })
    const idUser = data.id_user;
    this.isOwnUser = this.getOwnUser(idUser);
  }

  getProfiles() {
    this.profileService.getProfiles().pipe(
      map((response) => {
        const profilesList: SubmitTypeInterface = response.reduce((pv: SubmitTypeInterface, option) => {
          pv[option.Nombre] = option.Id;
          return pv;
        }, {});
        this.idProfile = profilesList;
      }),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  getClient(){
    this.clientService.getClients().pipe(
      map((response) => {
        const clientList: SubmitTypeInterface = response.reduce((pv: SubmitTypeInterface, option) => {
          pv[option['Nombre Cliente']] = option.Id;
          return pv;
        }, {'* GENERAL' : 0});
        this.idClient = clientList
      }),
      takeUntil(this.destroy$),
    ).subscribe()
  }

  saveForm(): void {
    this.userFormGroup.markAllAsTouched();
    if(!this.userFormGroup.invalid){
      this.formTrimService.trimFormValues(this.userFormGroup)
      const user = {
        id_user: this.idUser,
        username: this.userFormGroup.value.username,
        mail: this.userFormGroup.value.mail,
        name: this.userFormGroup.value.name,
        last_name: this.userFormGroup.value.last_name,
        sur_name: '',
        telephone: this.userFormGroup.value.telephone,
        password: this.encryptPsw(),
        id_profile: this.userFormGroup.value.id_profile,
        id_cliente: this.userFormGroup.value.id_cliente == 0 ? null : parseInt(this.userFormGroup.value.id_cliente),
        picture: '',
        change_password: null,
        online: 0,
        intento: 0,
      }
      this.idUser ?
        this.updateUser(user)
        : this.createNewUser(user)
    }else {
      this.toastService.info('Revisa la información ingresada.')
    }
  }
  
  private encryptPsw() {
    if(this.userFormGroup.value.password == '') {
      return '';
    }
    const sha256: string = utils.getSHA256(this.userFormGroup.value.password)
    return btoa(sha256)
  }

  updateUser(user :any){
    this.isOwnUser
      ? this.updateOwnUser(user)
        : this.updateAnotherUser(user);
  }

  updateOwnUser(user:any) {
    this.userService.updateOwnUser(user).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.successUpdate('Usuario actualizado exitosamente');
        this.updateSharedData(user)
      },
      error: (error) => {
        this.toastService.error( error.error.message);
      }
    })
  }

  successUpdate(message : string){
    this.toastService.success(message);
        this.router.navigate(this.linkText);
  }

  updateSharedData(data: any) {
    if(this.currentUser) {
      if (data.mail) this.currentUser.mail = data.mail;
      if (data.telephone) this.currentUser.telephone = data.telephone;
      if (data.name) this.currentUser.name = data.name;
      if (data.lastName) this.currentUser.last_name = data.lastName;
      this.currentUser.fullName = `${this.currentUser.name || ''} ${this.currentUser.last_name || ''}`.trim();
      this.sharedService.shareUserInfo(this.currentUser);
    }
  }

  updateAnotherUser(user :any) {
    this.userService.updateUser(this.idUser, user).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.successUpdate('Usuario actualizado exitosamente')
      },
      error: (error) => {
        this.toastService.error( error.error.message);
      }
    })
  }

  createNewUser(user :any) {
    this.userService.createNewUser(user).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.successUpdate('Usuario creado exitosamente');
      },
      error: (error) => {
        this.toastService.error( error.error.message);
      },
    })
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}

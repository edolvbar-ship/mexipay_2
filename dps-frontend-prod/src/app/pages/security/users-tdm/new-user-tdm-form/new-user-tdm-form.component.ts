import { UsersTDMService } from '@/app/services/security/usersTDM/users-tdm.service';
import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { DataUsersTDMServiceInterface } from '@/app/shared/interfaces/users-tdm-service.interface';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FormDataService } from '@/app/services/shared/form-data/form-data.service';
import { ToastrService } from 'ngx-toastr';
import { ToggleSwitchComponent } from "@/app/shared/components/inputs/input-switch/input-switch.component";
import { sameAs, strongPassword } from '@/app/shared/validations/general.valiation';
import { map, Subject, takeUntil, tap } from 'rxjs';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-user-tdm-form',
    imports: [SectionTitleComponent, CardContainerComponent, ActionButtonComponent, InputTextComponent, TextTitleComponent, ReactiveFormsModule, ToggleSwitchComponent],
    templateUrl: './new-user-tdm-form.component.html',
    styleUrl: './new-user-tdm-form.component.css'
})
export class NewUserTDMFormComponent implements OnInit, OnDestroy{


  linkText: string[] = ['/usuarios-tdm']
  title: string = 'Nuevo Usuario TDM';
  subtitle: string = 'Datos Para Nuevo Usuario TDM'
  newTDMFormGroup: FormGroup;
  idUser: number | null = null;
  user = {
    name: '',
    apellido: '',
    apellido_2: '',
    email: '',
    estado: false,
    password: ''
  };

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private TDMService: UsersTDMService,
    private router: Router,
    private formDataService: FormDataService,
    private toastService: ToastrService,
    private route: ActivatedRoute,
    private formTrimService: FormTrimService
  ) {

    this.newTDMFormGroup = this.formBuilder.group({
      apellido: ['', Validators.required],
      apellido_2: '',
      email: ['', Validators.required],
      estado: [true],
      password: ['', strongPassword()],
      retryPassword: ['', sameAs('password')],
      name: ['', Validators.required]
    }
  )

  }

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.idUser = parseInt(id);

    if (this.idUser) {
      this.TDMService.getUsersTDM().pipe(
        map((users: any[]) => users.find((user: any) => user.iduser === this.idUser)),
        takeUntil(this.destroy$)
      ).subscribe(user => {
        if (user) {
          this.title = `Editando Usuario: ${user.first_name}`;
          this.subtitle = `Datos de ${user.first_name}`;
          this.fillFormToEdit(user);
        } else {
          const passwordControl = this.newTDMFormGroup.get('password');
          const confirm = this.newTDMFormGroup.get('retryPassword');
          confirm?.addValidators(Validators.required)
          confirm?.updateValueAndValidity();
          passwordControl?.addValidators(Validators.required);
          passwordControl?.updateValueAndValidity();
        }
      });
    }
  }

  fillFormToEdit(data: DataUsersTDMServiceInterface) {
    this.newTDMFormGroup.patchValue({
      apellido: data.last_name,
      apellido_2: data.last_name2,
      email: data.email,
      estado: data.estado === 'Activo',
      name: data.first_name
    })
  }




  transformData(){
    this.user = {
      name:  this.newTDMFormGroup.value.name,
      apellido: this.newTDMFormGroup.value.apellido,
      apellido_2: this.newTDMFormGroup.value.apellido_2,
      email: this.newTDMFormGroup.value.email,
      estado: this.newTDMFormGroup.value.estado || false,
      password: this.newTDMFormGroup.value.password
    }
    this.idUser
      ? this.updateUserTDB()
        : this.createNewTDB()
  }

  createNewTDB() {
    this.TDMService.postCreateNewTDM(this.user).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toastService.success('Usuario creado exitosamente');
        this.router.navigate(['/usuarios-tdm']);
        this.formDataService.clearCurrentDataForm();
      },
      error: (error) => {
        this.toastService.error( error);
      }
    })
  }

  updateUserTDB() {
    this.TDMService.updateUserTDM(this.idUser, this.user).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toastService.success('Usuario guardado')
        this.router.navigate(['/usuarios-tdm']);
        this.formDataService.clearCurrentDataForm();
      },
      error: (error) => {
        this.toastService.error(error)
      }
    }
    )
  }


  saveForm():void {
    this.newTDMFormGroup.markAllAsTouched();
    if(!this.newTDMFormGroup.invalid){
      this.formTrimService.trimFormValues(this.newTDMFormGroup)
      this.transformData();
    }else {
      this.toastService.info('Revisa la información ingresada.')
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

  }

}

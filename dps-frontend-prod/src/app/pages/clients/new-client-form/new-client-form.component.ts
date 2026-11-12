import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { CountriesService } from '@/app/services/shared/countries-service/countries.service';
import { SubmitTypeInterface } from '@/app/shared/interfaces/submit-type';
import { catchError, of, Subject, Subscription, takeUntil, tap } from 'rxjs';
import { ClientsService } from '@/app/services/clients/clients.service';
import { ToastrService } from 'ngx-toastr';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";
import { InputTextareaComponent } from '@/app/shared/components/inputs/input-textarea/input-textarea.component';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

interface StatesInterface {
  id_state: number
  name: string
  alpha_2_code: string
  alpha_3_code: string
  creation_date: string
  last_update: string
}

@Component({
    selector: 'app-new-client-form',
    imports: [InputTextareaComponent, TextTitleComponent, SectionTitleComponent, CardContainerComponent, InputTextComponent, InputSelectComponent, CommonModule, ReactiveFormsModule, InputTextModule, ActionButtonComponent],
    templateUrl: './new-client-form.component.html',
    styleUrl: './new-client-form.component.css'
})
export default class NewClientFormComponent implements OnInit, OnDestroy {

  @ViewChild('emailRef') inputText!: InputTextComponent;
  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private countrieService: CountriesService,
    private clientsService: ClientsService,
    private toastService: ToastrService,
    private formTrimService: FormTrimService
  ) {

    this.clientData = this.formBuilder.group({
      personId: [null, Validators.required],
      commercialName: ['', Validators.required],
      companyName: ['', Validators.required],
      rfc: ['', [Validators.required, Validators.pattern(/([A-ZÑ]|\&){3,4}[0-9]{2}(0[1-9]|1[0-2])([12][0-9]|0[1-9]|3[01])[A-Z0-9]{3}$/)]],
      representative: ['', Validators.required],
      url: '',
      street: ['', Validators.required],
      outerNumber: ['', Validators.required],
      interiorNumber: '',
      suburb: ['', Validators.required],
      town: ['', Validators.required],
      state: [null, Validators.required],
      country: [null, Validators.required],
      zipCode: [null, Validators.required],
      commercialAgent: ['', Validators.required],
      description: ''
    })

    this.contactInfo = this.formBuilder.group({
      name: ['', Validators.required],
      commercialName: ['', Validators.required],
      email: ['', Validators.email],
      phoneNumber: null,
      alternativePhone: null,
      mobilePhone: null,
    })

    this.bankData = this.formBuilder.group({
      bank: ['', Validators.required],
      card: '',
      account: '',
      accountClabe: ['', Validators.required],
    })

  }

  countries: SubmitTypeInterface = {};
  personType: SubmitTypeInterface = {};
  states: any = {};
  idUser: number | null = null;
  clientData: FormGroup;
  contactInfo: FormGroup;
  bankData: FormGroup;

  initialClientData: any;
  initialContactInfo: any;
  initialBankData: any;
  sanitizedDescription: string = '';

  idAddress: number | null = null;
  idBankData: number | null = null;

  private destroy$ = new Subject<void>();


  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.idUser = parseInt(id);

    if (this.idUser) {
      this.clientsService.getClientById(this.idUser).pipe(
        takeUntil(this.destroy$),
        tap(response => {
          if (response) {
            this.fillFormToEdit(response.data);
            this.idAddress = response.data.id_direccion;
            this.idBankData = response.data.id_datos_bancarios;
          }
        }),
        catchError(error => {
          console.error('Error trayendo la información del cliente', error);
          return of(null);
        })
      ).subscribe();
    }

    this.countrieService.getCountries().pipe(
      tap((response) => {
        this.countries = response
      })
    ).subscribe()

    this.countrieService.getPersonType().pipe(
      tap((response) => {
        this.personType = response
      })
    ).subscribe()

    this.countrieService.getStates().pipe(
      tap((response) => {
        this.states = response
      })
    ).subscribe()
  }

  fillFormToEdit(data: any) {
    if (data) {
      this.updateClientData(data);
      this.updateBankInfo(data.bank);
      this.updateContactInfo(data)
    }

  }


  updateClientData(client: any) {
    this.clientData.patchValue({
      personId: client?.id_persona,
      commercialName: client?.razon_social,
      companyName: client?.name,
      rfc: client?.rfc,
      representative: client?.representative,
      url: client?.url,
      street: client?.address.calle,
      outerNumber: client?.address.no_ext,
      interiorNumber: client?.address.no_int,
      suburb: client?.address.colonia,
      town: client?.address.alcaldia,
      state: client?.address.id_state,
      country: client?.address.id_country,
      zipCode: client?.address.cp,
      commercialAgent: client?.agente,
      description: client?.description
    })
  }

  updateContactInfo(client: any) {
    this.contactInfo.patchValue({
      name: client?.contact_cliente,
      commercialName: client?.rol_contact,
      email: client?.email_contact,
      phoneNumber: client?.tel1_contact,
      alternativePhone: client?.tel2_contact,
      mobilePhone: client?.mobile_contact,
    })
  }

  updateBankInfo(client: any) {
    this.bankData.patchValue({
      bank: client?.banco,
      card: client?.tarjeta,
      account: client?.no_cuenta,
      accountClabe: client?.clabe,
    })
  }


  linkText: string[] = ['/clientes'];
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;

  saveForm(): void {
    this.clientData.markAllAsTouched();
    this.bankData.markAllAsTouched();
    this.contactInfo.markAllAsTouched();
    if (!this.clientData.invalid && !this.bankData.invalid && !this.contactInfo.invalid) {
      this.validateForm()
    } else {
      this.toastService.info('Revisa la información ingresada.');
    }
  }

  validateForm(): void {
    this.formTrimService.trimFormValues(this.clientData);
    this.formTrimService.trimFormValues(this.bankData);
    this.formTrimService.trimFormValues(this.contactInfo);
    this.transformData();
  }


  transformData(): void {
    const clientData = this.clientData?.value;
    const contactInfo = this.contactInfo?.value;
    const bankData = this.bankData?.value;
    const data = {
      "id_persona": clientData.personId,
      "name": clientData.commercialName,
      "razon_social": clientData.companyName,
      "rfc": clientData.rfc,
      "representative": clientData.representative,
      "url": clientData.url,
      "description": clientData.description,
      "agente": clientData.commercialAgent,
      "contact_cliente": contactInfo.name,
      "rol_contact": contactInfo.commercialName,
      "email_contact": contactInfo.email,
      "tel1_contact": contactInfo.phoneNumber,
      "tel2_contact": contactInfo.alternativePhone,
      "mobile_contact": contactInfo.mobilePhone,
      "dir.id_country": clientData.country,
      "dir.id_state": clientData.state,
      "dir.alcaldia": clientData.town,
      "dir.calle": clientData.street,
      "dir.no_ext": clientData.outerNumber,
      "dir.no_int": clientData.interiorNumber,
      "dir.cp": clientData.zipCode,
      "dir.colonia": clientData.suburb,
      "banco.banco": bankData.bank,
      "banco.tarjeta": bankData.card,
      "banco.no_cuenta": bankData.account,
      "banco.clabe": bankData.accountClabe
    };
    this.idUser
      ? this.updateClient(data)
      : this.sedNewClient(data)
  }

  sedNewClient(data: any) {
    this.clientsService.postCreateNewClient(data).subscribe({
      next: (response) => {
        this.toastService.success('Cliente creado exitosamente')
        this.router.navigate(['/clientes'])
      },
      error: (error) => {
        this.toastService.error('Ha habido un error al crear el cliente')
      }
    });
  }

  updateClient(data: any) {
    data.id_client = this.idUser
    data.id_direccion = this.idAddress
    data.id_datos_bancarios = this.idBankData
    const body = data
    this.clientsService.updateClient(body).subscribe({
      next: (response) => {
        this.toastService.success('Cliente actualizado exitosamente')
        this.router.navigate(['/clientes'])
      },
      error: (error) => {
        this.toastService.error('Ha habido un error al editar el cliente')
      }
    })
  }


  showFormErrors(formGroup: FormGroup, formName: string): void {
    this.isRequiredInvalid = true
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        const controlErrors: ValidationErrors | null = control.errors;
        if (controlErrors) {
          Object.keys(controlErrors).forEach(errorKey => {
            return `${formName} - ${key} has error: ${errorKey}`;
          });
        }
      }
    });
  }

  resetForm(): void {
    this.clientData.reset();
    this.contactInfo.reset();
    this.bankData.reset();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

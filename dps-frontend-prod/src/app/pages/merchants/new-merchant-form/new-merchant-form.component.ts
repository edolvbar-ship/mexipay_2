import { TransactionModeService } from '@/app/services/catalogues/transaction-mode/transaction-mode.service';
import { UrlTargetService } from '@/app/services/catalogues/url-target/url-target.service';
import { ClientsService } from '@/app/services/clients/clients.service';
import { MerchantsService } from '@/app/services/merchants/merchants.service';
import { CountriesService } from '@/app/services/shared/countries-service/countries.service';
import { TransactionProfilesService } from '@/app/services/catalogues/transaction-profiles/transaction-profiles.service';
import { MccOperationsService, MccOperation } from '@/app/services/catalogues/mcc-operations/mcc-operations.service';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';
import { ToggleSwitchComponent } from '@/app/shared/components/inputs/input-switch/input-switch.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { InputTextareaComponent } from '@/app/shared/components/inputs/input-textarea/input-textarea.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { ShowDataClient } from '@/app/shared/interfaces/clients.interface';
import { editMerchantInterface, MerchantFomrInterface } from '@/app/shared/interfaces/merchants-form';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, lastValueFrom, of, Subject, takeUntil, tap, withLatestFrom } from 'rxjs';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';
import { AboutService } from '@/app/services/about/about.service';
import { ProcessorInfoInterface } from '@/app/shared/interfaces/merchants.interface';
import { MsiConfigComponent } from '@/app/components/msi-config/msi-config.component';


@Component({
    selector: 'app-new-merchant-form',
    imports: [FormsModule, SectionTitleComponent, CardContainerComponent, InputTextComponent, InputSelectComponent, TextTitleComponent, TextTypeComponent, ReactiveFormsModule, CommonModule, InputTextareaComponent, ToggleSwitchComponent, ActionButtonComponent, MsiConfigComponent],
    templateUrl: './new-merchant-form.component.html',
    styleUrl: './new-merchant-form.component.css'
})
export class NewMerchantFormComponent implements OnInit, OnDestroy {

  linkText: string[] = ['/comercios'];
  newMerchantForm: FormGroup;
  taxAddressValue: boolean = true;
  taxAddress: boolean = true;
  idMerchant: number | null = null;
  msiType: string = '';
  isRequiredInvalid: boolean = false;

  //Arreglos para selects
  countriesData: any = []
  statesData: any = []
  personType: any = []
  clientData: any = []
  transSchemas: any = []
  mccData: any = []
  acqBankData: any = []
  logicalNtwData: any = []
  processorData: any = []
  profileTransData: any = []
  aggregatorName: any = []
  taxRegimenData: any = []
  transactionModeData: any = []
  urlTargetData: any = []

  // Decoded profile information
  profileCatalogs: any = null;
  rawProfiles: any[] = [];
  selectedProfileOperations: any = null;
  mccOperations: MccOperation[] = [];
  rawMccs: any[] = [];

  paymentTypesSet = new Set([3, 6, 9, 12, 18]); // to prevent repetitive types
  paymentTypes = [...this.paymentTypesSet];

  processorInfoGroup = new FormGroup({});

  showWhitelableBroxel = false;

  msiControlsReady: boolean = false;
  msiControls: any = []

  constructor(
    private formBuilder: FormBuilder,
    private toastService: ToastrService,
    private catalogService: CountriesService,
    private clientService: ClientsService,
    private merchantService: MerchantsService,
    private transactionProfilesService: TransactionProfilesService,
    private mccOperationsService: MccOperationsService,
    private transactionModeService: TransactionModeService,
    private urlTargetService: UrlTargetService,
    private router: Router,
    private route: ActivatedRoute,
    private formTrimService: FormTrimService,
    private aboutService: AboutService
  ) {

    this.newMerchantForm = this.formBuilder.group({
      same_address: [true],
      id_cliente: ['', Validators.required],
      id_tipo_persona: ['', Validators.required],
      razon_social: ['', Validators.required],
      nombre_comercio: ['', Validators.required],
      url_comercio: [''],
      rfc: ['', [Validators.required, Validators.pattern(/([A-ZÑ]|\&){3,4}[0-9]{2}(0[1-9]|1[0-2])([12][0-9]|0[1-9]|3[01])[A-Z0-9]{3}$/)]],
      representante: ['', Validators.required],
      agente_comercial: [''],
      descripcion: [''],
      id_esquema_transaccional: ['', Validators.required],
      numero_afilacion: ['', Validators.required],
      numero_subafiliacion: [{ value: '', disabled: true }],
      mcc: ['', Validators.required],
      acqbank: ['', Validators.required],
      id_red_logica: ['', Validators.required],
      id_procesador: ['', Validators.required],
      ln_agregador: ['', Validators.required],
      visa_payment_facilitator_id: ['', Validators.required],
      mc_payment_facilitator_id: ['', Validators.required],
      amex_payment_facilitator_id: [''],
      visa_independent_sales_organization_id: [''],
      mc_independent_sales_organization_id: [''],
      id_perfil_transaccional: ['', Validators.required],
      nombre_contacto: ['', Validators.required],
      rol_contacto: ['', Validators.required],
      email_contacto: ['', [Validators.required, Validators.email]],
      tel1_contacto: [''],
      tel2_contacto: [''],
      celular: [''],
      use_moreterminals: [null],
      active: [false],
      retencion: [0],
      taxRegimen: ['', Validators.required],
      withInvoices: [false],
      id_medio: [{ value: '', disabled: true },],
      url_dest: [{ value: '', disabled: true },],
      transaction_mode: [{ value: '', disabled: true },],
      "3DS": [0],
      "3DS_KEY": [{ value: '', disabled: true }],
      serie_terminal: [''],
      max_tx: ['', Validators.required],
      min_tx: ['10', [Validators.required, Validators.min(1)]],
      afiliation_link: [''],
      id_medio_link: [''],
      selia_id: [null], // Added selia_id field
      msi: this.formBuilder.array(this.paymentTypes.map(() => this.createPaymentGroup())),
      direccion: this.formBuilder.group({
        calle: ['', Validators.required],
        no_exterior: ['', Validators.required],
        no_interior: [''],
        colonia: ['', Validators.required],
        id_estado: ['', Validators.required],
        alcaldia: ['', Validators.required],
        ciudad: [''],
        codigo_postal: ['', [Validators.required, Validators.minLength(5)]],
        id_pais: ['', Validators.required]
      }),
      direccion_fiscal: this.formBuilder.group({
        calle: [{ value: '', disabled: true }, Validators.required],
        no_exterior: [{ value: '', disabled: true }, Validators.required],
        no_interior: [{ value: '', disabled: true }],
        colonia: [{ value: '', disabled: true }, Validators.required],
        id_estado: [{ value: '', disabled: true }, Validators.required],
        alcaldia: [{ value: '', disabled: true }, Validators.required],
        ciudad: [{ value: '', disabled: true }],
        codigo_postal: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(5)]],
        id_pais: [{ value: '', disabled: true }, Validators.required]
      }),
      datos_bancarios: this.formBuilder.group({
        banco: ['', Validators.required],
        clabe: ['', [Validators.required, Validators.minLength(18)]],
        tarjeta: ['', Validators.minLength(16)],
        no_cuenta: ['']
      }),
      processor_info: this.processorInfoGroup,
      tasas: this.formBuilder.group({
        banco: this.formBuilder.group({
          credito: [0],
          debito: [0],
          amex: [0]
        }),
        agregador: this.formBuilder.group({
          credito: [0],
          debito: [0],
          amex: [0]
        }),
        comercio: this.formBuilder.group({
          credito: [0],
          debito: [0],
          amex: [0]
        })
      }),
      comisiones: this.formBuilder.group({
        credito: [0],
        debito: [0],
        amex: [0]
      }),
      tasasLinks: this.formBuilder.group({
        banco: this.formBuilder.group({
          credito: [0],
          debito: [0],
          amex: [0]
        }),
        agregador: this.formBuilder.group({
          credito: [0],
          debito: [0],
          amex: [0]
        }),
        comercio: this.formBuilder.group({
          credito: [0],
          debito: [0],
          amex: [0]
        })
      }),
      comisionesLink: this.formBuilder.group({
        credito: [0],
        debito: [0],
        amex: [0]
      }),
    });
  }

  data: any = []
  msiData: any = [
    {}
  ]

  private destroy$ = new Subject<void>();

  createPaymentGroup() {
    return this.formBuilder.group({
      type: [{ value: '', disabled: true }],
      min_mount: [{ value: '', disabled: true }],
      percent: [{ value: '', disabled: true }]
    });
  }

  get msi(): FormArray {
    return this.newMerchantForm.get('msi') as FormArray;
  }

  togglePayment(index: number, event: any) {
    const paymentControl = this.msi.at(index);

    if (event.target.checked) {
      // Enable the controls when checked
      paymentControl.get('type')?.enable();
      paymentControl.get('min_mount')?.enable();
      paymentControl.get('percent')?.enable();

      // Set the payment type
      paymentControl.patchValue({ type: this.paymentTypes[index] });
    } else {
      // Disable the controls and reset values when unchecked
      paymentControl.get('type')?.disable();
      paymentControl.get('min_mount')?.disable();
      paymentControl.get('percent')?.disable();
    }
    paymentControl.get('type')?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    paymentControl.get('min_mount')?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    paymentControl.get('percent')?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  getCurrentPayments() {
    return this.msi.value;
  }

  ngOnInit() {

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.idMerchant = parseInt(id);
    console.log('🔍 Merchant Form Debug - Route id:', id);
    console.log('🔍 Merchant Form Debug - Parsed idMerchant:', this.idMerchant);

    if (this.idMerchant) {
      this.merchantService.getMerchantById(this.idMerchant).pipe(
        takeUntil(this.destroy$),
        withLatestFrom(this.aboutService.getInfo()),
        tap(([response, getInfoResponse]) => {
          if (response) {
            this.fillFormToEdit(response);
            this.patchProccesors(response.processor_info, getInfoResponse.processors);
            this.patchPaymentType(response.MSI);
            this.idMerchant = response.id_merchant;
          }
        }),
        catchError(error => {
          console.error('Error trayendo la información del cliente', error);
          return of(null);
        })
      ).subscribe();
    }else{
      lastValueFrom(this.aboutService.getInfo()).then((getInfoResponse) => {
        this.patchProccesors({}, getInfoResponse.processors);
      });
    }


    this.newMerchantForm.get('type')?.valueChanges.subscribe(value => {
      this.msiType = value;
    });


    this.newMerchantForm.get('same_address')?.valueChanges.subscribe(value => {
      this.toggleFiscalAddress(value);
    });

    this.newMerchantForm.get('direccion')?.valueChanges.subscribe((direccionValue) => {
      const sameAddress = this.newMerchantForm.get('same_address')?.value;

      if (sameAddress) {
        this.newMerchantForm.get('direccion_fiscal')?.patchValue(direccionValue, {
          emitEvent: false,
          onlySelf: false
        });
      }
    });

    this.catalogService.getCountries().subscribe({
      next: response => this.countriesData = response
    });

    this.catalogService.getStates().subscribe({
      next: response => this.statesData = response
    })

    this.catalogService.getPersonType().subscribe({
      next: response => this.personType = response
    })

    this.clientService.getClients().pipe(
      tap((response: ShowDataClient[]) => {
        this.clientData = response.reduce((obj: { [key: string]: any }, client) => {
          obj[client['Nombre Cliente']] = client.Id;
          return obj;
        }, {});
      })
    ).subscribe();

    this.catalogService.getTransSchemas().subscribe({
      next: response => this.transSchemas = response
    })

    this.catalogService.getMcc().subscribe({
      next: response => this.mccData = response
    })

    this.catalogService.getMccRaw().subscribe({
      next: response => {
        this.rawMccs = response;
        this.fetchMccOperations(this.newMerchantForm.get('mcc')?.value);
      }
    })

    this.catalogService.getAcqBank().subscribe({
      next: response => this.acqBankData = response
    })

    this.catalogService.getLogicalNtw().subscribe({
      next: response => this.logicalNtwData = response
    })

    this.catalogService.getProcessor().subscribe({
      next: response => this.processorData = response
    })

    this.catalogService.getProfilTrans().subscribe({
      next: response => this.profileTransData = response
    })

    this.transactionProfilesService.getAllData().subscribe({
      next: response => {
        this.rawProfiles = response;
        this.decodeSelectedProfile(this.newMerchantForm.get('id_perfil_transaccional')?.value);
      }
    });

    this.transactionProfilesService.getCatalogs().subscribe({
      next: response => {
        this.profileCatalogs = response;
        this.decodeSelectedProfile(this.newMerchantForm.get('id_perfil_transaccional')?.value);
      }
    });

    this.catalogService.getisoAggregators().subscribe({
      next: response => this.aggregatorName = response
    })

    this.catalogService.getTaxRgm().subscribe({
      next: response => this.taxRegimenData = response
    })

    this.urlTargetService.getAllData().subscribe({
      next: response => {
        this.urlTargetData = response.reduce((obj: { [key: string]: any }, element) => {
          obj[element.URL] = element.id;
          return obj;
        }, {});
      }
    });

    this.transactionModeService.getAllData().subscribe({
      next: response => {
        this.transactionModeData = response.reduce((obj: { [key: string]: any }, element) => {
          obj[`${element.Modo} - ${element.Descripción}`] = element.id;
          return obj;
        }, {});

      }
    });

    this.newMerchantForm.get('id_perfil_transaccional')?.valueChanges.subscribe(value => {
      this.decodeSelectedProfile(value);
    });

    this.newMerchantForm.get('mcc')?.valueChanges.subscribe(value => {
      this.fetchMccOperations(value);
    });
  }

  decodeSelectedProfile(profileId: any) {
    if (!profileId || !this.rawProfiles.length || !this.profileCatalogs) {
      this.selectedProfileOperations = null;
      return;
    }

    const profile = this.rawProfiles.find(p => p.id == profileId);
    if (!profile || !profile.decoded) {
      this.selectedProfileOperations = null;
      return;
    }

    const decoded = profile.decoded;
    const result: any = {
      aplicacion: '',
      trans: [],
      indicadores: []
    };

    // Map application
    const app = this.profileCatalogs.aplicationsOperatives.find((a: any) => a.id_operative == decoded.aplicacion);
    result.aplicacion = app ? app.name : 'Unknown';

    // Map transactions
    decoded.trans.forEach((tId: any) => {
      const trans = this.profileCatalogs.transactionsType.find((t: any) => t.id_trantype == tId);
      if (trans) result.trans.push(trans.name);
    });

    // Map indicators
    decoded.indicadores.forEach((iId: any) => {
      const indicator = this.profileCatalogs.indicators.find((i: any) => i.id_tranindicator == iId);
      if (indicator) result.indicadores.push(indicator.name);
    });

    this.selectedProfileOperations = result;
  }

  fetchMccOperations(mccId: any) {
    if (!mccId || !this.rawMccs.length) {
      this.mccOperations = [];
      return;
    }

    const mccObj = this.rawMccs.find(m => m.id_mcc == mccId);
    if (!mccObj) {
      this.mccOperations = [];
      return;
    }

    this.mccOperationsService.getOperationsByMccCode(mccObj.mcc).subscribe({
      next: (response: any[]) => this.mccOperations = response,
      error: () => this.mccOperations = []
    });
  }

  fillFormToEdit(data: editMerchantInterface) {

    const updateData = {
      id_cliente: data.id_client,
      same_address: data.id_direccion === data.id_fiscal_address,
      id_tipo_persona: data.id_persona,
      razon_social: data.razon_social,
      nombre_comercio: data.name_merchant,
      url_comercio: data.url_merchant,
      transaction_mode: data.id_modo_transaccion,
      rfc: data.rfc_merchant,
      representante: data.representative,
      agente_comercial: data.agente_comercial,
      descripcion: data.description,
      id_esquema_transaccional: data.id_esquema,
      numero_afilacion: data.afiliation_number,
      numero_subafiliacion: data.subafiliation_number,
      mcc: data.id_mcc,
      acqbank: data.id_acqbank,
      id_red_logica: data.id_ln,
      id_procesador: data.id_processor,
      ln_agregador: data.ln_agregador,
      visa_payment_facilitator_id: data.visa_pymnt_facilitator,
      mc_payment_facilitator_id: data.mc_pymnt_facilitator,
      amex_payment_facilitator_id: data.amex_pymnt_facilitator,
      visa_independent_sales_organization_id: data.visa_indpnt_sales_org,
      mc_independent_sales_organization_id: data.mc_indpnt_sales_org,
      id_perfil_transaccional: data.id_profile_transaction,
      nombre_contacto: data.contact_merchant,
      rol_contacto: data.rol_contact,
      email_contacto: data.email_contact,
      tel1_contacto: data.tel1_contact,
      tel2_contacto: data.tel2_contact,
      celular: data.mobile_contact,
      use_moreterminals: data.use_moreterminals,
      active: data.active,
      retencion: data.retencion,
      taxRegimen: data.id_tax_regime,
      withInvoices: data.with_invoices,
      url_dest: data.id_url_destino,
      id_medio: data.id_bnrg_channel,
      "3DS": data['3DS'],
      "3DS_KEY": data['3DS_KEY'],
      serie_terminal: data.serie_terminal,
      max_tx: data.max.toString(),
      min_tx: data.min.toString(),
      afiliation_link: data.afiliation_link,
      id_medio_link: data.id_medio_link,
      selia_id: data.selia_id, // Added selia_id
      direccion: {
        calle: data.dd_calle,
        ciudad: data.dd_ciudad,
        no_exterior: data.dd_no_ext,
        no_interior: data.dd_no_int,
        colonia: data.dd_colonia,
        id_estado: data.dd_state,
        alcaldia: data.dd_alcaldia,
        codigo_postal: data.dd_cp,
        id_pais: data.dd_pais
      },
      direccion_fiscal: {
        calle: data.df_calle,
        ciudad: data.df_ciudad,
        no_exterior: data.df_no_ext,
        no_interior: data.df_no_int,
        colonia: data.df_colonia,
        id_estado: data.df_state,
        alcaldia: data.df_alcaldia,
        codigo_postal: data.df_cp,
        id_pais: data.df_pais
      },
      datos_bancarios: {
        banco: data.db_banco,
        clabe: data.db_clabe,
        tarjeta: data.db_tarjeta,
        no_cuenta: data.db_cuenta
      },
      tasas: {
        banco: {
          credito: data.taza_credito,
          debito: data.taza_debito,
          amex: data.taza_amex
        },
        agregador: {
          credito: data.tasa_credito_b,
          debito: data.tasa_debito_b,
          amex: data.tasa_amex_b
        },
        comercio: {
          credito: data.tasa_credito_c,
          debito: data.tasa_debito_c,
          amex: data.tasa_amex_c
        }
      },
      comisiones: {
        credito: data.tasa_credito_d,
        debito: data.tasa_debito_d,
        amex: data.tasa_amex_d
      },
      tasasLinks: {
        banco: {
          credito: data.taza_link_credito,
          debito: data.taza_link_debito,
          amex: data.taza_link_amex
        },
        agregador: {
          credito: data.tasa_link_credito_b,
          debito: data.tasa_link_debito_b,
          amex: data.tasa_link_amex_b
        },
        comercio: {
          credito: data.tasa_link_credito_c,
          debito: data.tasa_link_debito_c,
          amex: data.tasa_link_amex_c
        }
      },
      comisionesLink: {
        credito: data.tasa_link_credito_d,
        debito: data.tasa_link_debito_d,
        amex: data.tasa_link_amex_d
      }
    }
    this.processorChange(updateData.id_procesador);
    this.schemaTransactionalChange(updateData.id_esquema_transaccional);
    this.has3DSChange(updateData['3DS']);
    const isSameAddress = !updateData.direccion_fiscal?.codigo_postal;
    this.newMerchantForm.get('same_address')?.setValue(isSameAddress);
    this.toggleFiscalAddress(isSameAddress);
    this.newMerchantForm.patchValue(updateData);
  }

  isPaymentChecked(type: number): boolean {
    return this.msi.controls.some(control => control.get('type')?.value === type);
  }

  patchPaymentType(msiString: string): void {
    let data: Array<{ type: number; min_mount: string; percent: string; }> = [];
    try {
      if (msiString) {
        data = JSON.parse(msiString) as Array<{ type: number; min_mount: string; percent: string; }>;
      }
    } catch (error) {
      console.error(error);
    }

    data.forEach((item) => {
      const groupIdex = this.paymentTypes.findIndex((type) => item.type == type);
      const paymentGroup = this.msi.at(groupIdex) as FormGroup;
      paymentGroup.enable();
      paymentGroup.patchValue(item);
    });

  }

  patchProccesors(processorInfo: ProcessorInfoInterface, processors: String[]): void {
    if(processors.includes('MBBL')){
      const wlGroup = this.formBuilder.group({
        tkr: [''],
        merchant: ['']
      });
      this.processorInfoGroup.addControl('whitelabel_broxel', wlGroup);
      this.showWhitelableBroxel = true;
    }


    this.processorInfoGroup.patchValue(processorInfo);

  }

  getMisMerchant(data: any) {
    if (data) {
      const parsedResponse = JSON.parse(data)
      return parsedResponse
    }
  }


  onSubmit() {
    this.newMerchantForm.markAllAsTouched();
    this.newMerchantForm.updateValueAndValidity();
    if (this.newMerchantForm.valid) {
      this.formTrimService.trimFormValues(this.newMerchantForm)
      const formData: MerchantFomrInterface = this.newMerchantForm.value;
      formData.msi = formData.msi?.length ? formData.msi : [];
      this.idMerchant
        ? this.updateMerchant(formData)
        : this.createNewMerchant(formData)
    } else {
      this.toastService.info("Revisa la información ingresada.");
    }

  }

  updateMerchant(data: any) {
    data.id_comercio = this.idMerchant
    const merchant = data
    this.merchantService.updateMerchant(merchant).subscribe({
      next: response => this.goToBack('Comercio editado con éxito'),
      error: err => {
        this.toastService.error(err.error?.data || 'Error al guardar el comercio')
      }
    })
  }

  goToBack(message: string) {
    this.toastService.success(message)
    this.router.navigate(['/comercios'])
  }

  createNewMerchant(data: any) {
    this.merchantService.createNewMerchant(data).subscribe({
      next: response => this.goToBack('Comercio añadido con éxito'),
      error: err => this.toastService.error(err.error?.data || 'Error al guardar el comercio')
    })
  }

  resetForm(): void {
    this.newMerchantForm.reset();
  }


  schemaTransactionalChange(event: any) {
    const subafiliationControl = this.newMerchantForm.get('numero_subafiliacion');
    const mccControl = this.newMerchantForm.get('mcc');
    if (event != 3) {
      subafiliationControl?.disable();
    } else {
      subafiliationControl?.addValidators(Validators.required);
      subafiliationControl?.enable();
    }
    subafiliationControl?.updateValueAndValidity({ onlySelf: false, emitEvent: true });

    if (event == 3 || event == 4) {
      mccControl?.setValue('1');
    } else {
      mccControl?.setValue('');
    }

  }

  processorChange(event: any) {
    const channelIdControl = this.newMerchantForm.get('id_medio');
    const transactionModeControl = this.newMerchantForm.get('transaction_mode');
    const targetUrl = this.newMerchantForm.get('url_dest');

    if (event != 3) {
      channelIdControl?.disable();
      transactionModeControl?.disable();
      targetUrl?.disable();
    } else {
      channelIdControl?.addValidators(Validators.required);
      transactionModeControl?.addValidators(Validators.required);
      targetUrl?.addValidators(Validators.required);
      channelIdControl?.enable();
      transactionModeControl?.enable();
      targetUrl?.enable();
    }
    channelIdControl?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    transactionModeControl?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
    targetUrl?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  has3DSChange(event: any) {
    const key3DSControl = this.newMerchantForm.get('3DS_KEY');
    if (event == true) {
      key3DSControl?.addValidators(Validators.required);
      key3DSControl?.enable();
    } else {
      key3DSControl?.disable();
    }
    key3DSControl?.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  toggleFiscalAddress(value?: boolean) {
    const useSameAddress = value ?? this.newMerchantForm.get('same_address')?.value;
    const fiscalGroup = this.newMerchantForm.get('direccion_fiscal');
    const physicalGroup = this.newMerchantForm.get('direccion')?.value;

    if (!useSameAddress) {
      fiscalGroup?.enable();
    } else {
      fiscalGroup?.patchValue({ ...physicalGroup });
    }
  }



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}

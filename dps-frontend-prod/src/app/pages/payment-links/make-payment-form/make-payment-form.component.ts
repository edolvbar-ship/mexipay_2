import { Component } from '@angular/core';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { LinkService } from '@/app/services/links/link.service';
import { CountriesService } from '@/app/services/shared/countries-service/countries.service';
import { StepLabelComponent } from "../../../shared/components/step-label/step-label.component";
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';
import { SubmitTypeInterface } from '@/app/shared/interfaces/submit-type';
import {
  LinkValidationInterface,
  PaymentInformationInterface,
  PaymentResponse3DSInterface,
  VerifyPaymentInformationInterface,
  SeliaPaymentInformationInterface,
  AnyPaymentResponse
} from '@/app/shared/interfaces/payment-links.interface';
import { firstValueFrom } from 'rxjs';
import { expireAfter } from '@/app/shared/validations/date.validation';
import { TicketsService } from '@/app/services/movements/tickets/tickets.service';
import { ToggleSwitchComponent } from '@/app/shared/components/inputs/input-switch/input-switch.component';

@Component({
  selector: 'app-login',
  imports: [
    TextTitleComponent,
    InputTextComponent,
    TextTypeComponent,
    InputSelectComponent,
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    StepLabelComponent,
    ToggleSwitchComponent,
  ],
  templateUrl: './make-payment-form.component.html',
  styleUrl: './make-payment-form.component.css'
})
export class MakePaymentFormComponent {

  linkStatus!: LinkValidationInterface;
  countriesData: SubmitTypeInterface = {};
  formGroup: FormGroup;
  queryString: string;
  current = 1;
  isStepperHide: boolean = false;
  allowedPlans: string[] = []
  hasPartial = false;
  isButton = false;
  steps: { [key: string]: 'default' | 'disabled' | 'success' | 'error' } = {
    '1': 'default',
    '2': 'disabled',
    '3': 'disabled'
  };
  expiredLink: boolean = false;
  paymentResponse?: AnyPaymentResponse;
  useSeliaProcessor: boolean = false;

  constructor(
    private linkService: LinkService,
    private catalogService: CountriesService,
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private toastService: ToastrService,
    private ticketService: TicketsService,
    location: Location
  ) {
    this.queryString = location.path().split('?', 2)[1];

    this.formGroup = this.formBuilder.group({
      '1': this.formBuilder.group({
        street: ['', Validators.required],
        zipCode: ['', [Validators.required, Validators.minLength(5)]],
        country: ['', Validators.required],
        city: ['', Validators.required],
      }),
      '2': this.formBuilder.group({
        fullName: ['', Validators.required],
        cardNumber: ['', [Validators.required, Validators.minLength(16)]],
        expireDate: ['', [Validators.required, Validators.pattern(/(0[1-9]|1[0-2])\/[0-9]{2}/), expireAfter(new Date())]],
        cvv: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [Validators.required, Validators.email]],
        ...(this.hasPartial ? { msi: [''] } : {})
      })
    });
  }

  ngOnInit(): void {
    const queryMap = this.route.snapshot.queryParamMap;
    if (
      !queryMap.has('token') &&
      !['commerce_id', 'concepto', 'monto', 'url_respuesta', 'commerce_name', 'checksum', 'x_time', 'x_auth'].every((key) => queryMap.has(key))
    ) {
      this.router.navigate(['/404']);
    }

    this.isButton = ['commerce_id', 'concepto', 'monto', 'url_respuesta', 'commerce_name', 'checksum', 'x_time', 'x_auth'].every((key) => queryMap.has(key)) && !queryMap.has('token');

    this.validLink();
    this.loadCountries();
  }

  validLink = () => {
    this.linkService.getLinkValid(this.queryString).subscribe({
      next: response => {
        this.linkStatus = response;
        this.hasPartial = this.linkStatus.data?.hasPartial ?? false;
        this.allowedPlans = this.linkStatus.data?.allowedPlans ?? [];

        const step2Control = this.formGroup.get('2');
        if (step2Control instanceof FormGroup && this.hasPartial && this.allowedPlans.length > 0) {
          step2Control.addControl('msi', this.formBuilder.control(''));
        }

        this.determineProcessor();

        if (this.linkStatus.statusCode != 0) {
          if (this.linkStatus.description === 'Link caducado') {
            this.expiredLink = true;
            this.isStepperHide = true;
          } else this.router.navigate(['/404'])
        }
      },
      error: error => {
        this.router.navigate(['/404'])
      }
    });
  }

  determineProcessor(): void {
    const merchant = this.linkStatus.data?.merchant;
    const amount = parseFloat(this.linkStatus.data!.monto);

    // Simple logic: Use Selia for amounts <= 50,000 MXN
    this.useSeliaProcessor = amount <= 50000;

    console.log(`Processor determined: ${this.useSeliaProcessor ? 'Selia' : 'Default'} for amount: $${amount}`);
  }

  loadCountries = () => {
    this.catalogService.getCountriesNoAuth().subscribe({
      next: response => {
        this.countriesData = response;
      }
    });
  }

  prepareBodyRequest(): PaymentInformationInterface | SeliaPaymentInformationInterface {
    const baseData = {
      tarjeta: this.formGroup.get('2.cardNumber')?.value,
      calle: this.formGroup.get('1.street')?.value,
      cp: this.formGroup.get('1.zipCode')?.value,
      pais: this.formGroup.get('1.country')?.value,
      ciudad: this.formGroup.get('1.city')?.value,
      nombre: this.formGroup.get('2.fullName')?.value,
      venci: this.formGroup.get('2.expireDate')?.value,
      cvv: this.formGroup.get('2.cvv')?.value,
      email: this.formGroup.get('2.email')?.value,
      linkPago: this.isButton ? 1 : 2,
      dataPayment: {
        id: this.linkStatus.data!.id,
        monto: this.linkStatus.data!.monto,
        id_merchant: this.linkStatus.data!.id_merchant,
        concepto: this.linkStatus.data!.concepto,
        url_comercio: this.linkStatus.data!.merchant.url_merchant,
        token: this.linkStatus.data!.token,
        chargePlan: this.hasPartial && this.allowedPlans.length > 0 ? this.formGroup.get('2.msi')?.value : null,
        processor: this.useSeliaProcessor ? 'selia' : 'default'
      }
    };

    if (this.useSeliaProcessor) {
      return baseData as SeliaPaymentInformationInterface;
    }

    return baseData as PaymentInformationInterface;
  }

  nextStep() {
    this.steps[this.current] = 'success';
    this.current++;
    this.steps[this.current] = 'default';
  }

  async onSubmit() {
    const group = this.formGroup.get(`${this.current}`);
    group?.markAllAsTouched();
    if (!group?.invalid) {
      this.nextStep();
      if (this.current == 3) {
        const data = this.prepareBodyRequest();
        try {
          let serviceResponse: AnyPaymentResponse;

          if (this.useSeliaProcessor) {
            console.log('Processing with Selia gateway...');
            serviceResponse = await firstValueFrom(
              this.linkService.makeSeliaPayment(data as SeliaPaymentInformationInterface)
            );
          } else {
            console.log('Processing with default gateway...');
            serviceResponse = await firstValueFrom(
              this.linkService.makePayment(data as PaymentInformationInterface)
            );
          }

          if ("url" in serviceResponse && !this.useSeliaProcessor) {
            this.handle3DSFlow(serviceResponse as PaymentResponse3DSInterface, data);
          } else {
            this.handleDirectResponse(serviceResponse, data);
          }

        } catch (err) {
          console.error('Payment error:', err);
          this.toastService.error('Error al enviar solicitud.');
          this.steps[this.current] = 'error';
        }
      }
    } else {
      this.toastService.info("Revisa la información ingresada.");
    }
  }

  private handle3DSFlow(serviceResponse: PaymentResponse3DSInterface, data: any): void {
    const url: any = serviceResponse.url;
    const paymentWindow = window.open(url, '_blank');
    window.focus();

    if (!paymentWindow) {
      console.error("No se pudo abrir la ventana");
      this.paymentResponse = serviceResponse;
      return;
    }

    const interval = setInterval(async () => {
      try {
        if (paymentWindow.location.href != url) {
          const urlParams = new URL(paymentWindow.location.href);
          const reference: string | undefined = urlParams.searchParams.get("reference")?.toString();
          paymentWindow.close();
          clearInterval(interval);
          if (reference && reference !== "") {
            const verifyBody: VerifyPaymentInformationInterface = {
              reference: reference,
              cvv: data.cvv,
              token: data.dataPayment.token,
              idMerchant: data.dataPayment.id_merchant,
              paymentLink: data.linkPago
            };
            const responseValidation = await firstValueFrom(
              this.linkService.verifyPayment3DS(verifyBody)
            );
            this.paymentResponse = responseValidation;
            this.finalizePayment(responseValidation, data);
          } else {
            this.paymentResponse = serviceResponse;
            this.finalizePayment(serviceResponse, data);
          }
        }
      } catch (error) {
        console.warn("No se puede acceder a la URL de la ventana (diferente dominio)", error);
      }
    }, 2000);
  }

  private handleDirectResponse(serviceResponse: AnyPaymentResponse, data: any): void {
    this.paymentResponse = serviceResponse;
    this.finalizePayment(serviceResponse, data);
  }

  private finalizePayment(response: AnyPaymentResponse, data: any): void {
    const isSuccess = this.isPaymentSuccessful(response);

    if (isSuccess) {
      this.steps[this.current] = 'success';

      // Build email data that matches the expected interface
      const emailData = this.buildEmailData(response, data.email);

      firstValueFrom(this.ticketService.sendByEmail(emailData)).then((emailResp) => {
        this.toastService.success(`Email enviado a ${data.email}.`);
      }).catch(err => {
        this.toastService.error(err?.error?.msg || 'Error al enviar email.')
      })
    } else {
      this.steps[this.current] = 'error';
      const errorMessage = this.getErrorMessage(response);
      this.toastService.error(errorMessage);
    }
  }

  private buildEmailData(response: AnyPaymentResponse, email: string): any {
    // Extract required fields with fallbacks
    const baseData = {
      email: email,
      id: this.getSafeString(response, 'id', 'transactionId', 'unknown'),
      trace_id: this.getSafeString(response, 'trace_id', 'transactionId', 'unknown'),
      authorization: this.getSafeString(response, 'authorization', 'authorizationCode', 'unknown')
    };

    // Merge with all response properties
    return { ...baseData, ...response };
  }

  private getSafeString(response: AnyPaymentResponse, primaryKey: string, secondaryKey: string, fallback: string): string {
    if (primaryKey in response && response[primaryKey as keyof AnyPaymentResponse]) {
      const value = response[primaryKey as keyof AnyPaymentResponse];
      return typeof value === 'string' ? value : String(value);
    }

    if (secondaryKey in response && response[secondaryKey as keyof AnyPaymentResponse]) {
      const value = response[secondaryKey as keyof AnyPaymentResponse];
      return typeof value === 'string' ? value : String(value);
    }

    return fallback;
  }


  private isPaymentSuccessful(response: AnyPaymentResponse): boolean {
    if ('error' in response) {
      // Selia response
      return !response.error;
    } else if ('request_status' in response) {
      // Default processor response - handle undefined case
      return response.request_status === true; // Explicitly check for true
    } else if ('url' in response) {
      // 3DS response - consider it as in progress, not successful yet
      return false;
    }
    return false;
  }
  private getErrorMessage(response: AnyPaymentResponse): string {
    if ('error' in response && response.error) {
      return response.description || 'Pago rechazado por Selia';
    } else if ('request_status' in response && !response.request_status) {
      return response.description || 'Pago rechazado';
    } else if ('url' in response) {
      return 'Procesando autenticación 3DS';
    }
    return 'Error desconocido en el pago';
  }
}

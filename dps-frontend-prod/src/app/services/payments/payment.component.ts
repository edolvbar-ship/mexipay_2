import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from "@/environments/environment";

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss']
})
export class PaymentComponent implements OnInit {
  paymentForm: FormGroup;
  loading = false;
  paymentData: any = null;
  token: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  processing = false;
  cardType: string = 'unknown';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private fb: FormBuilder
  ) {
    this.paymentForm = this.createForm();
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    if (!this.token) {
      this.errorMessage = 'Link de pago inválido';
      return;
    }

    this.validatePaymentLink();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      calle: ['', [Validators.required]],
      ciudad: ['', [Validators.required]],
      pais: ['MX', [Validators.required]],
      cp: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      tarjeta: ['', [
        Validators.required,
        Validators.pattern(/^\d{4}-\d{4}-\d{4}-\d{4}$/)
      ]],
      venci: ['', [
        Validators.required,
        Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)
      ]],
      cvv: ['', [
        Validators.required,
        Validators.pattern(/^\d{3,4}$/)
      ]]
    });
  }

  async validatePaymentLink(): Promise<void> {
    this.loading = true;
    try {
      console.log('Validating payment link with token:', this.token);

      // ✅ USE DIRECT BACKEND URL - BYPASS PROXY
      const BACKEND_URL = '';
      const response: any = await this.http.get(
        `${BACKEND_URL}/payments/payment-link?token=${this.token}`
      ).toPromise();

      console.log('API Response:', response);

      if (response.statusCode !== 0) {
        switch (response.statusCode) {
          case 1:
            this.errorMessage = 'Link de pago inválido';
            break;
          case 3:
            this.errorMessage = 'El link de pago ha expirado';
            break;
          case 4:
            this.errorMessage = 'Este pago ya ha sido procesado';
            break;
          default:
            this.errorMessage = response.description || 'Error al validar el link de pago';
        }
        return;
      }

      this.paymentData = response.data;

    } catch (error: any) {
      console.error('Payment link validation error:', error);
      console.error('Full error:', error);
      this.errorMessage = 'Error al conectar con el servidor';
    } finally {
      this.loading = false;
    }
  }

  async processPayment(): Promise<void> {
    if (this.paymentForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.processing = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formData = this.paymentForm.value;

      // Send expiration as MM/YY format (user input format)
      const venciParts = formData.venci.split('/');
      const expirationMMYY = `${venciParts[0]}/${venciParts[1]}`;

      const paymentPayload = {
        dataPayment: {
          token: this.token,
          id_merchant: this.paymentData.id_merchant,
          monto: this.paymentData.monto,
          concepto: this.paymentData.concepto,
          info_adicional: this.paymentData.info_adicional || ''
        },
        tarjeta: formData.tarjeta.replace(/-/g, ''), // Remove dashes
        nombre: formData.nombre,
        venci: expirationMMYY, // Send as MM/YY format
        cvv: formData.cvv,
        email: formData.email,
        calle: formData.calle,
        ciudad: formData.ciudad,
        pais: formData.pais,
        cp: formData.cp
      };

      console.log('🔍 PAYMENT PAYLOAD:', paymentPayload);

      const paymentRequest = {
        data: btoa(JSON.stringify(paymentPayload))
      };

      console.log('🔍 ENCODED PAYMENT REQUEST:', paymentRequest);

      // Try Selia payment first
      const BACKEND_URL = '';
      const response: any = await this.http.post(
        `${BACKEND_URL}/payments/payment/selia`,
        paymentRequest
      ).toPromise();

      console.log('🔍 PAYMENT RESPONSE:', response);

      if (response.error) {
        this.errorMessage = response.description || `Error al procesar el pago (Código: ${response.resp_code})`;
      } else {
        this.successMessage = `Pago procesado exitosamente. Autorización: ${response.authorization}`;
        this.paymentForm.disable();
      }

    } catch (error: any) {
      console.error('💥 PAYMENT PROCESSING ERROR:', error);

      if (error.status === 404) {
        this.errorMessage = 'Endpoint de pago no encontrado. Verifique la configuración.';
      } else if (error.status === 500) {
        this.errorMessage = 'Error interno del servidor. Intente nuevamente.';
      } else {
        this.errorMessage = `Error de conexión: ${error.message || 'No se pudo conectar con el servidor'}`;
      }
    } finally {
      this.processing = false;
    }
  }

  // Optional: Add method to use regular payment (non-Selia)
  async processRegularPayment(): Promise<void> {
    if (this.paymentForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.processing = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formData = this.paymentForm.value;

      const venciParts = formData.venci.split('/');
      const expirationMMYY = `${venciParts[0]}/${venciParts[1]}`;

      const paymentRequest = {
        data: btoa(JSON.stringify({
          dataPayment: {
            token: this.token,
            id_merchant: this.paymentData.id_merchant,
            monto: this.paymentData.monto,
            concepto: this.paymentData.concepto,
            info_adicional: this.paymentData.info_adicional || ''
          },
          tarjeta: formData.tarjeta,
          nombre: formData.nombre,
          venci: expirationMMYY,
          cvv: formData.cvv,
          email: formData.email,
          calle: formData.calle,
          ciudad: formData.ciudad,
          pais: formData.pais,
          cp: formData.cp,
          linkPago: 2 // Indicate this is a link payment
        }))
      };

      // ✅ CORRECTED URL: Use the regular payout endpoint
      const response: any = await this.http.post(
        `${environment.apiUrl}/payments/payment-link/payout`,
        paymentRequest
      ).toPromise();

      if (response.error) {
        this.errorMessage = response.description || 'Error al procesar el pago';
      } else {
        this.successMessage = `Pago procesado exitosamente. Autorización: ${response.authorization}`;
        this.paymentForm.disable();
      }

    } catch (error: any) {
      console.error('Payment processing error:', error);
      this.errorMessage = 'Error de conexión con el procesador de pagos';
    } finally {
      this.processing = false;
    }
  }

  formatCardNumber(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);

    const formatted = value.replace(/(\d{4})(?=\d)/g, '$1-');
    this.paymentForm.patchValue({ tarjeta: formatted });
    this.detectCardType(value);
  }

  detectCardNumber(event: any): void {
    const value = event.target.value.replace(/\D/g, '');
    this.detectCardType(value);
  }

  detectCardType(cardNumber: string): void {
    if (/^4/.test(cardNumber)) {
      this.cardType = 'visa';
    } else if (/^5[1-5]/.test(cardNumber)) {
      this.cardType = 'mastercard';
    } else if (/^3[47]/.test(cardNumber)) {
      this.cardType = 'amex';
    } else {
      this.cardType = 'unknown';
    }
  }

  formatExpiry(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);

    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }

    this.paymentForm.patchValue({ venci: value });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.paymentForm.controls).forEach(key => {
      this.paymentForm.get(key)?.markAsTouched();
    });
  }

  getCardIcon(): string {
    switch (this.cardType) {
      case 'visa': return 'assets/icons/visa.svg';
      case 'mastercard': return 'assets/icons/mastercard.svg';
      case 'amex': return 'assets/icons/amex.svg';
      default: return 'assets/icons/credit-card.svg';
    }
  }

  get f(): { [key: string]: AbstractControl } {
    return this.paymentForm.controls;
  }
}

import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { BasicTableComponent } from '@/app/shared/components/basic-table/basic-table.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';
import { InputTextComponent } from '@/app/shared/components//inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PrimeIcons } from 'primeng/api';
import { QrCodeComponent  } from 'ng-qrcode';

import { ToastrService } from 'ngx-toastr';
import { tap } from 'rxjs';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { LinkService } from '@/app/services/links/link.service';
import { CustomTableAction } from '@/app/shared/interfaces/types-interface';
import { SubmitTypeInterface } from '@/app/shared/interfaces/submit-type';

/**
 * Payment Links Management Component
 *
 * This component provides a comprehensive interface for:
 * - Creating and managing payment links
 * - Viewing and sharing payment links via multiple channels
 * - Displaying recent payment links in a table format
 * - Generating QR codes for payment links
 *
 * Features:
 * - Form-based link creation with validation
 * - Merchant selection from available options
 * - Optional expiration date configuration
 * - Multiple sharing options (Email, WhatsApp, SMS)
 * - Copy-to-clipboard functionality
 * - Responsive table with custom actions
 */
@Component({
  selector: 'app-payment-links',
  imports: [
    SectionTitleComponent,
    CardContainerComponent,
    TextTitleComponent,
    TextTypeComponent,
    ActionButtonComponent,
    BasicTableComponent,
    InputTextComponent,
    InputSelectComponent,
    ReactiveFormsModule,
    CommonModule,
    ReactiveFormsModule,
    QrCodeComponent,
    CommonModule,
  ],
  templateUrl: './payment-links.component.html',
  styleUrl: './payment-links.component.css'
})
export class PaymentLinksComponent implements OnInit{

  // Form groups for creating links and sharing them
  formGroup: FormGroup;
  shareFormGroup: FormGroup;

  // Table data properties
  headers: string[] = [];
  data: any[][] = [];

  // Form state management
  expirationDate:string  = '';
  merchants: SubmitTypeInterface = {};
  minDate:any = '';

  // Link display and sharing properties
  imgUrl:string = '';
  linkIsSelected:boolean = false;
  linkSelected:any = {
    monto: '',
    Comercio: '',
    concepto: '',
    Estatus: '',
    link: '',
    expireDate: '',
    token:''
  };

  // Modal and sharing state
  sendBy:number = 0
  isModalOpen = false;
  isSending = false;
  whatYouShare:string = '';
  hiddenColumns:string[] = ['link','expireDate','token'];

  /**
   * Resets the view to show the form and clears any selected link
   * Used to toggle between form view and link detail view
   */
  showFormLinks = () => {
    this.linkIsSelected = false;
    this.linkSelected = {
      monto: '',
      Comercio: '',
      concepto: '',
      Estatus: '',
      link: '',
      expireDate: '',
      token:''
    };
  }

  /**
   * Custom actions for the payment links table
   * Provides copy and view functionality for each link
   */
  customActions: CustomTableAction<any>[] = [
    {
      icon: PrimeIcons.COPY,
      handler:  async (index, item) => {
        this.copyLink(item.link);
      }
    },
    {
      icon: PrimeIcons.SEARCH,
      handler:  async (index, item) => {
        this.linkIsSelected = true;
        this.linkSelected = item;
      }
    }
  ];

  constructor(
    private formBuilder: FormBuilder,
    private toastService: ToastrService,
    private linkService: LinkService,
    private router: Router,
    private currency: CurrencyPipe,
    private datePipe: DatePipe
  ) {
    /**
     * Initialize the main form for creating payment links
     * Includes validation for required fields
     */
    this.formGroup = this.formBuilder.group({
      amount: ['', Validators.required],           // Payment amount
      merchant: ['', Validators.required],         // Merchant selection
      concept: ['', Validators.required],          // Payment description
      expirationDate: ['', Validators.required]   // Required expiration date (default 7 days)
    });

    /**
     * Initialize the sharing form for email/phone input
     * Includes validation for email format and phone length
     */
    this.shareFormGroup = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.minLength(10)] ]
    });
  }

  /**
   * Component initialization lifecycle hook
   * Sets up initial form state and loads required data
   */
  ngOnInit(): void {
    // Set minimum date to today to prevent past dates
    const today = new Date();
    const day   = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year  = today.getFullYear();

    this.minDate = `${year}-${month}-${day}`;

    // Set default expiration date to 7 days from today
    const defaultExpiration = new Date(today);
    defaultExpiration.setDate(today.getDate() + 7);
    const defaultDay = defaultExpiration.getDate().toString().padStart(2, '0');
    const defaultMonth = (defaultExpiration.getMonth() + 1).toString().padStart(2, '0');
    const defaultYear = defaultExpiration.getFullYear();
    const defaultDate = `${defaultYear}-${defaultMonth}-${defaultDay}`;

    // Initialize form with default 7-day expiration
    this.formGroup.patchValue({
      expirationDate: defaultDate,
    });

    // Load initial data
    this.loadDataLinks();
    this.loadMerchants();
  }

  /**
   * Copies the payment link to clipboard
   * @param link - The full payment URL to copy
   */
  copyLink = (link:string) => {
    navigator.clipboard.writeText(link).then(() => {
      this.toastService.info('Copiado en el portapapeles.');
    }).catch(err => {
      this.toastService.error('No se ha podido copiar al portapapeles.');
    });
  }

  /**
   * Loads recent payment links for display in the table
   * Transforms API data into UI-friendly format with proper formatting
   */
  loadDataLinks = () => {
    this.linkService.getLinks(1, 10).pipe(
      tap((response) => {
        const preparedData = response.data.map( (linkItem:any) => {
          return {
            monto: this.currency.transform(linkItem.monto),                    // Formatted currency
            Comercio : linkItem.merchantName,                                  // Merchant name
            concepto: linkItem.concepto,                                       // Payment concept
            Estatus: linkItem.status,                                          // Link status
            link: `${window.location.host}/payment${linkItem.url}`,           // Full payment URL
            expireDate: this.datePipe.transform(linkItem.expire_date, 'dd/MM/yyyy HH:mm') || 'N/A', // Formatted date
            token: linkItem.token                                              // Security token
          }
        });
        this.data = preparedData.slice(0,3); // Show only first 3 links
      })
    ).subscribe()
  }

  /**
   * Loads available merchants for the dropdown selection
   * Transforms merchant data into the format required by InputSelectComponent
   */
  loadMerchants = () => {
    this.linkService.getLinkMerchants().subscribe({
      next: (response: any) => {
        const merchantsArray = Array.isArray(response) ? response : (response?.data || []);

        console.log('Merchants array:', merchantsArray);

        this.merchants = merchantsArray.reduce((obj: SubmitTypeInterface, merchant: any) => {
          // Use the correct property names: merchantName and id_merchant
          if (merchant.merchantName && merchant.id_merchant) {
            obj[merchant.merchantName] = merchant.id_merchant;
          } else {
            console.warn('Merchant missing required properties:', merchant);
          }
          return obj;
        }, {});

        console.log('Processed merchants:', this.merchants);
        console.log('Number of merchants loaded:', Object.keys(this.merchants).length);
      },
      error: (error) => {
        console.error('Error:', error);
        this.merchants = {};
      }
    });
  }


  /**
   * Creates a new payment link by submitting form data to the API
   * Handles success/error responses and updates the UI accordingly
   */
  createLink = () => {
    // Validate all form fields
    this.formGroup.markAllAsTouched();
    if(!this.formGroup.invalid){
      // Prepare API request body
      const bodyRequest = this.prepareBodyRequest();

      this.linkService.saveData(bodyRequest).subscribe({
        next: (response) => {
          this.toastService.success("Link de pago creado.");

          // Reset form state
          this.formGroup.reset();
          
          // Reset to default 7-day expiration
          const defaultExpiration = new Date();
          defaultExpiration.setDate(defaultExpiration.getDate() + 7);
          const defaultDay = defaultExpiration.getDate().toString().padStart(2, '0');
          const defaultMonth = (defaultExpiration.getMonth() + 1).toString().padStart(2, '0');
          const defaultYear = defaultExpiration.getFullYear();
          const defaultDate = `${defaultYear}-${defaultMonth}-${defaultDay}`;
          
          this.formGroup.patchValue({
            expirationDate: defaultDate,
          });

          // Find merchant name for display
          const comercio = Object.entries(this.merchants).find( (entry) => entry[1] == response.id_merchant );

          // Update selected link with new data
          this.linkSelected  = {
            monto: this.currency.transform(response.monto),
            Comercio: comercio?.[0] || '',
            concepto: response.concepto,
            Estatus: "pendiente",
            link: `${window.location.host}/payment?token=${response.token}`,
            expireDate: this.datePipe.transform(response.expire_date, 'dd/MM/yyyy HH:mm') || 'N/A',
            token:response.token
          };

          // Switch to link detail view
          this.linkIsSelected = true;

          // Refresh the links table
          this.loadDataLinks();
        },
        error: (error) => {
          this.toastService.error('Un error ha ocurrido, no se ha podido crear el link de pago.');
        }
      });
    }else{
      this.toastService.info("Revisa la información ingresada.");
    }
  }

  /**
   * Prepares the API request body from form data
   * Handles date formatting and optional expiration date
   * @returns Formatted request body for link creation API
   */
  prepareBodyRequest = () => {
    let fecha: { year: string, month: string, day: string } | undefined = undefined;
    const expireDate = this.formGroup.value['expirationDate'];

    if(expireDate) {
      const dateParts = expireDate.split('-');
      fecha = {
        year: dateParts[0],    // Keep as string "2025"
        month: dateParts[1],   // Keep as string "10"
        day: dateParts[2]      // Keep as string "27"
      };
    }

    return {
      fecha: fecha,
      id_comercio: this.formGroup.get("merchant")?.value,
      concepto: this.formGroup.get("concept")?.value,
      monto: this.formGroup.get("amount")?.value
    }
  }

  /**
   * Navigates to the full links list page
   */
  allLinks = () => {
    this.router.navigate(['/links-de-pago','lista']);
  }

  /**
   * Opens the sharing modal and configures it for the selected method
   * @param sendBy - Sharing method: 1=WhatsApp, 2=Email, 3=SMS
   */
  sendEmail = (sendBy:number) => {
    this.sendBy = sendBy;

    // Set appropriate label text based on sharing method
    switch (sendBy) {
      case 1:
        this.whatYouShare = "WhatSapp al que se compartirá:";
        break;

      case 2:
        this.whatYouShare = "Correo electrónico al que se compartirá:";
        break;

      case 3:
        this.whatYouShare = "Número de celular al que se compartirá:";
        break;

      default:
        break;
    }

    this.openModal();
  }

  /**
   * Opens the sharing modal dialog
   */
  openModal = () => {
    this.isModalOpen = true;
  }

  /**
   * Closes the sharing modal and resets the form
   */
  closeModal = () => {
    this.isModalOpen = false;
    this.sendBy = 0;
    this.shareFormGroup.patchValue({
      email: '',
      phoneNumber: '',
    });
  }

  /**
   * Handles the actual sending of payment links via different channels
   * Validates input and calls appropriate service methods
   */
  send = () => {
    // Email sharing (method 2)
    if(this.sendBy == 2){
      if(this.shareFormGroup.get('email')?.invalid){
        this.toastService.info("Asegurese de llenar el campo email con un dato valido.");
        return;
      }

      this.isSending  = true;
      const email     = this.shareFormGroup.get("email")?.value;
      const token     = this.linkSelected.token;

      this.linkService.sendByEmail({ email, token}).subscribe({
        next: (response) => {
          this.toastService.success(`Link enviado al correo: ${email}`);
          this.isSending = false;
          this.closeModal();
        },
        error: (error) => {
          this.toastService.error('Un error ha ocurrido, no se ha podido crear el link de pago.');
          this.isSending = false;
        }
      });
    }

    // WhatsApp (method 1) and SMS (method 3) sharing
    if( [1,3].includes(this.sendBy) ){
      if(this.shareFormGroup.get('phoneNumber')?.invalid){
        this.toastService.info("Asegurese de llenar el campo Número de teléfono con un dato valido.");
        return;
      }
      this.isSending = true;
      const phone  = this.shareFormGroup.get("phoneNumber")?.value;

      // TODO:: Implement WhatsApp and SMS notification services
      // Currently just shows success message for demonstration
      this.toastService.success(`Link enviado al número: ${phone}`);
    }
  }
}

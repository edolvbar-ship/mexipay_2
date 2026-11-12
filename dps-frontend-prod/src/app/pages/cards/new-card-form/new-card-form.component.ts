import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { ToastrService } from 'ngx-toastr';

import { BinesService } from '@/app/services/bines/bines.service';

import { tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-card-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        InputSelectComponent,
        InputTextComponent,
        ActionButtonComponent,
        ReactiveFormsModule,
        CommonModule
    ],
    templateUrl: './new-card-form.component.html',
    styleUrl: './new-card-form.component.css'
})
export class NewCardFormComponent implements OnInit {

  linkText: string[] = ['/tarjetas']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;
  sectionTitle = "Nueva Información de Tarjeta";

  banks: any[] = [];
  products: any[] = [];
  types: any[] = [];
  processors: any[] = [];
  brands: any[] = [];
  tresDsOptions: any = {
      "No": 0,
      "Sí": 1
  };


  constructor(
    private formBuilder: FormBuilder,
    private BinesService: BinesService,
    private toastSrv: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [0, Validators.required],
      bin: ['', Validators.required],
      id_issbank: ['', Validators.required],
      id_card_product: ['', Validators.required],
      id_card_type: ['', Validators.required],
      id_processor: [''],
      id_brand: ['', Validators.required],
      tresDS: ['', Validators.required],
    });

  }

  ngOnInit(): void {

    this.loadCatalogs();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Información de Tarjeta";
        this.loadData(id);
      }
    });
  }

  loadCatalogs(): void {
    this.BinesService.getCatalogs().pipe(
      tap((response: any) => {
        const { banks, products, types, processors, brands } = response;

        this.banks = banks.reduce((acc: any, bank: any) => {
          acc[bank.name] = bank.id_issbank;
          return acc;
        }, {});

        this.products = products.reduce((acc: any, item: any) => {
          acc[item.name] = item.id_card_product;
          return acc;
        }, {});

        this.types = types.reduce((acc: any, item: any) => {
          acc[item.name] = item.id_card_type;
          return acc;
        }, {});

        this.processors = processors.reduce((acc: any, item: any) => {
          acc[item.name] = item.id_processor;
          return acc;
        }, { "Definido por el comercio": 0 });

        this.brands = brands.reduce((acc: any, item: any) => {
          acc[item.name] = item.id_brand;
          return acc;
        }, {});
      })
    ).subscribe();
  }

  loadData(id: string) {
    this.BinesService.getDataById(id).subscribe({
      next: (data) => {

        this.formGroup.patchValue({
          id: data.data[0].id_bin,
          bin: data.data[0].bin,
          id_issbank: data.data[0].id_issbank,
          id_card_product: data.data[0].id_card_product,
          id_card_type: data.data[0].id_card_type,
          id_processor: data.data[0].id_processor == null ? 0 : data.data[0].id_processor,
          id_brand: data.data[0].id_brand,
          tresDS: data.data[0]["3DS"]
        });

      },
      error: (error) => {
        this.toastSrv.error('No se ha encontrado información para este id.');
        this.router.navigate(this.linkText);
      },
    });
  };

  saveForm(): void {

    if (!this.formGroup.invalid) {

      this.formTrimService.trimFormValues(this.formGroup);

      const id = this.formGroup.get('id')?.value;
      const data = {
        id: this.formGroup.get('id')?.value,
        bin: this.formGroup.get('bin')?.value,
        id_issbank: this.formGroup.get('id_issbank')?.value,
        id_card_product: this.formGroup.get('id_card_product')?.value,
        id_card_type: this.formGroup.get('id_card_type')?.value,
        id_processor: this.formGroup.get('id_processor')?.value,
        id_brand: this.formGroup.get('id_brand')?.value,
        tresDS: this.formGroup.get('tresDS')?.value == "1" ? 1 : 0
      };

      if (id != 0) {
        this.BinesService.updateData(id, data).subscribe({
          next: (response) => {
            this.toastSrv.success('Tarjeta (BIN) actualizada correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      } else {
        this.BinesService.saveData(data).subscribe({
          next: (response) => {
            this.toastSrv.success('Tarjeta (BIN) guardada correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido guardado de la información.');
          }
        });
      }

    } else {
      this.toastSrv.info('Revisa la información ingresada.');
    }
  }

}

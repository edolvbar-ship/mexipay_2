import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';

import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { tap } from 'rxjs';
import { ReportsService } from '@/app/services/reports/reports.service';
import { MerchantsService } from '@/app/services/merchants/merchants.service';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-statement-account',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        TextTitleComponent,
        InputSelectComponent,
        ReactiveFormsModule,
        TextTypeComponent,
        ActionButtonComponent,
        CommonModule
    ],
    templateUrl: './statement-account.component.html',
    styleUrl: './statement-account.component.css'
})
export default class StatementAccountComponent implements OnInit {

  formGroup: FormGroup;
  merchants: any = [];
  months: any = [];
  totalMounths: number = 14;

  constructor(
    private merchantsService: MerchantsService,
    private reportsService: ReportsService,
    private toastService: ToastrService,
    private formBuilder: FormBuilder,
  ) {

    this.formGroup = this.formBuilder.group({
      month: ['', Validators.required],
      merchant: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.months = this.getMounths();
    const currentDate = new Date().toISOString().split('T')[0];
    this.formGroup.patchValue({
      date: currentDate
    });
    this.loadData();
  }

  loadData(): void {
    this.merchantsService.getMerchants().pipe(
      tap((response) => {

        const options = response.reduce((acc:any, merchant:any) => {
          acc[merchant['Nombre Comercio']] = merchant.Id
          return acc
        }, {'Todos' : 0});

        this.merchants = options;

      })
    ).subscribe();
  }

  getFile = () => {
    if (!this.formGroup.invalid) {
      const [month, year] = this.formGroup.get("month")?.value.split("-");
      const merchantId = this.formGroup.get("merchant")?.value;
      this.reportsService.getAccountState({
        "comercio": merchantId,
        "mes": month,
        "anio": year,
        "detalle": "n"
      });
    } else {
      this.toastService.info(`Es necesario que se seleccionen todos los campos para poder descargar el archivo.`);
    }
  }

  getMounths = () => {
    const monthsArray = [];
    const currentDate = new Date();

    for (let i = 0; i < this.totalMounths; i++) {
      const year = currentDate.getFullYear();
      let month: any = currentDate.getMonth() + 1;
      const monthLabel = this.getMounthText(month);
      const item = { id: `${month} - ${year}`, option: `${monthLabel} - ${year}` }
      monthsArray.push(item);
      currentDate.setMonth(currentDate.getMonth() - 1);
    }

    return monthsArray;
  }

  getMounthText = (index: string) => {

    const monthsLabels = [
      { index: "1", label: "Enero" },
      { index: "2", label: "Febrero" },
      { index: "3", label: "Marzo" },
      { index: "4", label: "Abril" },
      { index: "5", label: "Mayo" },
      { index: "6", label: "Junio" },
      { index: "7", label: "Julio" },
      { index: "8", label: "Agosto" },
      { index: "9", label: "Septiembre" },
      { index: "10", label: "Octubre" },
      { index: "11", label: "Noviembre" },
      { index: "12", label: "Diciembre" }
    ];
    const item = monthsLabels.find(i => i.index == index);
    return item?.label;
  }


}

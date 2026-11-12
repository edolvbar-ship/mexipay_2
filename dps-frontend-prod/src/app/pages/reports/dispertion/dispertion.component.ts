import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { InputSelectComponent } from '@/app/shared/components/inputs/input-select/input-select.component';

import { Component, OnInit } from '@angular/core';
import { ClientsService } from '@/app/services/clients/clients.service';
import { ToastrService } from 'ngx-toastr';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { tap } from 'rxjs';
import { ReportsService } from '@/app/services/reports/reports.service';
import { ActionButtonComponent } from "../../../shared/components/action-button/action-button.component";
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';

@Component({
    selector: 'app-reports',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        TextTitleComponent,
        InputSelectComponent,
        ReactiveFormsModule,
        TextTypeComponent,
        ActionButtonComponent,
        InputTextComponent
    ],
    templateUrl: './dispertion.component.html',
    styleUrl: './dispertion.component.css'
})
export class DispertionComponent implements OnInit {

  formGroup: FormGroup;
  clients:any = [];

  constructor(
    private clientsService: ClientsService,
    private reportsService: ReportsService,
    private toastService: ToastrService,
    private formBuilder: FormBuilder,
  ) {

    this.formGroup = this.formBuilder.group({
      date: [0, Validators.required],
      client: ['', Validators.required]
    });

  }

  ngOnInit(): void {

    const currentDate = new Date().toISOString().split('T')[0];
    this.formGroup.patchValue({
      date: currentDate
    });
    this.loadData();
  }

  loadData():void {
    this.clientsService.getClients().pipe(
      tap((response) => {
        const options = response.reduce( (acc: any, item: any) => {
          acc[item['Nombre Cliente']] = item.Id
          return acc
        }, {'Todos' : 'all'});
        this.clients = options
      })
    ).subscribe();
  }

  getFile = () => {
    if(!this.formGroup.invalid){
      const date          = this.formGroup.get("date")?.value;
      const client        = this.formGroup.get("client")?.value;
      const dateToSend    = new Date(`${date}T00:00:00Z`);
      const dateFormated  = dateToSend.getTime();
      this.reportsService.getConsolidationFile({ day: dateFormated, client, date });
    }else{
      this.toastService.info(`Es necesario que se llenen todos los campos para poder descargar el archivo.`);
    }
  }

}

import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
 } from '@angular/forms';

 import { ToastrService } from 'ngx-toastr';
 import { BankService } from '@/app/services/catalogues/banks/banks.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-bank-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-bank-form.component.html',
    styleUrl: './new-bank-form.component.css'
})
export default class NewBankFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','bancos']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Banco Adquirente";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private bankService: BankService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      fiid: ['', Validators.required],
      name: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Banco Adquirente";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.bankService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_acqbank,
          fiid: data.fiid,
          name: data.name,
        });
      },
      error: (error) => {
        this.toastSrv.error('No se ha encontrado información para este id.');
        this.router.navigate(this.linkText);
      },
    });
  };

  saveForm():void {
    if(!this.formGroup.invalid) {
      this.formTrimService.trimFormValues(this.formGroup)
      const id    = this.formGroup.get('id')?.value;
      const fiid  = this.formGroup.get('fiid')?.value;
      const name  = this.formGroup.get('name')?.value;

      if(id != 0){
        this.bankService.updateData({ id, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Banco adquirente actualizado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.bankService.saveData({ fiid, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Banco adquirente guardado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido guardado de la información.');
          }
        });
      }

    }else{
      this.toastSrv.info('Revisa la información ingresada.');
    }
  }

}

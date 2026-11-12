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

 import { UrlTargetService } from '@/app/services/catalogues/url-target/url-target.service';
import { TransactionModeService } from '@/app/services/catalogues/transaction-mode/transaction-mode.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-transaction-mode-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-transaction-mode-form.component.html',
    styleUrl: './new-transaction-mode-form.component.css'
})
export default class TransactionModeFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','modo-transaccion']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Modo de Transaccionar";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private transactionModeService: TransactionModeService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      mode: ['', Validators.required],
      description: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Modo de Transaccionar";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.transactionModeService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_bnrg_modo_transac,
          mode: data.bnrg_modo_trans,
          description: data.description,
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

      const id          = this.formGroup.get('id')?.value;
      const mode        = this.formGroup.get('mode')?.value;
      const description = this.formGroup.get('description')?.value;

      if(id != 0){
        this.transactionModeService.updateData({ id, mode, description }).subscribe({
          next: (response) => {
            this.toastSrv.success('Modo de transaccionar actualizado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.transactionModeService.saveData({ mode, description }).subscribe({
          next: (response) => {
            this.toastSrv.success('Modo de transaccionar guardado correctamente.');
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

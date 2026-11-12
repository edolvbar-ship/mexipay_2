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
import { TransactionalSchemasService } from '@/app/services/catalogues/transactional-schemas/transactional-schemas.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-transaction-schema-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-transaction-schema-form.component.html',
    styleUrl: './new-transaction-schema-form.component.css'
})
export default class NewTransactionSchemaFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','esq-transaccional']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Esquema Transaccional";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private transactionalSchemasService: TransactionalSchemasService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      schema: ['', Validators.required],
      description: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Esquema Transaccional";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.transactionalSchemasService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_esquema_transactional,
          schema: data.esquema,
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
      const id   = this.formGroup.get('id')?.value;
      const schema = this.formGroup.get('schema')?.value;
      const description = this.formGroup.get('description')?.value;

      if(id != 0){
        this.transactionalSchemasService.updateData({ id, schema, description }).subscribe({
          next: (response) => {
            this.toastSrv.success('Esquema transaccional actualizado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.transactionalSchemasService.saveData({ id, schema, description }).subscribe({
          next: (response) => {
            this.toastSrv.success('Esquema transaccional guardado correctamente.');
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

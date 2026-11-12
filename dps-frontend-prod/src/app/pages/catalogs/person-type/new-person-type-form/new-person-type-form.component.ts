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
  ValidationErrors,
  Validators
 } from '@angular/forms';


import { ToastrService } from 'ngx-toastr';
import { PersonTypeService } from '@/app/services/catalogues/person-types/person-types.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-person-type-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-person-type-form.component.html',
    styleUrl: './new-person-type-form.component.css'
})
export default class NewPersonTypeFormComponent implements OnInit{


  linkText: string[] = ['/catalogos','tipo-de-personas']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Tipo de Persona";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private personTypeService: PersonTypeService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      name: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición tipo de persona";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.personTypeService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_tipo_persona,
          name: data.name,
        });
      },
      error: (error) => {
        this.toastSrv.error('No se ha encontrado información para este id.');
        this.router.navigate(['/catalogos','tipo-de-personas']);
      },
    });
  };

  saveForm():void {
    if(!this.formGroup.invalid) {
      this.formTrimService.trimFormValues(this.formGroup)
      const id   = this.formGroup.get('id')?.value;
      const name = this.formGroup.get('name')?.value;


      if(id != 0){
        this.personTypeService.updateData({ id, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Tipo de persona actualizada correctamente.');
            this.router.navigate(['/catalogos','tipo-de-personas']);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.personTypeService.saveData({ id, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Tipo de persona guardada correctamente.');
            this.router.navigate(['/catalogos','tipo-de-personas']);
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

  showFormErrors(formGroup: FormGroup, formName: string): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);  // Verificamos si el control existe
      if (control) {  // Si el control no es undefined
        const controlErrors: ValidationErrors | null = control.errors;
        if (controlErrors) {
          Object.keys(controlErrors).forEach(errorKey => {
          });
        }
      }
    });
  }

}

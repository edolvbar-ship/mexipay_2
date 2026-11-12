import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { FilesService } from '@/app/services/files/files.service';
import { Subject, takeUntil, tap } from 'rxjs';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CommonModule } from '@angular/common';
import { CustomTableAction } from '@/app/shared/interfaces/types-interface';
import { PrimeIcons } from 'primeng/api';

@Component({
    selector: 'app-files',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        TableLayoutComponent,
        CommonModule,
        ActionButtonComponent
    ],
    templateUrl: './files.component.html',
    styleUrl: './files.component.css'
})
export class FilesComponent implements OnInit, OnDestroy {

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;

  selectedFile: File | null = null;
  uploading: boolean = false;
  fileMessage: string = "";
  sectionTitle: string = '';
  fileIsSelected: boolean = false;

  jsonData: any = {};
  isModalOpen = false;

  // Este campo debe de tener 1 de 3 valores aceptados por el servicio
  // liquidacion | contracargos | conciliacion
  // se asigna valor dependiendo del caso en el init
  methodName: string = '';
  allData: any[] = [];
  searchAllData: any[] = [];
  type: number = 0;
  search: string = '';

  actions: CustomTableAction<any>[] = [
    {
      icon: PrimeIcons.CHECK,
      label: "Respuesta",
      handler: async (index, item) => {
        const temp = JSON.parse(item.respuesta);
        this.jsonData = JSON.stringify(temp, null, 2);
        this.openModal();
      }
    },
    {
      icon: PrimeIcons.FILE_EXCEL,
      label: "Descargar",
      handler: async (index, item) => {
        this.getFileById(item.id, item.Nombre);
      }
    }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private filesService: FilesService,
    private searchService: SearchService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {

      const typeParam = params.get('type');
      if (typeParam) {

        switch (typeParam) {
          case 'conciliation':
            this.sectionTitle = 'Conciliación';
            this.methodName = 'conciliacion';
            this.type = 3;
            break;

          case 'contracharges':
            this.sectionTitle = 'Contracargos';
            this.methodName = 'contracargos';
            this.type = 1;
            break;

          case 'liquidation':
            this.sectionTitle = 'Liquidación';
            this.methodName = 'liquidacion';
            this.type = 2;
            break;

          default:
            break;
        }
        this.loadData();
        this.searchService.DataObservable
          .pipe(takeUntil(this.destroy$))
          .subscribe(filteredData => this.allData = filteredData);

        this.searchService.textObservable
          .pipe(takeUntil(this.destroy$))
          .subscribe(searchText => this.searchService.emitText(searchText, this.searchAllData));
      } else {
        this.toastSrv.info("Url no valida.")
      }

    });
  }

  loadData = (): void => {
    this.filesService.getData(this.type).pipe(
      tap((response) => {
        this.allData = response;
        this.searchAllData = response;
      })
    ).subscribe()
  }

  openFileBrowser = (): void => {
    this.fileInput.nativeElement.click();
  }

  onFileSelected = (event: any): void => {
    this.fileIsSelected = false;
    const file: File = event.target.files?.item(0);;
    if (file) {

      const fileType = file.name.split('.').pop();

      if (fileType !== 'xlsx') {
        this.toastSrv.info('Es necesario seleccionar un archivo .xlsx.');
        return;
      }
      this.selectedFile = file;
      this.fileMessage = file.name;
      this.fileIsSelected = true;
    }
  }

  onUpload = (): void => {
    if (this.selectedFile) {
      this.uploading = true;
      const formData = new FormData();
      const uploadUrl = this.filesService.getUrlUpload();
      formData.append('metodo', this.methodName);
      formData.append('file', this.selectedFile, this.selectedFile.name);
      this.http.post(uploadUrl, formData)
        .subscribe(
          (response: any) => {
            this.fileMessage = '';
            this.toastSrv.success('Archivo subido exitosamente.');
            this.uploading = false;
            this.fileIsSelected = false;
            this.loadData();
          },
          (error) => {
            this.toastSrv.error('Error en la subida del archivo.');
            this.uploading = false;
          }
        );

    } else {
      this.toastSrv.info('Por favor selecciona un archivo.');
    }
  }

  openModal = (): void => {
    this.isModalOpen = true;
  }

  closeModal = (): void => {
    this.isModalOpen = false;
  }

  getFileById = (id: number | string, fileName: string): void => {
    this.filesService.getFileById(id).subscribe(
      (response: any) => {
        const byteArray = new Uint8Array(response.file.data);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(downloadUrl);
      },
      (error) => {
        this.toastSrv.error('Ha ocurrido un error al descargar el archivo.');
      }
    );

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}

// File: src/app/admin/permissions-management/permissions-management.component.spec.ts (full production-ready with mocks; replace existing)
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';

import { PermissionsManagementComponent } from './permissions-manager.component';

describe('PermissionsManagementComponent', () => {
  let component: PermissionsManagementComponent;
  let fixture: ComponentFixture<PermissionsManagementComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PermissionsManagementComponent ],
      imports: [
        HttpClientTestingModule,
        FormsModule,
        ReactiveFormsModule,
        MatTableModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionsManagementComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load resources on init', () => {
    const mockData = [{ id: 1, id_profile: 1, id_resource: 1, allowed_methods: '["GET"]', create: 0, edit: 0, delete: 0, select: 1 }];
    component.ngOnInit();
    const req = httpMock.expectOne('/api/v2/profiles/resources');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
    expect(component.dataSource.data).toEqual(mockData);
  });

  it('should create or update resource', () => {
    component.form.setValue({
      id_profile: 1,
      id_resource: 1,
      allowed_methods: 'GET,POST',
      create: 1,
      edit: 1,
      delete: 1,
      select: 1
    });

    // Create
    component.createOrUpdate();
    const createReq = httpMock.expectOne('/api/v2/profiles/resources');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({});

    // Update (with selected)
    component.selected = { id: 1 };
    component.createOrUpdate();
    const updateReq = httpMock.expectOne('/api/v2/profiles/resources/1');
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({});
  });

  it('should delete resource', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.delete(1);
    const req = httpMock.expectOne('/api/v2/profiles/resources/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  afterEach(() => {
    httpMock.verify();
  });
});

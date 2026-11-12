import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewTransactionSchemaFormComponent } from './new-transaction-schema-form.component';

describe('NewTransactionSchemaFormComponent', () => {
  let component: NewTransactionSchemaFormComponent;
  let fixture: ComponentFixture<NewTransactionSchemaFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewTransactionSchemaFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewTransactionSchemaFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

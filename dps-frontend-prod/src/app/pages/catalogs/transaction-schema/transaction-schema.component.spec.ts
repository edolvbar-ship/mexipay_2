import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionSchemaComponent } from './transaction-schema.component';

describe('TransactionSchemaComponent', () => {
  let component: TransactionSchemaComponent;
  let fixture: ComponentFixture<TransactionSchemaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionSchemaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionSchemaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

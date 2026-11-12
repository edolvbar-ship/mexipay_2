import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewBankFormComponent } from './new-bank-form.component';

describe('NewBankFormComponent', () => {
  let component: NewBankFormComponent;
  let fixture: ComponentFixture<NewBankFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewBankFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewBankFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

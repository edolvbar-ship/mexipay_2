import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewPersonTypeFormComponent } from './new-person-type-form.component';

describe('NewPersonTypeFormComponent', () => {
  let component: NewPersonTypeFormComponent;
  let fixture: ComponentFixture<NewPersonTypeFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewPersonTypeFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewPersonTypeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

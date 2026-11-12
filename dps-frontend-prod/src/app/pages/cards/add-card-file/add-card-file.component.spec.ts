import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCardFileComponent } from './add-card-file.component';

describe('AddCardFileComponent', () => {
  let component: AddCardFileComponent;
  let fixture: ComponentFixture<AddCardFileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCardFileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCardFileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

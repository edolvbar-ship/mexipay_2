import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewBineFormComponent } from './new-bine-form.component';

describe('NewBineFormComponent', () => {
  let component: NewBineFormComponent;
  let fixture: ComponentFixture<NewBineFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewBineFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewBineFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

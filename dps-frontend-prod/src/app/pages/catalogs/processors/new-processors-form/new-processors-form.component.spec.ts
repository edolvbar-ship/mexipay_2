import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewProcessorsFormComponent } from './new-processors-form.component';

describe('NewProcessorsFormComponent', () => {
  let component: NewProcessorsFormComponent;
  let fixture: ComponentFixture<NewProcessorsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewProcessorsFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewProcessorsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

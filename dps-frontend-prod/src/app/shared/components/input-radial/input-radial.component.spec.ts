import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputRadialComponent } from './input-radial.component';

describe('InputRadialComponent', () => {
  let component: InputRadialComponent;
  let fixture: ComponentFixture<InputRadialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputRadialComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputRadialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

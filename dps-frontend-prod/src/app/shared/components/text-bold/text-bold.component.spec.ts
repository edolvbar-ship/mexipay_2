import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextBoldComponent } from './text-bold.component';

describe('TextBoldComponent', () => {
  let component: TextBoldComponent;
  let fixture: ComponentFixture<TextBoldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextBoldComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TextBoldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

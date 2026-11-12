import { TestBed } from '@angular/core/testing';

import { FormTrimService } from './form-trim.service';

describe('FormTrimService', () => {
  let service: FormTrimService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormTrimService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

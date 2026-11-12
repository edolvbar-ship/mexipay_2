import { TestBed } from '@angular/core/testing';

import { BinesService } from './bines.service';

describe('BinesService', () => {
  let service: BinesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BinesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

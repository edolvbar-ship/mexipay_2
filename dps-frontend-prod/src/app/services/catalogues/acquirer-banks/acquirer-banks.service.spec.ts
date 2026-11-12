import { TestBed } from '@angular/core/testing';

import { AcquirerBanksService } from './acquirer-banks.service';

describe('AcquirerBanksService', () => {
  let service: AcquirerBanksService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AcquirerBanksService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

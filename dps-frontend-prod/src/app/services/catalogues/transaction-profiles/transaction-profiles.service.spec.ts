import { TestBed } from '@angular/core/testing';

import { TransactionProfilesService } from './transaction-profiles.service';

describe('TransactionProfilesService', () => {
  let service: TransactionProfilesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TransactionProfilesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

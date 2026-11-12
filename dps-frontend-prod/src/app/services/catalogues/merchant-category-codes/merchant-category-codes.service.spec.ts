import { TestBed } from '@angular/core/testing';

import { MerchantCategoryCodesService } from './merchant-category-codes.service';

describe('MerchantCategoryCodesService', () => {
  let service: MerchantCategoryCodesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MerchantCategoryCodesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

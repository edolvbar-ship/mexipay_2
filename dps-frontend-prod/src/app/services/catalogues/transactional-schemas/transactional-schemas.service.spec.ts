import { TestBed } from '@angular/core/testing';

import { TransactionalSchemasService } from './transactional-schemas.service';

describe('TransactionalSchemasService', () => {
  let service: TransactionalSchemasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TransactionalSchemasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

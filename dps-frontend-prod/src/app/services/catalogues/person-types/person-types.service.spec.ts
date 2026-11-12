import { TestBed } from '@angular/core/testing';

import { PersonTypesService } from './person-types.service';

describe('PersonTypesService', () => {
  let service: PersonTypesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PersonTypesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

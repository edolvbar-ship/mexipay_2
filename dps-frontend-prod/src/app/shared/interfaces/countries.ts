export interface CountriesInterface {
    id_country:    number;
    name:          string;
    alpha_2_code:  string;
    alpha_3_code:  string;
    numeric_code:  string;
    creation_date: Date;
    last_update:   Date;
}

export interface CountriesOptionsInterface {
    id: number;
    option: string
}

export interface Countries {
    data:       CountriesInterface[];
    pagination: any;
}

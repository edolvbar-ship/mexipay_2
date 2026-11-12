import { MerchantsInterface } from "./merchants.interface"

export interface PaymentResponseInterface {
  request_id: string;
  request_date: string;
  request_status: boolean;
  http_code: number;
  resp_code: string;
  description: string;
  authorization: string;
  id: string;
  trace_id: string;
  binInformation?: {
    id_bin: number;
    id_processor: number;
    bin: string;
    bank: string;
    product: string;
    type: string;
    brand: string;
  };
}

export interface PaymentResponse3DSInterface {
  url: string;
  request_id?: string;
  request_date?: string;
  request_status?: boolean;
  http_code?: number;
  resp_code?: string;
  description?: string;
  authorization?: string;
  id?: string;
  trace_id?: string;
}

export interface SeliaPaymentResponseInterface {
  error: boolean;
  resp_code: string;
  description: string;
  authorization: string | null;
  trace_id: string;
  id: string;
  data?: {
    processor: string;
    raw_response?: string;
  };
  request_id?: string;
  request_date?: string;
  request_status?: boolean;
  http_code?: number;
}

export type AnyPaymentResponse =
  | PaymentResponseInterface
  | PaymentResponse3DSInterface
  | SeliaPaymentResponseInterface;

export interface PaymentInformationInterface {
  tarjeta: string;
  calle: string;
  cp: string;
  pais: string;
  ciudad: string;
  nombre: string;
  venci: string;
  cvv: string;
  email: string;
  linkPago: number;
  dataPayment: {
    id: number;
    monto: string;
    id_merchant: number;
    concepto: string;
    url_comercio: string;
    token: string;
    chargePlan: string;
  };
}

export interface SeliaPaymentInformationInterface {
  tarjeta: string;
  calle: string;
  cp: string;
  pais: string;
  ciudad: string;
  nombre: string;
  venci: string;
  cvv: string;
  email: string;
  linkPago: number;
  dataPayment: {
    id: number;
    monto: string;
    id_merchant: number;
    concepto: string;
    url_comercio: string;
    token: string;
    chargePlan: string;
    processor?: string;
  };
}

export interface VerifyPaymentInformationInterface {
  reference: string | undefined;
  cvv: string;
  token: string;
  idMerchant: number;
  paymentLink: number;
}

export interface LinkInformationInterface {
  concepto: string;
  created_at?: Date;
  expire_date?: Date;
  id: number;
  id_merchant: number;
  id_user: number;
  info_adicional?: PaymentInformationInterface;
  merchant: MerchantsInterface;
  monto: string;
  status: number;
  token: string;
  updated_at?: Date;
  hasPartial: boolean;
  allowedPlans: [];
}

export interface LinkValidationInterface {
  statusCode: number;
  description?: string;
  data?: LinkInformationInterface;
}

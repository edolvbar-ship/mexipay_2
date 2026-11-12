export interface MccOperationInterface {
  id_operation?: number;
  mcc_code: string;
  name: string;
  description: string;
  operation_code: string;
  msg_type: string;
  processing_code: string;
  requires_amount: number;
  requires_tip: number;
  active: number;
  display_order: number;
  icon_name: string;
  category_code: string;
  creation_date?: string;
  updated_at?: string;
}

export interface MccCategoryInterface {
  code: string;
  name: string;
  description: string;
  operations: MccOperationInterface[];
}

export interface MccTableInterface {
  id_operation: number;
  mcc_code: string;
  name: string;
  description: string;
  operation_code: string;
  msg_type: string;
  requires_amount: string;
  requires_tip: string;
  active: string;
  display_order: number;
  icon_name: string;
  actions?: string;
}

// MSI Interface Definitions
// Used across all MSI-related components and services

export interface MsiConfig {
  id_merchant: number;
  name_merchant: string;
  msi_config: Array<{
    type: string;
    min_mount: string;
    percent: string;
  }>;
  enabled_operations: Array<{
    id_operation: number;
    name: string;
    msi_enabled: number;
  }>;
  national_only: boolean;
  token_q6_supported: boolean;
  months_options: number[];
  min_amounts: { [key: number]: number };
  last_updated: string;
}

export interface MsiUpdate {
  months: number;
  min_amount: number;
}

export interface MsiMerchantOverride {
  id_operation: number;
  months: number;
  min_amount: number;
  active: boolean;
}

export interface MsiNationalBin {
  id_msi_bin: number;
  bin_start: string;
  bin_end: string;
  bank_name: string;
  card_brand: string;
  active: boolean;
}

export interface TokenQ6 {
  deferral: string;  // DD
  payments: string;  // PP
  plan_type: string; // PT
  full_token: string; // DDPPPT
}

export interface MsiBinRange {
  start: string;
  end: string;
  brand: string;
  bank_name?: string;
  active: boolean;
}

export interface MsiOperationConfig {
  id_operation: number;
  name_operation: string;
  msi_enabled: boolean;
  min_amounts: { [key: number]: number };
  months_options: number[];
}

export interface MsiSystemConfig {
  national_only: boolean;
  token_q6_supported: boolean;
  default_months: number[];
  default_min_amounts: { [key: number]: number };
  bin_ranges: MsiBinRange[];
}

export interface MsiValidationResult {
  is_mexican: boolean;
  is_msi_eligible: boolean;
  bin_info: {
    brand: string;
    range: string;
    bank_name?: string;
  } | null;
  error?: string;
}

export interface MsiTerminalRequest {
  id_merchant: number;
  terminal_id: string;
  auth_token: string;
}

export interface MsiTerminalConfigRequest extends MsiTerminalRequest {
  msi_updates: MsiUpdate[];
}

export interface MsiBinValidationRequest extends MsiTerminalRequest {
  bin: string;
}

export interface MsiWebserviceResponse {
  success: boolean;
  timestamp: string;
  data?: any;
  error?: string;
}

// Component-specific interfaces
export interface ComponentMsiConfig {
  enabled: boolean;
  national_only: boolean;
  token_q6_supported: boolean;
  months_options: number[];
  min_amounts: { [key: number]: number };
  enabled_operations: Array<{
    id_operation: number;
    name: string;
    msi_enabled: number;
  }>;
}

export interface MsiPlan {
  months: number;
  min_amount: number;
  enabled: boolean;
}

export interface MsiBinFormData {
  bin_start: string;
  bin_end: string;
  bank_name: string;
  card_brand: string;
  active: boolean;
}

export interface MsiOperationFormData {
  id_operation: number;
  msi_enabled: boolean;
  months_options: number[];
  min_amounts: { [key: number]: number };
}

// Form validation interfaces
export interface MsiConfigForm {
  enabled: boolean;
  national_only: boolean;
  token_q6_supported: boolean;
  plans: MsiPlan[];
}

export interface MsiBinForm {
  binRanges: MsiBinRange[];
}

export interface MsiOperationForm {
  operations: MsiOperationConfig[];
}

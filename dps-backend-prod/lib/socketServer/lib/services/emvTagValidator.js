/**
 * ISO 8583 EMV Tag Validator for PROSA
 * Validates required EMV tags by Entry Mode, Service Code, and Transaction Type
 * Ensures all required tags are present and have valid values
 *
 * Modes:
 * - 'strict': Blocks transaction on errors. Returns valid=false if errors exist.
 * - 'silent': Runs all validations, returns valid=true BUT includes all errors/warnings in the response.
 * - 'report-only' (default): Same as silent with additional debug logging metadata.
 *
 * Version: 2.1.0
 * Updated: Added conditional validation modes (strict/silent/report-only). Default is report-only.
 */

/**
 * EMV Tag Definitions with Required Values
 */
const EMV_TAG_DEFINITIONS = {
  // Card Data Tags
  '5A': { name: 'Application PAN', format: 'hex', required: true, description: 'Primary Account Number from chip' },
  '57': { name: 'Track 2 Equivalent Data', format: 'hex', required: true, description: 'Track 2 data from chip' },
  '5F20': { name: 'Cardholder Name', format: 'ascii', required: false, description: 'Cardholder name from chip' },
  '5F24': { name: 'Application Expiration Date', format: 'yyMM', required: true, description: 'Expiration date YYMM' },
  '5F2A': { name: 'Transaction Currency Code', format: 'hex', required: true, description: 'ISO 4217 currency code' },
  '5F2D': { name: 'Language Preference', format: 'ascii', required: false, description: 'Language codes (es,en,fr)' },
  '5F30': { name: 'Service Code', format: 'hex', required: true, description: 'Service code from chip' },
  '5F34': { name: 'Application PAN Sequence Number', format: 'hex', required: true, description: 'PAN sequence number' },

  // Application Data Tags
  '4F': { name: 'Application ID (AID)', format: 'hex', required: true, description: 'Application Identifier' },
  '50': { name: 'Application Label', format: 'ascii', required: true, description: 'Application name (VISA DEBIT, etc.)' },
  '84': { name: 'Dedicated File Name', format: 'hex', required: true, description: 'DF Name / AID' },
  '8E': { name: 'Cardholder Verification Method List', format: 'hex', required: true, description: 'CVM list' },
  '9F06': { name: 'Application Identifier (Issuer)', format: 'hex', required: true, description: 'Issuer AID' },
  '9F07': { name: 'Application Usage Control', format: 'hex', required: true, description: 'Usage restrictions' },
  '9F09': { name: 'Application Version Number', format: 'hex', required: true, description: 'Version number' },
  '9F0D': { name: 'Issuer Action Code - Default', format: 'hex', required: true, description: 'Default issuer action' },
  '9F0F': { name: 'Issuer Action Code - Denial', format: 'hex', required: true, description: 'Denial action code' },
  '9F10': { name: 'Issuer Application Data (IAD)', format: 'hex', required: true, description: 'Issuer-specific data' },
  '9F11': { name: 'Issuer Action Code - Online', format: 'hex', required: true, description: 'Online action code' },
  '9F16': { name: 'Merchant Identifier', format: 'hex', required: false, description: 'Merchant ID' },
  '9F1A': { name: 'Terminal Country Code', format: 'hex', required: true, description: 'ISO country code' },
  '9F1E': { name: 'Interface Device Serial Number', format: 'hex', required: true, description: 'Terminal serial number' },
  '9F21': { name: 'Transaction Time', format: 'hex', required: true, description: 'Time of transaction' },
  '9F26': { name: 'Application Cryptogram (ARQC)', format: 'hex', required: true, description: 'ARQC for online authorization' },
  '9F27': { name: 'Cryptogram Information Data', format: 'hex', required: true, description: 'Bits 8-7: 00=AAC, 01=TC, 10=ARQC, 11=AAR. Bit 4: advice required. Bits 3-1: action code.' },
  '9F33': { name: 'Terminal Capabilities', format: 'hex', required: true, description: 'Terminal EMV capabilities' },
  '9F34': { name: 'Cardholder Verification Method Results', format: 'hex', required: true, description: 'CVM results' },
  '9F35': { name: 'Terminal Type', format: 'hex', required: true, description: 'Terminal type code' },
  '9F36': { name: 'Application Transaction Counter (ATC)', format: 'hex', required: true, description: 'ATC counter' },
  '9F37': { name: 'Unpredictable Number', format: 'hex', required: true, description: 'UN for cryptogram' },
  '9F39': { name: 'Point of Service Entry Mode', format: 'hex', required: true, description: 'POS entry mode (05, 07, etc.)' },
  '9F4C': { name: 'ICC Dynamic Number', format: 'hex', required: false, description: 'Contactless dynamic number' },
  '9F4E': { name: 'Merchant Name', format: 'hex', required: false, description: 'Merchant name' },
  '9F6E': { name: 'Form Factor Indicator', format: 'hex', required: false, description: 'Contactless device type' },
  '9F7C': { name: 'Customer Exclusive Data', format: 'hex', required: false, description: 'Customer data' },
  '9B': { name: 'Transaction Status Information (TSI)', format: 'hex', required: true, description: 'TSI flags' },
  '9C': { name: 'Transaction Type', format: 'hex', required: true, description: 'Transaction type (00=purchase)' },
  '9A': { name: 'Transaction Date', format: 'hex', required: true, description: 'Date YYMMDD' },

  // Additional Tags for Contactless
  '5F28': { name: 'Issuer Country Code', format: 'hex', required: false, description: 'Issuer country' },
  '5F25': { name: 'Application Effective Date', format: 'hex', required: false, description: 'Effective date' },
  '82': { name: 'Application Interchange Profile', format: 'hex', required: true, description: 'AIP' },
  '95': { name: 'Terminal Verification Results', format: 'hex', required: true, description: 'TVR' },
  '9F02': { name: 'Amount, Authorized', format: 'hex', required: true, description: 'Amount in cents' },
  '9F03': { name: 'Amount, Other', format: 'hex', required: true, description: 'Other amount (cashback)' },
};

/**
 * Entry Mode → Required EMV Tags Mapping
 */
const ENTRY_MODE_EMV_REQUIREMENTS = {
  // Chip (Contact) - Entry Mode 05
  '05': {
    required: [
      '4F', '5A', '57', '5F24', '5F2A', '5F30', '5F34',
      '82', '84', '8E', '95', '9A', '9B', '9C', '9F02',
      '9F03', '9F09', '9F10', '9F1A', '9F1E', '9F21', '9F26',
      '9F27', '9F33', '9F34', '9F35', '9F36', '9F37', '9F39'
    ],
    conditional: [
      '5F20', '5F2D', '9F06', '9F07', '9F0D', '9F0F', '9F11', '9F16',
      '9F4E', '9F7C', '50'
    ],
    forbidden: ['EY'],
    validation: {
      '9F27': { validCryptogramTypes: ['TC', 'ARQC', 'AAR'], description: 'ARQC (online), TC (offline approve), or AAR (online decline) allowed for chip. AAC (offline decline) is BLOCKED.' },
      '9F39': { validValues: ['05'], description: 'Entry Mode must be 05 for chip' },
      '9F26': { requiredLength: 16, description: 'ARQC must be 16 hex characters' },
      '95': { requiredLength: 10, description: 'TVR must be 10 hex characters' },
    }
  },

  // Contactless - Entry Mode 07
  '07': {
    required: [
      '4F', '5A', '57', '5F24', '5F2A', '5F30', '5F34',
      '82', '84', '8E', '95', '9A', '9B', '9C', '9F02',
      '9F03', '9F09', '9F10', '9F1A', '9F1E', '9F21', '9F26',
      '9F27', '9F33', '9F34', '9F35', '9F36', '9F37', '9F39',
      '9F4C', '9F6E'
    ],
    conditional: [
      '5F20', '5F2D', '9F06', '9F07', '9F0D', '9F0F', '9F11', '9F16',
      '9F4E', '9F7C', '50'
    ],
    forbidden: ['EY'],
    validation: {
      '9F27': { validCryptogramTypes: ['ARQC', 'TC', 'AAR'], description: 'ARQC (online) or TC (offline approve) allowed for contactless. AAC (offline decline) is BLOCKED. AAR (online decline) for issuer response.' },
      '9F39': { validValues: ['07', '071'], description: 'Entry Mode must be 07 for contactless' },
      '9F6E': { requiredLength: 8, description: 'Form Factor Indicator required for contactless' },
      '9F4C': { requiredLength: 16, description: 'ICC Dynamic Number required for contactless (8 bytes = 16 hex chars)' },
      '9F26': { requiredLength: 16, description: 'ARQC must be 16 hex characters' },
    }
  },

  // Fallback - Entry Mode 80
  '80': {
    required: [
      '5A', '57', '5F24', '5F2A', '5F30', '5F34',
      '9A', '9C', '9F02', '9F03', '9F1A', '9F26',
      '9F27', '9F36', '9F37'
    ],
    conditional: [
      '4F', '82', '84', '8E', '95', '9B', '9F09', '9F10',
      '9F1E', '9F21', '9F33', '9F34', '9F35', '9F39'
    ],
    forbidden: [],
    validation: {
      '9F27': { validCryptogramTypes: ['ARQC'], description: 'ARQC (online) allowed. AAC (offline decline) is BLOCKED.' },
      '9F26': { requiredLength: 16, description: 'ARQC must be 16 hex characters' },
    }
  },

  // Magstripe - Entry Mode 90
  '90': {
    required: [
      '5A', '57', '5F24', '5F2A', '5F30', '5F34',
      '9A', '9C', '9F02', '9F03', '9F1A'
    ],
    conditional: [],
    forbidden: ['9F26', '9F27', '9F36', '9F37'],
    validation: {
      '9F27': { shouldNotExist: true, description: 'Cryptogram NOT allowed for magstripe' },
    }
  },

  // Contactless Magstripe - Entry Mode 91
  '91': {
    required: [
      '5A', '57', '5F24', '5F2A', '5F30', '5F34',
      '9A', '9C', '9F02', '9F03', '9F1A', '9F6E'
    ],
    conditional: ['9F4C'],
    forbidden: ['9F26', '9F27', '9F36', '9F37'],
    validation: {
      '9F6E': { requiredLength: 8, description: 'Form Factor Indicator required' },
    }
  },

  // E-Commerce - Entry Mode 81
  '81': {
    required: [
      '5A', '5F24', '5F2A', '5F30', '5F34',
      '9A', '9C', '9F02', '9F03', '9F1A'
    ],
    conditional: ['9F26', '9F27', '9F36', '9F37', '9F4C', '9F6E'],
    forbidden: ['57', '95', '9B', '9F09', '9F10', '9F1E', '9F21', '9F33', '9F34', '9F35', '9F39'],
    validation: {
      '9F27': { validCryptogramTypes: ['ARQC'], description: 'ARQC for 3D Secure transactions' },
    }
  },

  // Card on File - Entry Mode 10
  '10': {
    required: [
      '5A', '5F24', '5F2A', '5F30', '5F34',
      '9A', '9C', '9F02', '9F03', '9F1A'
    ],
    conditional: ['9F26', '9F27', '9F36', '9F37'],
    forbidden: ['57', '95', '9B', '9F09', '9F10', '9F1E', '9F21', '9F33', '9F34', '9F35', '9F39'],
    validation: {
      '9F27': { validCryptogramTypes: ['ARQC'], description: 'ARQC for CoF transactions' },
    }
  },

  // Manual Entry - Entry Mode 01
  '01': {
    required: [
      '5A', '5F24', '5F2A', '5F30', '5F34',
      '9A', '9C', '9F02', '9F03', '9F1A'
    ],
    conditional: [],
    forbidden: ['57', '95', '9B', '9F09', '9F10', '9F1E', '9F21', '9F26', '9F27', '9F33', '9F34', '9F35', '9F36', '9F37', '9F39'],
    validation: {}
  },
};

/**
 * Service Code → PIN Requirements Mapping (PROSA Mexico)
 *
 * According to CNBV regulations and PROSA specifications:
 * - First digit: 1=International, 6=Domestic (Mexico), 8=Domestic
 * - Second digit: 0=Normal, 2=Cross-border/International
 * - Third digit: 1=PIN required (all), 2=PIN for cash only, 6=No PIN (signature/ID)
 */
const SERVICE_CODE_PIN_REQUIREMENTS = {
  // ─── PIN REQUIRED (Third digit: 1, 2, 3, 4, 5) ───

  // International
  '101': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '103': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '105': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '201': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },  // Mastercard international
  '203': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '205': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '301': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '501': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },

  // Domestic (Mexico)
  '601': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '603': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '605': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '621': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '623': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '625': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '701': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '801': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '803': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '805': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '901': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '903': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },
  '905': { pinRequired: true, requiresOnlinePin: true, cvmType: 'pin' },

  // ─── PIN NOT REQUIRED (Third digit: 6, 7, 8, 9) ───

  // International (no PIN - signature/ID check)
  '106': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '206': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '306': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '506': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },

  // Domestic (no PIN - signature/ID check)
  '606': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '626': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '706': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '806': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },
  '906': { pinRequired: false, requiresOnlinePin: false, cvmType: 'signature' },

  // No CVM Required (Third digit: 7, 8, 9)
  '107': { pinRequired: false, requiresOnlinePin: false, cvmType: 'none' },
  '207': { pinRequired: false, requiresOnlinePin: false, cvmType: 'none' },
  '607': { pinRequired: false, requiresOnlinePin: false, cvmType: 'none' },
  '807': { pinRequired: false, requiresOnlinePin: false, cvmType: 'none' },
  '907': { pinRequired: false, requiresOnlinePin: false, cvmType: 'none' },
};

/**
 * Cryptogram Information Data (9F27) bit definitions per EMV Book 3
 * Bits 8-7: Cryptogram Type (00=AAC, 01=TC, 10=ARQC, 11=AAR)
 * Bit 4: Advice Required (0=no, 1=yes)
 * Bits 3-1: Issuer Action Code (000=no info, 001=service not allowed, 010=PIN try limit exceeded, 011=issuer auth failed)
 * Bits 6,5: Reserved for future use
 */
const CRYPTOGRAM_TYPE_MAP = {
  0: { name: 'AAC', type: 'offline', description: 'Application Authentication Cryptogram - Offline decline', approved: false },
  1: { name: 'TC', type: 'offline', description: 'Transaction Certificate - Offline approved', approved: true },
  2: { name: 'ARQC', type: 'online', description: 'Authorization Request Cryptogram - Online authorization required', approved: true },
  3: { name: 'AAR', type: 'online', description: 'Application Authentication Response - Online declined', approved: false },
};

const CID_ACTION_CODE_MAP = {
  0: 'No information',
  1: 'Service not allowed',
  2: 'PIN try limit exceeded',
  3: 'Issuer authentication failed',
};

/**
 * CVM (Cardholder Verification Method) Codes
 */
const CVM_CODES = {
  '00': { name: 'No CVM Required', type: 'none' },
  '01': { name: 'Fail CVM Processing', type: 'fail' },
  '02': { name: 'Plaintext PIN Verification by ICC', type: 'pin' },
  '03': { name: 'Enciphered PIN Verification by ICC', type: 'pin' },
  '04': { name: 'Plaintext PIN Verification by ICC and Signature', type: 'pin_signature' },
  '05': { name: 'Enciphered PIN Verification by ICC and Signature', type: 'pin_signature' },
  '06': { name: 'Enciphered PIN Verification by ICC and Online PIN', type: 'pin_online' },
  '1E': { name: 'Signature (Paper)', type: 'signature' },
  '1F': { name: 'Signature (Electronic)', type: 'signature' },
  '41': { name: 'Online PIN', type: 'pin_online' },
  '42': { name: 'Online PIN and Signature', type: 'pin_online_signature' },
  '50': { name: 'No CVM Required (Merchant)', type: 'none' },
  '51': { name: 'Merchant Activated', type: 'none' },
  '52': { name: 'Merchant Activated (Device)', type: 'none' },
  '53': { name: 'Consumer Activated', type: 'none' },
  '5F': { name: 'Offline PIN', type: 'pin_offline' },
  '5E': { name: 'Offline PIN and Signature', type: 'pin_offline_signature' },
};

/**
 * Main EMV Tag Validator
 */
class EMVTagValidator {
  /**
   * Normalize EMV tags from various input formats into a key-value object
   * @param {Array|Object|string} emvTagsInput - EMV tags in array [{tag, value}], object {tag: value}, or TLV string format
   * @returns {Object} Normalized key-value object { '5A': '...', '57': '...', ... }
   */
  static normalizeEmvTags(emvTagsInput) {
    if (!emvTagsInput) return {};

    // Already a key-value object
    if (typeof emvTagsInput === 'object' && !Array.isArray(emvTagsInput)) {
      const result = {};
      for (const [key, value] of Object.entries(emvTagsInput)) {
        result[key.toUpperCase()] = String(value);
      }
      return result;
    }

    // Array of {tag, value} objects
    if (Array.isArray(emvTagsInput)) {
      const result = {};
      for (const item of emvTagsInput) {
        if (item && item.tag && item.value !== undefined) {
          result[item.tag.toUpperCase()] = String(item.value);
        }
      }
      return result;
    }

    // TLV string format (e.g., "9F270380...")
    if (typeof emvTagsInput === 'string') {
      const result = {};
      let remaining = emvTagsInput;
      while (remaining.length >= 4) {
        // Try to parse tag (1 or 2 bytes)
        let tag = remaining.substring(0, 2);
        let offset = 2;

        // Check for 2-byte tag (5F, 9F prefix)
        if ((tag === '5F' || tag === '9F') && remaining.length >= 4) {
          tag = remaining.substring(0, 4);
          offset = 4;
        }

        remaining = remaining.substring(offset);
        if (remaining.length < 2) break;

        // Parse length (1 byte, could be 1-3 digit LLLN format)
        const lenHex = remaining.substring(0, 2);
        const len = parseInt(lenHex, 16);
        remaining = remaining.substring(2);

        if (isNaN(len) || remaining.length < len * 2) break;

        const value = remaining.substring(0, len * 2);
        result[tag.toUpperCase()] = value;
        remaining = remaining.substring(len * 2);
      }
      return result;
    }

    return {};
  }

  /**
   * Extract service code from Track 2 data or EMV tag 5F30
   * @param {Object} emvTags - Normalized EMV tags
   * @param {string} track2 - Track 2 data if available
   * @returns {string} Service code (3 digits)
   */
  static extractServiceCode(emvTags, track2) {
    // Try 5F30 first
    if (emvTags['5F30']) {
      const sc = emvTags['5F30'];
      // Convert hex to ASCII if needed
      if (/^[0-9A-Fa-f]+$/.test(sc) && sc.length >= 6) {
        let ascii = '';
        for (let i = 0; i < sc.length; i += 2) {
          ascii += String.fromCharCode(parseInt(sc.substring(i, i + 2), 16));
        }
        return ascii.substring(0, 3);
      }
      return sc.substring(0, 3);
    }

    // Try Track 2 (format: PAN=D...YYMMSC...)
    if (track2) {
      const parts = track2.split(/[D=]/);
      if (parts.length >= 2) {
        const afterPan = parts[1];
        // Service code is positions 5-7 in the Track 2 discretionary data
        // Format: YYMM SC...
        if (afterPan.length >= 7) {
          return afterPan.substring(4, 7);
        }
      }
    }

    return '201'; // Default - PIN required
  }

  /**
   * Validate EMV tags against Entry Mode and Service Code
   * @param {Object} emvTags - Key-value object of EMV tags { '5A': '4152314611664742', ... }
   * @param {string} entryMode - P-022 value (e.g., '051', '071')
   * @param {string} serviceCode - Service code from P-035 (e.g., '201', '221')
   * @param {Object} options - Additional options
   * @returns {Object} Validation result
   */
  static validate(emvTags, entryMode, serviceCode, options = {}) {
    const mode = options.mode || 'report-only';
    const errors = [];
    const warnings = [];
    const info = [];
    const debug = [];

    // Normalize entry mode to 2-digit method code
    const entryMethod = entryMode ? entryMode.substring(0, 2) : '01';

    // Detect digital wallet (Apple Pay, Google Pay, etc.) via 9F6E form factor indicator.
    // Any form factor byte that's NOT '00' (card) or '01' (key fob) indicates a wallet/device.
    // This catches Apple Pay (23), Google Pay, watches, tablets, etc.
    const formFactorByte = emvTags['9F6E'] ? emvTags['9F6E'].substring(0, 2).toUpperCase() : '';
    const isDigitalWalletBy9F6E = entryMethod === '07' && formFactorByte &&
      formFactorByte !== '00' && formFactorByte !== '01';

    // Fallback: detect digital wallet by absence of physical-card-only tags.
    // A physical contactless card ALWAYS has 9F4C (ICC Dynamic Number) from the kernel.
    // If 9F4C is missing on contactless (07), it's almost certainly a digital wallet.
    const isDigitalWalletByAbsence = entryMethod === '07' && !emvTags['9F4C'];

    const isDigitalWallet = isDigitalWalletBy9F6E || isDigitalWalletByAbsence;

    const context = {
      entryMode: entryMode,
      entryMethod: entryMethod,
      serviceCode: serviceCode,
      tagCount: Object.keys(emvTags).length,
      isContactless: entryMethod === '07',
      isChip: entryMethod === '05',
      isFallback: entryMethod === '80',
      isMagstripe: entryMethod === '90',
      isContactlessMag: entryMethod === '91',
      isECommerce: entryMethod === '81',
      isCardOnFile: entryMethod === '10',
      isManual: entryMethod === '01',
      isDigitalWallet: isDigitalWallet,
      mode: mode,
    };

    // ── CRITICAL SECURITY PRE-CHECK: Block AAC and missing cryptogram immediately ──
    // This runs BEFORE any mode-dependent logic and always blocks the transaction.
    const isEMVEntryMode = ['05', '07', '80'].includes(entryMethod);
    if (isEMVEntryMode) {
      const cidValue = emvTags['9F27'];
      const cryptogramTag = emvTags['9F26'];

      // Block if no valid cryptogram present
      if (!cidValue) {
        errors.push({
          field: 'tag.9F27',
          code: 'AAC_OFFLINE_DECLINE',
          message: '9F27 (Cryptogram Information Data) is MISSING. No valid cryptogram present — transaction BLOCKED.',
          severity: 'error',
        });
      } else {
        const cidInfo = this.parseCryptogramInfoData(cidValue);
        if (!cidInfo) {
          errors.push({
            field: 'tag.9F27',
            code: 'AAC_OFFLINE_DECLINE',
            message: `9F27 value "${cidValue}" is invalid. No valid cryptogram present — transaction BLOCKED.`,
            severity: 'error',
          });
        } else if (cidInfo.name === 'AAC') {
          errors.push({
            field: 'tag.9F27',
            code: 'AAC_OFFLINE_DECLINE',
            message: `AAC (Application Authentication Cryptogram) detected — offline decline. Transaction BLOCKED immediately. 9F27=${cidValue}`,
            severity: 'error',
            cidInfo: cidInfo,
          });
        }
      }

      // Block if 9F26 (Application Cryptogram) is missing for EMV entry modes
      if (!cryptogramTag) {
        errors.push({
          field: 'tag.9F26',
          code: 'AAC_OFFLINE_DECLINE',
          message: '9F26 (Application Cryptogram) is MISSING. No valid cryptogram present — transaction BLOCKED.',
          severity: 'error',
        });
      }
    }

    // ── CRITICAL SECURITY PRE-CHECK: Enforce required contactless tags ──
    // For digital wallets (Apple Pay, Google Pay), physical-card-only tags are relaxed:
    //   5F30 (Service Code) — wallets don't have a physical service code
    //   9F4C (ICC Dynamic Number) — wallets use different cryptogram scheme
    if (context.isContactless) {
      const physicalCardOnlyTags = ['5F30', '9F4C'];
      const requiredContactlessTags = context.isDigitalWallet
        ? ['9F02', '9F03', '9F1A', '9F33', '9F35', '9F37', '9F26']
        : ['5F30', '9F4C', '9F02', '9F03', '9F1A', '9F33', '9F35', '9F37', '9F26'];
      for (const tag of requiredContactlessTags) {
        if (!emvTags[tag]) {
          const def = EMV_TAG_DEFINITIONS[tag];
          errors.push({
            field: `tag.${tag}`,
            code: 'MISSING_REQUIRED_CONTACTLESS_TAG',
            message: `Required contactless EMV tag ${tag} is missing. ${def ? def.description : ''}. Transaction BLOCKED.`,
            severity: 'error',
            expected: tag,
            entryMode: entryMethod,
          });
        }
      }
      if (context.isDigitalWallet) {
        debug.push({
          timestamp: new Date().toISOString(),
          info: 'Digital wallet detected (9F6E form factor) — physical-card-only tags (5F30, 9F4C) relaxed',
          formFactorByte: formFactorByte,
        });
      }
    }

    // ── CRITICAL SECURITY PRE-CHECK: Amount tampering detection ──
    if (options.amount && emvTags['9F02']) {
      const amountTag = emvTags['9F02'];
      const emvAmount = parseInt(amountTag, 10);
      const requestAmount = parseInt(options.amount, 10);
      if (!isNaN(emvAmount) && !isNaN(requestAmount) && emvAmount !== requestAmount) {
        errors.push({
          field: 'tag.9F02',
          code: 'AMOUNT_MISMATCH',
          message: `Amount tampering detected: 9F02=${emvAmount} cents does not match request amount=${requestAmount} cents. Transaction BLOCKED.`,
          severity: 'error',
          emvAmount: emvAmount,
          requestAmount: requestAmount,
        });
      }
    }

    // 1. Validate Entry Mode has requirements defined
    const requirements = ENTRY_MODE_EMV_REQUIREMENTS[entryMethod];
    if (!requirements) {
      errors.push({
        field: 'entryMode',
        code: 'UNKNOWN_ENTRY_MODE',
        message: `No EMV requirements defined for Entry Mode: ${entryMethod}`,
        severity: 'error',
      });
      if (mode === 'silent' || mode === 'report-only') {
        return {
          valid: true,
          isValid: true,
          validButHasIssues: true,
          errors,
          warnings,
          info,
          debug,
          context,
          summary: `⚠️ Validation bypassed: Unknown entry mode (${mode} mode)`,
          mode: mode,
          request: { emvTags, entryMode, serviceCode, options },
          tagAnalysis: { total: Object.keys(emvTags).length, required: 0, present: 0, missing: [], extra: [] },
        };
      }
      return { valid: false, isValid: false, errors, warnings, info, debug, context };
    }

    // 2. Validate Required Tags are present
    // For digital wallets (Apple Pay, Google Pay), physical-card-only and conditional tags are relaxed
    const walletRelaxedTags = ['5A', '5F24', '5F25', '5F30', '8E', '9F0D', '9F0F', '9F11', '9F4C'];
    for (const tag of requirements.required) {
      if (context.isDigitalWallet && walletRelaxedTags.includes(tag)) {
        continue;
      }
      if (!emvTags[tag]) {
        const def = EMV_TAG_DEFINITIONS[tag];
        errors.push({
          field: `tag.${tag}`,
          code: 'MISSING_REQUIRED_TAG',
          message: `Required EMV tag ${tag} is missing. ${def ? def.description : ''}`,
          severity: 'error',
          expected: tag,
          entryMode: entryMethod,
        });
      }
    }

    // 3. Validate Forbidden Tags are NOT present
    for (const tag of requirements.forbidden || []) {
      if (emvTags[tag]) {
        const def = EMV_TAG_DEFINITIONS[tag];
        errors.push({
          field: `tag.${tag}`,
          code: 'FORBIDDEN_TAG_PRESENT',
          message: `Tag ${tag} is FORBIDDEN for Entry Mode ${entryMethod}. ${def ? def.description : ''}`,
          severity: 'error',
          expected: 'NOT PRESENT',
          actual: emvTags[tag],
        });
      }
    }

    // 4. Validate Conditional Tags (warn if missing)
    for (const tag of requirements.conditional || []) {
      if (!emvTags[tag]) {
        const def = EMV_TAG_DEFINITIONS[tag];
        warnings.push({
          field: `tag.${tag}`,
          code: 'MISSING_CONDITIONAL_TAG',
          message: `Conditional tag ${tag} is missing. ${def ? def.description : ''}`,
          severity: 'warning',
        });
      }
    }

    // 5. Validate Tag Values and Formats
    for (const [tag, value] of Object.entries(emvTags)) {
      const validation = requirements.validation && requirements.validation[tag];
      const def = EMV_TAG_DEFINITIONS[tag];

      // Validate format
      if (def && def.format === 'hex') {
        if (!/^[0-9A-Fa-f]+$/.test(value)) {
          errors.push({
            field: `tag.${tag}`,
            code: 'INVALID_FORMAT',
            message: `Tag ${tag} value "${value}" is not valid hex`,
            severity: 'error',
            expected: 'hex',
            actual: value,
          });
        }
      }

      // Validate required length
      if (validation && validation.requiredLength) {
        const expectedLen = validation.requiredLength;
        const actualLen = value.length;
        if (actualLen !== expectedLen) {
          errors.push({
            field: `tag.${tag}`,
            code: 'INVALID_LENGTH',
            message: `Tag ${tag} length mismatch. Expected: ${expectedLen}, Actual: ${actualLen}. ${validation.description}`,
            severity: 'error',
            expected: expectedLen,
            actual: actualLen,
          });
        }
      }

      // Validate specific tag values
      if (validation && validation.validValues) {
        if (!validation.validValues.includes(value)) {
          errors.push({
            field: `tag.${tag}`,
            code: 'INVALID_VALUE',
            message: `Tag ${tag} value "${value}" is invalid. Valid: ${validation.validValues.join(', ')}. ${validation.description}`,
            severity: 'error',
            expected: validation.validValues,
            actual: value,
          });
        }
      }

      // Validate 9F27 cryptogram type via bit parsing
      if (validation && validation.validCryptogramTypes) {
        const cidInfo = this.parseCryptogramInfoData(value);
        if (!cidInfo) {
          errors.push({
            field: `tag.${tag}`,
            code: 'INVALID_CID_FORMAT',
            message: `Tag ${tag} value "${value}" is not a valid hex byte for Cryptogram Information Data. Expected 2 hex chars (1 byte).`,
            severity: 'error',
            expected: '2 hex chars (1 byte)',
            actual: value,
          });
        } else if (!validation.validCryptogramTypes.includes(cidInfo.name)) {
          errors.push({
            field: `tag.${tag}`,
            code: 'INVALID_CRYPTOGRAM_TYPE',
            message: `Tag ${tag} value "${value}" → ${cidInfo.name} (${cidInfo.description}). Allowed: ${validation.validCryptogramTypes.join(', ')}. ${validation.description}`,
            severity: 'error',
            expected: validation.validCryptogramTypes,
            actual: cidInfo.name,
            cidInfo: cidInfo,
          });
        }

        // ➕ FIX: Additional 9F27 validation for issuer authentication failure
        if (cidInfo && cidInfo.actionCode === 3) {
          warnings.push({
            field: `tag.${tag}`,
            code: 'ISSUER_AUTH_FAILED',
            message: `9F27 (${value}): Issuer Authentication Failed (action code 3). Terminal should generate AAC/AAR.`,
            severity: 'warning',
            cidInfo: cidInfo,
          });
        }
      }

      // Check if tag should NOT exist
      if (validation && validation.shouldNotExist) {
        errors.push({
          field: `tag.${tag}`,
          code: 'TAG_SHOULD_NOT_EXIST',
          message: `Tag ${tag} should NOT exist for Entry Mode ${entryMethod}. ${validation.description}`,
          severity: 'error',
        });
      }
    }

    // 6. Special validations
    this._validateCryptogramTag(emvTags, requirements, errors, warnings, context);
    this._validateTVR(emvTags, errors, warnings, context);
    this._validatePINRequirement(emvTags, serviceCode, errors, warnings, context);
    this._validateContactlessTags(emvTags, errors, warnings, context, info);
    this._validateCVMList(emvTags, serviceCode, errors, warnings, context, info);
    this._validateAIDConsistency(emvTags, errors, warnings);
    this._validateATC(emvTags, errors, warnings);

    if (options.amount) {
      this._validateAmount(emvTags, options.amount, errors, warnings);
    }

    // 7. Determine final validity based on mode
    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    let valid;
    let isValid;
    let validButHasIssues = false;
    let summaryMessage = '';

    switch (mode) {
      case 'silent':
        valid = true;
        isValid = true;
        validButHasIssues = hasErrors || hasWarnings;
        summaryMessage = hasErrors
          ? `⚠️ ${errors.length} error(s) found (bypassed in silent mode)`
          : hasWarnings
            ? `⚠️ ${warnings.length} warning(s) found (silent mode)`
            : '✅ All EMV tags valid (silent mode)';
        break;

      case 'report-only':
        valid = true;
        isValid = true;
        validButHasIssues = hasErrors || hasWarnings;
        debug.push({
          timestamp: new Date().toISOString(),
          mode: 'report-only',
          errorCount: errors.length,
          warningCount: warnings.length,
        });
        summaryMessage = hasErrors
          ? `📋 REPORT: ${errors.length} error(s), ${warnings.length} warning(s) found (logged, not blocking)`
          : hasWarnings
            ? `📋 REPORT: ${warnings.length} warning(s) found (logged, not blocking)`
            : '📋 REPORT: All EMV tags valid';
        break;

      case 'strict':
      default:
        valid = !hasErrors;
        isValid = !hasErrors;
        validButHasIssues = false;
        summaryMessage = hasErrors
          ? `❌ ${errors.length} error(s) found`
          : hasWarnings
            ? `⚠️ ${warnings.length} warning(s) found`
            : '✅ All EMV tags valid and complete';
        break;
    }

    // 8. Build result
    const result = {
      valid,
      isValid,
      validButHasIssues,
      errors,
      warnings,
      info,
      debug,
      context,
      summary: summaryMessage,
      mode: mode,
      request: {
        emvTags,
        entryMode,
        serviceCode,
        options,
      },
      tagAnalysis: {
        total: Object.keys(emvTags).length,
        required: requirements.required.length,
        present: requirements.required.filter(t => emvTags[t]).length,
        missing: requirements.required.filter(t => !emvTags[t]),
        extra: Object.keys(emvTags).filter(t => !requirements.required.includes(t)),
      },
    };

    if (Object.keys(emvTags).length > 0) {
      result.cardType = this.determineCardType(emvTags);
    }

    return result;
  }

  /**
   * Parse 9F27 (Cryptogram Information Data) per EMV Book 3 bit definitions
   * FIXED: Properly handles all 9F27 values including AAR and action codes
   * @param {string} value - 2 hex char value (e.g. '80', '40', '00', '81', '8A', 'C0', 'C1')
   * @returns {Object|null} Parsed CID info or null if invalid
   */
  static parseCryptogramInfoData(value) {
    if (!value || !/^[0-9A-Fa-f]{2}$/.test(value)) return null;

    const byte = parseInt(value, 16);
    // Bits 8-7: Cryptogram type (shift right 6)
    const cryptoBits = (byte >> 6) & 0x03;
    // Bit 4: Advice required (bit position 4, value 0x08)
    const adviceRequired = (byte & 0x08) !== 0;
    // Bits 3-1: Action code (mask 0x07)
    const actionCode = byte & 0x07;

    const typeInfo = CRYPTOGRAM_TYPE_MAP[cryptoBits];
    if (!typeInfo) return null;

    return {
      name: typeInfo.name,
      type: typeInfo.type,
      description: typeInfo.description,
      approved: typeInfo.approved,
      adviceRequired: adviceRequired,
      actionCode: actionCode,
      actionCodeDescription: CID_ACTION_CODE_MAP[actionCode] || 'Reserved',
      rawValue: value.toUpperCase(),
      rawByte: byte,
    };
  }

  static _validateCryptogramTag(emvTags, requirements, errors, warnings, context) {
    const cryptogram = emvTags['9F27'] || '';

    if (!cryptogram) {
      if (context.isChip || context.isContactless) {
        errors.push({
          field: 'tag.9F27',
          code: 'MISSING_CRYPTOGRAM',
          message: '9F27 (Cryptogram) is REQUIRED for chip/contactless transactions',
          severity: 'error',
        });
      }
      return;
    }

    const cidInfo = this.parseCryptogramInfoData(cryptogram);
    if (!cidInfo) {
      errors.push({
        field: 'tag.9F27',
        code: 'INVALID_CID_FORMAT',
        message: `Invalid 9F27 value: "${cryptogram}". Expected 2 hex chars (1 byte).`,
        severity: 'error',
      });
      return;
    }

    // AAC — offline decline: ALWAYS block, regardless of entry mode or advice flag
    if (cidInfo.name === 'AAC') {
      errors.push({
        field: 'tag.9F27',
        code: 'AAC_OFFLINE_DECLINE',
        message: `AAC (${cryptogram}) detected — offline decline. Transaction BLOCKED immediately. ${cidInfo.description}`,
        severity: 'error',
        cidInfo: cidInfo,
      });
      return;
    }

    // Chip with TC (offline approve) — warn that issuer may require online
    if (context.isChip && cidInfo.name === 'TC') {
      warnings.push({
        field: 'tag.9F27',
        code: 'CHIP_OFFLINE_TC',
        message: `Chip transaction with TC (${cryptogram}). Offline approved by card. Issuer may require online authorization.`,
        severity: 'warning',
      });
    }

    // Contactless with AAR — online decline by issuer
    if (context.isContactless && cidInfo.name === 'AAR') {
      warnings.push({
        field: 'tag.9F27',
        code: 'CONTACTLESS_AAR_RECEIVED',
        message: `Contactless transaction received AAR (${cryptogram}). Issuer declined online, advice may follow.`,
        severity: 'warning',
      });
    }

    // AAR — online decline (issuer responded decline but advice is needed)
    if (cidInfo.name === 'AAR') {
      warnings.push({
        field: 'tag.9F27',
        code: 'AAR_ONLINE_DECLINE',
        message: `AAR (${cryptogram}) indicates online decline by issuer with advice required. Terminal should send advice message.`,
        severity: 'warning',
      });
    }

    // Advice required flag
    if (cidInfo.adviceRequired) {
      warnings.push({
        field: 'tag.9F27',
        code: 'ADVICE_REQUIRED',
        message: `9F27 (${cryptogram}): Advice required flag set. Terminal expects an advice message after authorization.`,
        severity: 'warning',
      });
    }

    // Non-zero action code
    if (cidInfo.actionCode > 0) {
      warnings.push({
        field: 'tag.9F27',
        code: 'CID_ACTION_CODE',
        message: `9F27 (${cryptogram}): Action code ${cidInfo.actionCode} — ${cidInfo.actionCodeDescription}.`,
        severity: 'warning',
      });
    }
  }

  static _validateTVR(emvTags, errors, warnings, context) {
    const tvr = emvTags['95'] || '';
    if (!tvr) {
      if (context.isChip || context.isContactless) {
        warnings.push({
          field: 'tag.95',
          code: 'MISSING_TVR',
          message: 'TVR (95) missing - issuer may not verify terminal authentication',
          severity: 'warning',
        });
      }
      return;
    }

    if (tvr.length !== 10) {
      errors.push({
        field: 'tag.95',
        code: 'INVALID_TVR_LENGTH',
        message: `TVR must be 10 hex characters, got ${tvr.length}`,
        severity: 'error',
        expected: 10,
        actual: tvr.length,
      });
      return;
    }

    const byte1 = tvr.substring(0, 2);
    const byte3 = tvr.substring(4, 6);

    const byte1Num = parseInt(byte1, 16);
    if (byte1Num & 0x08) {
      errors.push({
        field: 'tag.95',
        code: 'DDA_FAILED',
        message: 'Offline Data Authentication (DDA) FAILED. Card may be cloned or terminal keys expired.',
        severity: 'error',
        tvr: tvr,
      });
    }

    if (byte1Num & 0x10) {
      errors.push({
        field: 'tag.95',
        code: 'PIN_VERIFICATION_FAILED',
        message: 'Offline PIN Verification FAILED. Card requires PIN and it was not entered correctly.',
        severity: 'error',
        tvr: tvr,
      });
    }

    const byte3Num = parseInt(byte3, 16);
    if (byte3Num & 0x02) {
      warnings.push({
        field: 'tag.95',
        code: 'EXCEPTION_FILE_HIT',
        message: 'Card is in Exception File. This may trigger issuer decline.',
        severity: 'warning',
        tvr: tvr,
      });
    }

    if (byte3Num & 0x10) {
      warnings.push({
        field: 'tag.95',
        code: 'EXCEEDS_FLOOR_LIMIT',
        message: 'Transaction amount exceeds terminal floor limit. Will require online authorization.',
        severity: 'warning',
        tvr: tvr,
      });
    }

    if (context.isContactless) {
      if (byte1 === '00' && byte3 === '00') {
        warnings.push({
          field: 'tag.95',
          code: 'CONTACTLESS_TVR_SUSPICIOUS',
          message: 'Contactless TVR shows no terminal checks performed. This is suspicious.',
          severity: 'warning',
        });
      }
    }

    if (context.isFallback) {
      if (byte1 === '00') {
        warnings.push({
          field: 'tag.95',
          code: 'FALLBACK_NO_CHIP_ATTEMPT',
          message: 'Fallback TVR shows no chip read attempt. This may be mislabeled.',
          severity: 'warning',
        });
      }
    }
  }

  static _validatePINRequirement(emvTags, serviceCode, errors, warnings, context) {
    const pinReq = SERVICE_CODE_PIN_REQUIREMENTS[serviceCode];
    if (!pinReq) {
      warnings.push({
        field: 'serviceCode',
        code: 'UNKNOWN_SERVICE_CODE',
        message: `Unknown service code: ${serviceCode}. Assuming PIN required for security.`,
        severity: 'warning',
      });
      return;
    }

    const cvmList = emvTags['8E'] || '';
    const pinCvmCodes = ['02', '03', '04', '05', '06', '41', '42', '5F', '5E'];

    if (pinReq.pinRequired) {
      let hasPinCvm = false;
      for (const code of pinCvmCodes) {
        if (cvmList.includes(code)) {
          hasPinCvm = true;
          break;
        }
      }

      if (!hasPinCvm && cvmList) {
        warnings.push({
          field: 'tag.8E',
          code: 'PIN_REQUIRED_NO_PIN_CVM',
          message: `Service Code ${serviceCode} requires PIN, but CVM list (8E) does not contain PIN CVM codes. CVM: ${cvmList}`,
          severity: 'warning',
        });
      }
    }
  }

  static _validateContactlessTags(emvTags, errors, warnings, context, info) {
    if (!context.isContactless && !context.isContactlessMag) return;

    const formFactor = emvTags['9F6E'];
    if (formFactor) {
      if (formFactor.length !== 8) {
        errors.push({
          field: 'tag.9F6E',
          code: 'INVALID_FORM_FACTOR_LENGTH',
          message: `9F6E must be 8 hex chars, got ${formFactor.length}`,
          severity: 'error',
          expected: 8,
          actual: formFactor.length,
        });
      }

      const ffByte = formFactor.substring(0, 2);
      const deviceTypeMap = {
        '00': 'Card',
        '01': 'Mobile Phone (MNO controlled)',
        '02': 'Key Fob',
        '03': 'Watch',
        '04': 'Mobile Tag',
        '05': 'Wristband',
        '06': 'Mobile Phone Case',
        '07': 'Mobile Phone (fixed SE, MNO controlled)',
        '08': 'Removable SE (Memory Card)',
        '09': 'Mobile Phone (fixed SE, not MNO)',
        '0A': 'Tablet/eBook (MNO controlled removable)',
        '0B': 'Tablet/eBook (fixed SE, MNO controlled)',
        '0C': 'Removable SE (Tablet/eBook)',
        '0D': 'Tablet/eBook (fixed SE, not MNO)',
        '0E': 'Mobile Phone (host processor)',
        '0F': 'Tablet/eBook (host processor)',
        '10': 'Mobile Phone (TEE)',
        '11': 'Tablet/eBook (TEE)',
        '12': 'Watch (TEE)',
        '13': 'Watch (host processor)',
      };

      const deviceType = deviceTypeMap[ffByte] || 'Unknown';
      info.push({
        field: 'tag.9F6E',
        code: 'DEVICE_TYPE',
        message: `Form Factor Device Type: ${deviceType} (${ffByte})`,
        severity: 'info',
      });
    } else {
      errors.push({
        field: 'tag.9F6E',
        code: 'MISSING_FORM_FACTOR',
        message: '9F6E (Form Factor Indicator) is REQUIRED for contactless transactions',
        severity: 'error',
      });
    }

    const iccDynamic = emvTags['9F4C'];
    if (!iccDynamic && context.isContactless && !context.isDigitalWallet) {
      errors.push({
        field: 'tag.9F4C',
        code: 'MISSING_ICC_DYNAMIC',
        message: '9F4C (ICC Dynamic Number) is REQUIRED for contactless transactions',
        severity: 'error',
      });
    }
  }

  static _validateCVMList(emvTags, serviceCode, errors, warnings, context, info) {
    const cvmList = emvTags['8E'] || '';
    if (!cvmList) {
      if (context.isChip || context.isContactless) {
        warnings.push({
          field: 'tag.8E',
          code: 'MISSING_CVM_LIST',
          message: '8E (CVM List) missing - issuer may not know cardholder verification methods',
          severity: 'warning',
        });
      }
      return;
    }

    if (cvmList.length < 2) {
      errors.push({
        field: 'tag.8E',
        code: 'INVALID_CVM_LENGTH',
        message: '8E too short to contain valid CVM list',
        severity: 'error',
      });
      return;
    }

    const cvmLength = parseInt(cvmList.substring(0, 2), 16);
    const cvmData = cvmList.substring(2);

    if (cvmData.length < cvmLength * 2) {
      warnings.push({
        field: 'tag.8E',
        code: 'CVM_DATA_TRUNCATED',
        message: 'CVM data length mismatch. Expected more data.',
        severity: 'warning',
      });
    }

    const cvmEntries = [];
    for (let i = 0; i < Math.min(cvmData.length, 20); i += 4) {
      if (i + 4 <= cvmData.length) {
        const entry = cvmData.substring(i, i + 4);
        const cvmCode = entry.substring(0, 2);
        const cvmCondition = entry.substring(2, 4);
        const cvmInfo = CVM_CODES[cvmCode] || { name: 'Unknown', type: 'unknown' };
        cvmEntries.push({
          code: cvmCode,
          condition: cvmCondition,
          name: cvmInfo.name,
          type: cvmInfo.type,
        });
      }
    }

    const hasPin = cvmEntries.some(e => e.type === 'pin' || e.type === 'pin_online' || e.type === 'pin_offline');

    const pinReq = SERVICE_CODE_PIN_REQUIREMENTS[serviceCode];
    if (pinReq && pinReq.pinRequired && !hasPin) {
      if (context.isContactless) {
        warnings.push({
          field: 'tag.8E',
          code: 'NO_PIN_IN_CVM_LIST_CONTACTLESS',
          message: `Service Code ${serviceCode} requires PIN, but CVM list has no PIN method (contactless — may use signature or no CVM). CVM entries: ${cvmEntries.map(e => e.code + ':' + e.name).join(', ')}`,
          severity: 'warning',
        });
      } else {
        errors.push({
          field: 'tag.8E',
          code: 'NO_PIN_IN_CVM_LIST',
          message: `Service Code ${serviceCode} requires PIN, but CVM list has no PIN method. CVM entries: ${cvmEntries.map(e => e.code + ':' + e.name).join(', ')}`,
          severity: 'error',
        });
      }
    }

    info.push({
      field: 'tag.8E',
      code: 'CVM_ANALYSIS',
      message: `CVM Methods: ${cvmEntries.map(e => e.name).join(', ')}`,
      severity: 'info',
      cvmEntries: cvmEntries,
    });
  }

  static _validateAIDConsistency(emvTags, errors, warnings) {
    const aid = emvTags['4F'] || '';
    const label = emvTags['50'] || '';

    if (!aid || !label) return;

    const visaAIDs = ['A0000000031010', 'A000000003101', 'A00000000310'];
    const mastercardAIDs = ['A0000000041010', 'A000000004101', 'A00000000410'];
    const amexAIDs = ['A00000002501', 'A000000025'];

    let expectedBrand = '';
    if (visaAIDs.some(v => aid.includes(v) || v.includes(aid))) {
      expectedBrand = 'VISA';
    } else if (mastercardAIDs.some(v => aid.includes(v) || v.includes(aid))) {
      expectedBrand = 'MASTERCARD';
    } else if (amexAIDs.some(v => aid.includes(v) || v.includes(aid))) {
      expectedBrand = 'AMERICAN EXPRESS';
    }

    if (expectedBrand && label) {
      const upperLabel = label.toUpperCase();
      if (!upperLabel.includes(expectedBrand) && !upperLabel.includes('DEBIT') && !upperLabel.includes('CREDIT')) {
        warnings.push({
          field: 'tag.50',
          code: 'AID_LABEL_MISMATCH',
          message: `AID ${aid} suggests ${expectedBrand}, but Application Label is "${label}"`,
          severity: 'warning',
        });
      }
    }
  }

  static _validateATC(emvTags, errors, warnings) {
    const atc = emvTags['9F36'] || '';
    if (!atc) {
      if (emvTags['9F27']) {
        warnings.push({
          field: 'tag.9F36',
          code: 'MISSING_ATC',
          message: '9F36 (ATC) missing - may affect cryptogram validation',
          severity: 'warning',
        });
      }
      return;
    }

    if (atc.length !== 4) {
      errors.push({
        field: 'tag.9F36',
        code: 'INVALID_ATC_LENGTH',
        message: `ATC must be 4 hex chars, got ${atc.length}`,
        severity: 'error',
        expected: 4,
        actual: atc.length,
      });
      return;
    }

    const atcNum = parseInt(atc, 16);
    if (atcNum < 1 || atcNum > 65535) {
      errors.push({
        field: 'tag.9F36',
        code: 'INVALID_ATC_VALUE',
        message: `ATC must be between 1 and 65535, got ${atcNum}`,
        severity: 'error',
      });
    }
  }

  static _validateAmount(emvTags, amountInCents, errors, warnings) {
    const amountTag = emvTags['9F02'] || '';
    if (!amountTag) {
      errors.push({
        field: 'tag.9F02',
        code: 'MISSING_AMOUNT',
        message: '9F02 (Amount, Authorized) is MISSING. Transaction BLOCKED.',
        severity: 'error',
      });
      return;
    }

    if (amountTag.length !== 12) {
      errors.push({
        field: 'tag.9F02',
        code: 'INVALID_AMOUNT_LENGTH',
        message: `9F02 must be 12 digits, got ${amountTag.length}`,
        severity: 'error',
        expected: 12,
        actual: amountTag.length,
      });
      return;
    }

    const emvAmount = parseInt(amountTag, 10);
    const requestAmount = parseInt(amountInCents, 10);
    if (isNaN(emvAmount) || isNaN(requestAmount)) {
      errors.push({
        field: 'tag.9F02',
        code: 'AMOUNT_MISMATCH',
        message: `Amount validation failed: cannot parse 9F02="${amountTag}" or requestAmount="${amountInCents}". Transaction BLOCKED.`,
        severity: 'error',
      });
      return;
    }
    if (emvAmount !== requestAmount) {
      errors.push({
        field: 'tag.9F02',
        code: 'AMOUNT_MISMATCH',
        message: `Amount tampering detected: 9F02=${emvAmount} cents does not match request amount=${requestAmount} cents. Transaction BLOCKED.`,
        severity: 'error',
        emvAmount: emvAmount,
        requestAmount: requestAmount,
      });
    }
  }

  static generateSummary(valid, errors, warnings) {
    if (valid && warnings.length === 0) {
      return 'All EMV tags valid and complete';
    }
    if (valid && warnings.length > 0) {
      return `${warnings.length} warning(s) found`;
    }
    return `${errors.length} error(s) found`;
  }

  /**
   * Determine card type from EMV tags for ISO message storage
   * Valid return values: '00' (General), 'C0' (Credit), 'P0' (Debit)
   * @param {Object} emvTags - Normalized key-value object of EMV tags
   * @returns {string} Card type code: 'C0', 'P0', or '00'
   */
  static determineCardType(emvTags) {
    if (!emvTags) return '00';

    // Priority 1: Application Label (tag 50) - ASCII text often contains "DEBIT" or "CREDIT"
    const labelHex = emvTags['50'];
    if (labelHex) {
      let asciiLabel = '';
      for (let i = 0; i < labelHex.length; i += 2) {
        asciiLabel += String.fromCharCode(parseInt(labelHex.substring(i, i + 2), 16));
      }
      const upper = asciiLabel.toUpperCase();

      if (upper.includes('DEBIT') || upper.includes('DÉBITO') || upper.includes('DEBITO')) {
        return 'P0';
      }
      if (upper.includes('CREDIT') || upper.includes('CRÉDITO') || upper.includes('CREDITO')) {
        return 'C0';
      }
    }

    // Priority 2: AID (tag 4F) - known debit/credit AIDs
    const aid = emvTags['4F'];
    if (aid) {
      const upperAid = aid.toUpperCase();

      const debitAIDs = [
        'A0000000032010', 'A0000000032200', 'A0000000032300', 'A0000000032400',
        'A0000000042200', 'A0000000042010', 'A0000000043060',
      ];
      const creditAIDs = [
        'A0000000031010',
        'A0000000041010',
      ];

      if (debitAIDs.includes(upperAid)) {
        return 'P0';
      }
      if (creditAIDs.includes(upperAid)) {
        return 'C0';
      }
    }

    // Priority 3: Application Preferred Name (tag 9F12) - ASCII text
    const prefNameHex = emvTags['9F12'];
    if (prefNameHex) {
      let asciiName = '';
      for (let i = 0; i < prefNameHex.length; i += 2) {
        asciiName += String.fromCharCode(parseInt(prefNameHex.substring(i, i + 2), 16));
      }
      const upper = asciiName.toUpperCase();

      if (upper.includes('DEBIT') || upper.includes('DÉBITO') || upper.includes('DEBITO')) {
        return 'P0';
      }
      if (upper.includes('CREDIT') || upper.includes('CRÉDITO') || upper.includes('CREDITO')) {
        return 'C0';
      }
    }

    // Default: General
    return '00';
  }
}

module.exports = EMVTagValidator;
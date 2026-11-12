// lib/socketServer/lib/services/tx.service.pro.js
/**
 * @fileoverview Transaction Service Pro - Advanced Payment Processing
 *
 * Production-grade transaction service with comprehensive features including
 * S3 logging, transaction context management, multi-processor routing,
 * and enhanced security controls. This is the recommended service for
 * new implementations.
 *
 * @module tx.service.pro
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Req 3.4: PAN protection with mandatory decryption and masking
 * - Req 3.5: Cryptographic key management (3DES, AWS KMS)
 * - Req 4.2: Encrypted transmission over TLS
 * - Req 6.5.1: Input validation with TransactionContext
 * - Req 6.5.3: Secure cryptographic implementation
 * - Req 8.2: Authentication data protection
 * - Req 10.2: Complete audit trail with S3 logging
 * - Req 10.3: Detailed audit records (timestamp, user, event)
 * - Req 10.5: Audit logs protected from modification (S3 immutability)
 *
 * Enhanced Security Features:
 * - Mandatory PAN decryption for all transactions
 * - S3-based transaction logging with encryption at rest
 * - TransactionContext for strict amount validation (cents only)
 * - Enhanced error handling and reversal logic
 * - Message type detection for reversals/cancellations
 * - Comprehensive transaction lifecycle tracking
 * - Amount format validation (prevents dollar/cents confusion)
 *
 * @author Payment Gateway Team
 * @version 2.0.0
 */
/*
┌─────────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATION                                │
│  (E-commerce, POS, Mobile App, etc.)                                │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ JSON Request (REST API)
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                                    │
│  - Route: /payment/process                                          │
│  - Middleware: merchant validation                                  │
│  - Headers: commerce-id, commerce-name, etc.                        │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ Validated Request + Merchant Data
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TX SERVICE PRO (This File)                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. REQUEST PARSER                                          │    │
│  │    - Extract headers & body                                │    │
│  │    - Validate transaction data                             │    │
│  │    - Generate unique GUID for tracking                     │    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 2. MERCHANT LOADER                                         │    │
│  │    - Load merchant from DB using commerce-id/name         │    │
│  │    - Load all relationships (processor, bank, MCC, etc.)  │    │
│  │    - Set fallback defaults if data missing                │    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 3. BIN LOOKUP & PROCESSOR ROUTING                          │    │
│  │    - Extract BIN from card number                          │    │
│  │    - Look up BIN in database                               │    │
│  │    - Determine target processor based on:                  │    │
│  │      • BIN processor assignment                            │    │
│  │      • Merchant processor                                  │    │
│  │      • Transaction type                                    │    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 4. ISO8583 CONVERSION                                      │    │
│  │    - Convert JSON to ISO8583 message                       │    │
│  │    - Handle track2 data (encrypted/plaintext)              │    │
│  │    - Apply field formatting per spec                       │    │
│  │    - Add merchant/processor specific data                  │    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 5. ROUTING DECISION                                        │    │
│  │    - Based on processor ID and FIID:                       │    │
│  │      • Prosa (TCP/TLS)                                     │    │
│  │      • Amex (TCP/TLS)                                      │    │
│  │      • Banregio (HTTP)                                     │    │
│  │      • Selia (Special API)                                 │    │
│  │      • Broxel (HTTP)                                       │    │
│  │      • Banorte (API)                                       │    │
│  │      • PayCIPS (API)                                       │    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 6. PROCESSOR EXECUTION                                     │    │
│  │    ├─ ISO8583 Processors ───────────────────────────────┤    │
│  │    │  • Open TCP/TLS connection to switch               │    │
│  │    │  • Send ISO message                                │    │
│  │    │  • Wait for response                               │    │
│  │    │  • Parse response                                  │    │
│  │    └────────────────────────────────────────────────────┘    │
│  │    ├─ API Processors ───────────────────────────────────┤    │
│  │    │  • Call REST/SOAP API                              │    │
│  │    │  • Convert response to ISO format                  │    │
│  │    └────────────────────────────────────────────────────┘    │
│  │    ├─ Selia Processor (Special) ────────────────────────┤    │
│  │    │  • Handle e-commerce specific logic               │    │
│  │    │  • Direct ISO-to-API conversion                   │    │
│  │    └────────────────────────────────────────────────────┘    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 7. RESPONSE HANDLING                                       │    │
│  │    - Convert ISO response back to JSON                    │    │
│  │    - Update transaction status                            │    │
│  │    - Save to database (iso_message table)                │    │
│  │    - Log API call                                         │    │
│  │    - Send response to client                              │    │
│  └──────────────┬─────────────────────────────────────────────┘    │
│                 │                                                    │
│  ┌──────────────▼─────────────────────────────────────────────┐    │
│  │ 8. CLEANUP & LOGGING                                       │    │
│  │    - Handle client disconnections                          │    │
│  │    - Log timing metrics                                    │    │
│  │    - Clean up resources                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
*/
const pool = require("../database");
var helpers = require("../../../helpers/lib/helpers");
const Translator = require("../../../Translator");
const { rechazarTx, jsonRechazo } = require("../lib/txHelpers");
const db = require("../sequelize/init");
const { v4: uuidv4 } = require("uuid");
const helpersSec = require("../../lib/lib/helpers");
const _ = require("lodash");
const AWS = require("aws-sdk");
const fs = require("fs").promises;
const path = require("path");

let output = {};
var hexFields = [52, 55];
var hastimeOut = false;

var guid = uuidv4();

/**
 * Map database operation ID to transaction type string for isoSeliaService
 */
function mapTransactionType(id_operation, msgType, req) {
  const mti = String(msgType).padStart(4, "0");

  // 🔴 HIGHEST PRIORITY: Check req.body.operation if available
  if (req && req.body && req.body.operation) {
    const operationStr = String(req.body.operation).toLowerCase();
    const stringOpMap = {
      checkin: "checkin",
      check_in: "checkin",
      soloautoriza: "checkin",
      checkout: "checkout",
      check_out: "checkout",
      reauthorize: "reauthorize",
      reauth: "reauthorize",
      charge: "charge",
      sale: "charge",
      refund: "refund",
      devolucion: "refund",
      cancel: "cancel",
      void: "cancel",
      reverse: "cancel",
    };
    if (stringOpMap[operationStr]) {
      console.log(
        `[mapTransactionType] 🔥 Mapped req.body.operation "${operationStr}" -> "${stringOpMap[operationStr]}"`,
      );
      return stringOpMap[operationStr];
    }
  }

  // Check for reversal/cancel based on message type
  if (mti === "0420" || mti === "0220" || mti === "0230") {
    return "cancel";
  }

  // 🔴 CORRECTED MAPPING based on your ciso_operation table
  const typeMap = {
    4: "charge", // VENTA
    5: "charge", // VENTA CON CASH BACK
    6: "cancel", // CANCELACION
    7: "refund", // DEVOLUCION
    8: "tip", // POS-PROPINA
    9: "closeTip", // CIERRE POS-PROPINA
    10: "checkin", // CHECK IN
    11: "reauthorize", // REAUTORIZACION
    12: "checkout", // CHECK OUT
    16: "cancel", // REVERSO
  };

  const mapped = typeMap[id_operation];
  console.log(
    `[mapTransactionType] id_operation: ${id_operation} -> ${mapped || "charge (default)"}`,
  );
  return mapped || "charge";
}

// ======================================================
// 🎯 S3 LOGGING FUNCTIONS
// ======================================================

// In-memory store for transaction logs to aggregate events before uploading to S3
const transactionLogs = new Map();

/**
 * Store transaction event to S3 bucket
 * @param {string} transactionId - Unique transaction identifier
 * @param {string} eventType - Type of event (API_REQUEST, SELIA_REQUEST, SELIA_RESPONSE)
 * @param {object} data - Data to store
 * @returns {Promise<boolean>} - Success status
 */
async function storeTransactionEventToS3(transactionId, eventType, data) {
  try {
    // Initialize or update transaction log aggregation
    if (!transactionLogs.has(transactionId)) {
      transactionLogs.set(transactionId, {
        transactionId: transactionId,
        startTime: new Date().toISOString(),
        events: {},
      });
    }

    const logEntry = transactionLogs.get(transactionId);
    logEntry.events[eventType] = {
      timestamp: new Date().toISOString(),
      data: data,
    };

    // If this is the final event (SELIA_RESPONSE) or a terminal event, upload the full log
    // Note: In some error paths, we might want to upload what we have so far.
    if (eventType === "SELIA_RESPONSE") {
      await uploadFullLogToS3(transactionId);
    }

    return true;
  } catch (error) {
    console.error(
      `[S3 Logger] ❌ Failed to process ${eventType} for S3:`,
      error.message,
    );
    return false;
  }
}

/**
 * Upload the aggregated log for a transaction to S3
 * @param {string} transactionId
 */
async function uploadFullLogToS3(transactionId) {
  try {
    const logData = transactionLogs.get(transactionId);
    if (!logData) return;

    // Validate required environment variables
    if (!process.env.APP_CACHE_S3_BUCKET) {
      console.error(
        "[S3 Logger] ❌ Missing APP_CACHE_S3_BUCKET environment variable",
      );
      return false;
    }

    const bucketName = process.env.APP_CACHE_S3_BUCKET;
    const bucketRegion =
      process.env.APP_CACHE_BUCKET_REGION ||
      process.env.APP_CACHE_AWS_REGION ||
      "us-east-1";

    // Initialize S3 client
    const s3 = new AWS.S3({
      region: bucketRegion,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    });

    // Create filename - now just one file per transaction
    const fileName = `${transactionId}/transaction_full_log.json`;

    // Helper to handle circular references safely
    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      };
    };

    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: JSON.stringify(logData, getCircularReplacer(), 2),
      ContentType: "application/json",
      Metadata: {
        transactionId: transactionId,
        timestamp: new Date().toISOString(),
      },
    };

    await s3.upload(params).promise();
    console.log(
      `[S3 Logger] ✅ Successfully stored COMPLETE log to S3: ${transactionId}`,
    );

    // Clean up memory
    transactionLogs.delete(transactionId);
    return true;
  } catch (error) {
    console.error(
      `[S3 Logger] ❌ Failed to upload full log to S3:`,
      error.message,
    );
    return false;
  }
}

/**
 * Store API request (Event 1)
 * @param {string} transactionId - Transaction GUID
 * @param {object} req - Express request object
 * @param {object} parsedJson - Parsed JSON data
 */
async function logApiRequest(transactionId, req, parsedJson) {
  try {
    // Deep clone the body/headers to avoid keeping references to the req object
    // and avoid circular reference issues in the log map itself
    const safeBody = req.originalBody
      ? _.cloneDeep(req.originalBody)
      : _.cloneDeep(req.body);
    const safeHeaders = _.cloneDeep(req.headers);
    const safeParsedJson = _.cloneDeep(parsedJson);

    const logData = {
      transactionId: transactionId,
      timestamp: new Date().toISOString(),
      endpoint: req.originalUrl,
      method: req.method,
      headers: safeHeaders,
      originalBody: safeBody,
      parsedJson: safeParsedJson,
      merchantInfo: {
        id: req.merchantData?.id_merchant,
        name: req.merchantData?.name_merchant,
        affiliation: req.merchantData?.afiliation_number,
      },
      cardInfo: {
        bin: req.body?.cardInformation?.bin,
        last4: req.body?.cardInformation?.last4,
        hasTrack2: !!(req.body?.tk2 || req.body?.cardInformation?.track2),
      },
    };

    await storeTransactionEventToS3(transactionId, "API_REQUEST", logData);
  } catch (error) {
    console.error(`[S3 Logger] ❌ Failed to log API request:`, error.message);
  }
}

/**
 * Store SELIA request (Event 2)
 * @param {string} transactionId - Transaction GUID
 * @param {object} isoMessage - ISO 8583 message
 * @param {object} parsedFields - Parsed ISO fields
 * @param {object} merchantData - Merchant data
 * @param {object} binDataInfo - BIN information
 */
async function logSeliaRequest(
  transactionId,
  isoMessage,
  parsedFields,
  merchantData,
  binDataInfo,
) {
  try {
    const logData = {
      transactionId: transactionId,
      timestamp: new Date().toISOString(),
      event: "SELIA_REQUEST",
      isoMessageRaw: isoMessage?.toString("utf8") || isoMessage,
      parsedFields: parsedFields,
      merchantInfo: {
        id: merchantData?.id_merchant,
        name: merchantData?.name_merchant,
        affiliation: merchantData?.afiliation_number,
        processor: merchantData?.procesador?.fiid,
        acquirer: merchantData?.banco_adq?.fiid,
      },
      binInfo: binDataInfo,
      keyFields: {
        field2: parsedFields[2] ? "Present (masked)" : "Missing",
        field3: parsedFields[3] || "Missing",
        field4: parsedFields[4] || "Missing",
        field7: parsedFields[7] || "Missing",
        field11: parsedFields[11] || "Missing",
        field22: parsedFields[22] || "Missing",
        field35: parsedFields[35] ? "Present (masked)" : "Missing",
        field48: parsedFields[48] || "Missing",
        field60: parsedFields[60] || "Missing",
        field125: parsedFields[125] || "Missing",
      },
    };

    await storeTransactionEventToS3(transactionId, "SELIA_REQUEST", logData);
  } catch (error) {
    console.error(
      `[S3 Logger] ❌ Failed to log SELIA request:`,
      logError.message,
    );
  }
}

/**
 * Store SELIA response (Event 3)
 * @param {string} transactionId - Transaction GUID
 * @param {object} responseData - Response from SELIA
 * @param {object} prosaResponse - Response from PROSA
 * @param {object} parsedResponse - Parsed ISO response
 */
async function logSeliaResponse(
  transactionId,
  responseData,
  prosaResponse,
  parsedResponse,
) {
  try {
    // Use cloneDeep to avoid keeping references to complex objects
    const safeResponseData = _.cloneDeep(responseData);
    const safeProsaResponse = _.cloneDeep(prosaResponse);
    const safeParsedResponse = _.cloneDeep(parsedResponse);

    const logData = {
      transactionId: transactionId,
      timestamp: new Date().toISOString(),
      event: "SELIA_RESPONSE",
      seliaResponse: safeResponseData,
      prosaResponse: safeProsaResponse,
      parsedIsoResponse: safeParsedResponse,
      responseSummary: {
        success: responseData?.ok || false,
        responseCode:
          responseData?.out?.response_code ||
          responseData?.out?.resp_code ||
          "99",
        authorization: responseData?.dataRes?.authorizationCode,
        referenceNumber: responseData?.dataRes?.referenceNumber,
        message:
          responseData?.dataRes?.responseMessage ||
          responseData?.out?.description,
      },
      rawData: {
        seliaRaw:
          typeof responseData === "string"
            ? responseData
            : JSON.stringify(responseData, (key, value) =>
                typeof value === "object" &&
                value !== null &&
                value.constructor?.name === "Socket"
                  ? "[Socket]"
                  : value,
              ),
        prosaRaw:
          typeof prosaResponse === "string"
            ? prosaResponse
            : JSON.stringify(prosaResponse, (key, value) =>
                typeof value === "object" &&
                value !== null &&
                value.constructor?.name === "Socket"
                  ? "[Socket]"
                  : value,
              ),
      },
    };

    await storeTransactionEventToS3(transactionId, "SELIA_RESPONSE", logData);
  } catch (error) {
    console.error(
      `[S3 Logger] ❌ Failed to log SELIA response:`,
      logError.message,
    );
  }
}

/**
 * Force upload of current transaction logs to S3 (use for error paths)
 * @param {string} transactionId
 */
async function forceUploadLogs(transactionId) {
  console.log(
    `[S3 Logger] ⚠️ Force uploading logs for transaction ${transactionId}`,
  );
  return await uploadFullLogToS3(transactionId);
}

// ======================================================
// 🎯 EXISTING CODE CONTINUES (with S3 logging integration)
// ======================================================

/**
 * Normalize track2 data by ensuring '=' separator instead of 'D'
 */
function normalizeTrack2Separator(track2Data) {
  if (!track2Data || typeof track2Data !== "string") {
    return track2Data;
  }

  const trimmed = track2Data.trim();

  // IMPORTANT:
  // - For AWS KMS encrypted Track2 (base64, usually starts with "AQICA"), we MUST NOT replace characters.
  // - Only normalize clear track2 in numeric format: PAN + ('D' or '=') + more digits.
  const looksLikeClearTrack2 = /^[0-9]{12,19}[=D][0-9]{6,}$/i.test(trimmed);
  if (!looksLikeClearTrack2) {
    return track2Data;
  }

  const normalized = trimmed.replace(/D/g, "=");
  if (trimmed !== normalized) {
    console.log(
      `[tx.service.pro.js] 🔧 Normalized track2 separator: "${trimmed.substring(0, 30)}..." -> "${normalized.substring(0, 30)}..."`,
    );
  }
  return normalized;
}

const originalProcessMerchantData = helpers.processMerchantData;
helpers.processMerchantData = function (data_send) {
  console.log("[tx.service.pro.js] === PATCHED processMerchantData called ===");

  if (!data_send || !data_send.merchant_data) {
    console.log(
      "[tx.service.pro.js] WARNING: No merchant_data found in data_send",
    );
    return {};
  }

  const r = JSON.parse(JSON.stringify(data_send.merchant_data));

  if (!r.iso_client_dt) {
    console.log(
      "[tx.service.pro.js] WARNING: iso_client_dt not found, creating fallback",
    );
    r.iso_client_dt = {
      name: r.name_merchant || r.razon_social || "Unknown Client",
    };
  }

  r.client_data = {};
  r.client_data.name = r.iso_client_dt.name;

  if (r.estatus_f == "1") {
    r.estatus_f = "Pendiente";
  }
  if (r.estatus_f == "2") {
    r.estatus_f = "Por liquidar";
  }
  if (r.estatus_f == "3") {
    r.estatus_f = "Liquidado";
  }

  const fieldsToDelete = [
    "id_merchant",
    "razon_social",
    "url_merchant",
    "rfc_merchant",
    "representative",
    "agente_comercial",
    "description",
    "contact_merchant",
    "rol_contact",
    "email_contact",
    "tel1_contact",
    "tel2_contact",
    "mobile_contact",
    "use_moreterminals",
    "active",
    "token_activation",
    "cybersource",
    "serie_terminal",
    "max",
    "min",
    "last_update",
    "creation_date",
    "modo_transac",
    "url_destino",
    "banco_adq",
    "iso_client_dt",
    "deleted_at",
    "id_acqbank",
    "id_client",
    "id_datos_bancarios",
    "id_direccion",
    "id_esquema",
    "id_ln",
    "id_mcc",
    "id_modo_transaccion",
    "id_persona",
    "id_processor",
    "id_profile_transaction",
    "id_url_destino",
  ];

  fieldsToDelete.forEach((field) => {
    if (r.hasOwnProperty(field)) {
      delete r[field];
    }
  });

  console.log(
    "[tx.service.pro.js] === PATCHED processMerchantData completed successfully ===",
  );
  return r;
};

async function loadMerchantProcessorRelationship(merchantData) {
  console.log(
    "[tx.service.pro.js] === LOADING MERCHANT PROCESSOR RELATIONSHIP ===",
  );

  if (!merchantData.procesador && merchantData.id_processor) {
    console.log(
      "[tx.service.pro.js] 🔄 Loading processor for merchant:",
      merchantData.id_merchant,
    );
    try {
      const processor = await db.isoProcessor.findOne({
        where: { id_processor: merchantData.id_processor },
      });
      if (processor) {
        merchantData.procesador = processor;
        console.log(
          "[tx.service.pro.js] ✅ Processor loaded - FIID:",
          processor.fiid,
        );
      } else {
        console.log(
          "[tx.service.pro.js] ❌ Processor not found, using Broxel fallback",
        );
        merchantData.procesador = { fiid: "P468", name: "Broxel Fallback" };
      }
    } catch (error) {
      console.error("[tx.service.pro.js] Error loading processor:", error);
      merchantData.procesador = { fiid: "P468", name: "Broxel Emergency" };
    }
  } else if (merchantData.procesador) {
    console.log(
      "[tx.service.pro.js] ✅ Processor already loaded:",
      merchantData.procesador.fiid,
    );
  } else {
    console.log(
      "[tx.service.pro.js] ⚠️ No processor ID available, using default",
    );
    merchantData.procesador = { fiid: "P468", name: "Default Processor" };
  }
  return merchantData;
}

function getEnhancedBinDataInfo(bin, merchantData) {
  console.log("[tx.service.pro.js] 🔍 Enhanced BIN lookup for:", bin);
  let binObject = null;

  if (typeof binData !== "undefined" && binData && Array.isArray(binData)) {
    binObject = binData.find((binInfo) => binInfo.bin === bin);
    if (!binObject) {
      const shortBin = bin.slice(0, 6);
      binObject = binData.find((binInfo) => binInfo.bin === shortBin);
    }
  }

  if (binObject) {
    console.log("[tx.service.pro.js] ✅ BIN found in database:", binObject.bin);
    return binObject;
  } else {
    console.log(
      "[tx.service.pro.js] 🔄 BIN not found, creating enhanced fallback",
    );
    return {
      id_bin: 0,
      id_processor: merchantData.id_processor || 5,
      processor: merchantData.procesador?.fiid || "P468",
      bin: bin,
      bank: "INTERNACIONAL",
      product: "INTERNACIONAL",
      type: "GENERAL",
      brand:
        bin.substring(0, 1) === "4"
          ? "VISA"
          : bin.substring(0, 1) === "5"
            ? "MASTERCARD"
            : bin.substring(0, 1) === "3"
              ? "AMEX"
              : "GENERAL",
    };
  }
}

function getProcessorAssignment(binDataInfo, merchantData) {
  console.log("[tx.service.pro.js] === PROCESSOR ASSIGNMENT ===");
  console.log("[tx.service.pro.js] BIN Processor:", binDataInfo.id_processor);
  console.log(
    "[tx.service.pro.js] Merchant Processor:",
    merchantData.id_processor,
  );
  console.log(
    "[tx.service.pro.js] Merchant FIID:",
    merchantData.procesador?.fiid,
  );

  if (binDataInfo.id_processor && binDataInfo.id_processor !== null) {
    console.log(
      "[tx.service.pro.js] ✅ Using BIN processor:",
      binDataInfo.id_processor,
    );
    return {
      id_processor: binDataInfo.id_processor,
      fiid: binDataInfo.processor || "P468",
    };
  }

  if (merchantData.id_processor && merchantData.procesador) {
    console.log(
      "[tx.service.pro.js] ✅ Using merchant processor:",
      merchantData.id_processor,
    );
    return {
      id_processor: merchantData.id_processor,
      fiid: merchantData.procesador.fiid,
    };
  }

  console.log("[tx.service.pro.js] ⚠️ Using default processor (Broxel)");
  return {
    id_processor: 5,
    fiid: "P468",
  };
}

async function loadMerchantFromHeaders(commerce_id, commerce_name) {
  console.log("[tx.service.pro.js] === DIRECT MERCHANT LOOKUP ===");
  console.log("[tx.service.pro.js] Looking for merchant with:");
  console.log("[tx.service.pro.js] - Affiliation:", commerce_id);
  console.log("[tx.service.pro.js] - Name:", commerce_name);

  try {
    let merchant = await db.merchant.findOne({
      where: {
        afiliation_number: commerce_id,
        active: 1,
      },
    });

    if (merchant) {
      console.log(
        "[tx.service.pro.js] ✅ Merchant found by affiliation number:",
        merchant.name_merchant,
      );
      return merchant;
    }

    merchant = await db.merchant.findOne({
      where: {
        name_merchant: commerce_name,
        active: 1,
      },
    });

    if (merchant) {
      console.log(
        "[tx.service.pro.js] ✅ Merchant found by name:",
        merchant.name_merchant,
      );
      return merchant;
    }

    if (commerce_id && !isNaN(commerce_id)) {
      merchant = await db.merchant.findOne({
        where: {
          id_merchant: parseInt(commerce_id),
          active: 1,
        },
      });

      if (merchant) {
        console.log(
          "[tx.service.pro.js] ✅ Merchant found by ID:",
          merchant.name_merchant,
        );
        return merchant;
      }
    }

    console.log("[tx.service.pro.js] ❌ Merchant not found with any method");
    return null;
  } catch (error) {
    console.error("[tx.service.pro.js] Error in merchant lookup:", error);
    return null;
  }
}

async function loadMerchantRelationships(merchantData) {
  console.log("[tx.service.pro.js] === Loading merchant relationships ===");
  const relationships = [];

  if (merchantData.id_processor && !merchantData.procesador) {
    relationships.push(
      db.isoProcessor
        .findOne({ where: { id_processor: merchantData.id_processor } })
        .then((processor) => {
          merchantData.procesador = processor || { fiid: "DEFAULT_FIID" };
          console.log(
            "[tx.service.pro.js] Loaded processor - FIID:",
            merchantData.procesador.fiid,
          );
        }),
    );
  }

  if (merchantData.id_acqbank && !merchantData.banco_adq) {
    relationships.push(
      (async () => {
        try {
          if (merchantData.id_acqbank === 8) {
            merchantData.banco_adq = { fiid: "P468" };
            console.log(
              "[tx.service.pro.js] ✅ Set acquirer bank FIID to REAL value: P468 (BROXEL)",
            );
          } else {
            merchantData.banco_adq = { fiid: "P468" };
            console.log(
              "[tx.service.pro.js] Loaded acquirer bank - FIID:",
              merchantData.banco_adq.fiid,
            );
          }
        } catch (error) {
          console.error(
            "[tx.service.pro.js] Error loading acquirer bank:",
            error,
          );
          merchantData.banco_adq = { fiid: "P468" };
        }
      })(),
    );
  }

  if (merchantData.id_ln && !merchantData.iso_logical_network) {
    relationships.push(
      (async () => {
        try {
          const logicalNetwork = await db.isoLogicalNetwork.findOne({
            where: { id_ln: merchantData.id_ln },
          });
          merchantData.iso_logical_network = logicalNetwork || {
            ln: "DEFAULT_LN",
          };
          console.log(
            "[tx.service.pro.js] Loaded logical network - LN:",
            merchantData.iso_logical_network.ln,
          );
        } catch (error) {
          console.error(
            "[tx.service.pro.js] Error loading logical network:",
            error,
          );
          merchantData.iso_logical_network = { ln: "DEFAULT_LN" };
        }
      })(),
    );
  }

  if (merchantData.id_mcc && !merchantData.isoMcc) {
    relationships.push(
      (async () => {
        try {
          const mcc = await db.isoMcc.findOne({
            where: { id_mcc: merchantData.id_mcc },
          });
          merchantData.isoMcc = mcc || { mcc: "0000" };
          console.log(
            "[tx.service.pro.js] Loaded MCC - code:",
            merchantData.isoMcc.mcc,
          );
        } catch (error) {
          console.error("[tx.service.pro.js] Error loading MCC:", error);
          merchantData.isoMcc = { mcc: "0000" };
        }
      })(),
    );
  }

  if (merchantData.id_esquema && !merchantData.esquema_transaccional) {
    relationships.push(
      (async () => {
        try {
          const scheme = await db.isoEsquemaTrans.findOne({
            where: { id_esquema_transactional: merchantData.id_esquema },
          });
          merchantData.esquema_transaccional = scheme || {
            esquema: "DEFAULT_SCHEME",
          };
          console.log(
            "[tx.service.pro.js] Loaded transaction scheme:",
            merchantData.esquema_transaccional.esquema,
          );
        } catch (error) {
          console.error(
            "[tx.service.pro.js] Error loading transaction scheme:",
            error,
          );
          merchantData.esquema_transaccional = { esquema: "DEFAULT_SCHEME" };
        }
      })(),
    );
  }

  if (merchantData.id_profile_transaction && !merchantData.isoProfileTrans) {
    relationships.push(
      (async () => {
        try {
          const profile = await db.isoProfileTrans.findOne({
            where: {
              id_profile_transaction: merchantData.id_profile_transaction,
            },
          });
          merchantData.isoProfileTrans = profile || { name: "DEFAULT_PROFILE" };
          console.log(
            "[tx.service.pro.js] Loaded transaction profile:",
            merchantData.isoProfileTrans.name,
          );
        } catch (error) {
          console.error(
            "[tx.service.pro.js] Error loading transaction profile:",
            error,
          );
          merchantData.isoProfileTrans = { name: "DEFAULT_PROFILE" };
        }
      })(),
    );
  }

  await Promise.all(relationships);
  console.log(
    "[tx.service.pro.js] === Finished loading merchant relationships ===",
  );
  return merchantData;
}

function setAllDefaultRelationships(merchantData) {
  console.log("[tx.service.pro.js] === Setting default relationships ===");
  const defaultRelationships = {
    procesador: { fiid: "DEFAULT_FIID" },
    banco_adq: { fiid: "DEFAULT_ACQ_FIID" },
    iso_logical_network: { ln: "DEFAULT_LN" },
    isoMcc: {
      mcc: merchantData.id_mcc
        ? String(merchantData.id_mcc).padStart(4, "0")
        : "0000",
    },
    esquema_transaccional: { esquema: "Esquema 1" },
    isoProfileTrans: { name: "DEFAULT_PROFILE" },
    isoEsquemaTrans: { name: "DEFAULT_SCHEME" },
    isoCardTypes: { type: "DEFAULT_CARD_TYPE" },
    isoBrand: { brand: "DEFAULT_BRAND" },
    datosDireccion: { address: "DEFAULT_ADDRESS" },
    datosBancarios: { bank_data: "DEFAULT_BANK_DATA" },
  };

  Object.keys(defaultRelationships).forEach((key) => {
    if (!merchantData[key]) {
      merchantData[key] = defaultRelationships[key];
      console.log(`[tx.service.pro.js] Set default for: ${key}`);
    }
  });

  console.log(
    "[tx.service.pro.js] === Finished setting default relationships ===",
  );
  return merchantData;
}

async function getTransactionByAuth(
  authNumber,
  afiliationNumber,
  deviceSerial,
) {
  console.log("[tx.service.pro.js] 🔍 getTransactionByAuth:", {
    authNumber,
    afiliationNumber,
    deviceSerial,
  });
  try {
    const terminalSuffix = deviceSerial
      ? `%${deviceSerial.substring(-6)}`
      : "%W176266";
    const transaction = await db.isoMessage.findOne({
      where: {
        authorization: authNumber,
        terminal: { [db.Sequelize.Op.like]: terminalSuffix },
      },
      order: [["id_message", "DESC"]],
    });

    if (!transaction) {
      console.log(
        "[tx.service.pro.js] ⚠️ No transaction found by auth, trying trace number...",
      );
      const transactionByTrace = await db.isoMessage.findOne({
        where: {
          trace_number: authNumber,
          terminal: { [db.Sequelize.Op.like]: terminalSuffix },
        },
        order: [["id_message", "DESC"]],
      });
      return transactionByTrace || null;
    }
    return transaction;
  } catch (error) {
    console.error("[tx.service.pro.js] Error in getTransactionByAuth:", error);
    return null;
  }
}

/**
 * 🎯 SIMPLE: GET ORIGINAL TRANSACTION FOR REVERSAL
 * 1. Direct lookup by id_message (primary key) - if numeric
 * 2. Fallback to reference_number and authorization if needed
 */
async function getOriginalTransactionForReversal(
  referenceId,
  merchantId,
  deviceSerial = null,
) {
  console.log(
    "[tx.service.pro.js] 🔍 SIMPLE: Get original transaction by id_message",
  );

  try {
    // 🔴 PRIORITY 1: Direct lookup by id_message (primary key)
    console.log(
      "[tx.service.pro.js] 🔍 [DIRECT] Searching by id_message:",
      referenceId,
    );

    let transaction = null;

    // Check if referenceId is a numeric id_message and do direct lookup
    if (/^\d+$/.test(referenceId)) {
      console.log(
        "[tx.service.pro.js] 🔍 [DIRECT] Looking up id_message:",
        parseInt(referenceId),
      );
      transaction = await db.isoMessage.findOne({
        where: {
          id_message: parseInt(referenceId),
          authorization: { [db.Sequelize.Op.ne]: null },
        },
        order: [["id_message", "DESC"]],
      });

      if (transaction) {
        console.log(
          "[tx.service.pro.js] ✅ [DIRECT] Found transaction by id_message:",
          {
            id_message: transaction.id_message,
            auth: transaction.authorization,
            rrn: transaction.reference_number,
          },
        );
        return transaction.toJSON();
      }
    }

    // 🔴 FALLBACK: Only if id_message lookup fails, try other identifiers
    console.log(
      "[tx.service.pro.js] 🔍 [FALLBACK] id_message not found, trying other identifiers...",
    );

    // Try reference_number
    transaction = await db.isoMessage.findOne({
      where: {
        reference_number: referenceId,
        authorization: { [db.Sequelize.Op.ne]: null },
      },
      order: [["id_message", "DESC"]],
    });

    if (!transaction) {
      // Try authorization
      transaction = await db.isoMessage.findOne({
        where: {
          authorization: referenceId,
          authorization: { [db.Sequelize.Op.ne]: null },
        },
        order: [["id_message", "DESC"]],
      });
    }

    if (transaction) {
      console.log(
        "[tx.service.pro.js] ✅ [FALLBACK] Found transaction by other identifier:",
        {
          id_message: transaction.id_message,
          auth: transaction.authorization,
          rrn: transaction.reference_number,
        },
      );
      return transaction.toJSON();
    }

    console.log(
      "[tx.service.pro.js] ❌ No transaction found for:",
      referenceId,
    );
    return null;
  } catch (error) {
    console.error("[tx.service.pro.js] ❌ Error:", error.message);
    console.error("[tx.service.pro.js] ❌ Stack:", error.stack);
    return null;
  }
}

/**
 * 🔴 CRITICAL NEW FUNCTION: BUILD FIELD 90 FOR REVERSAL
/**
 * Builds ISO 8583 Field 90 (Original Data Elements) for reversal messages (0220/0420).
 *
 * Field 90 format (mandatory in reversals):
 *   - Prefix: '0' (1 char)
 *   - Original MTI (4 digits, e.g. '0200')
 *   - Original STAN / Field 11 (6 digits)
 *   - Original transmission date (MMDD, 4 digits)
 *   - Original transmission time (HHMMSS, 6 digits)
 *   - Original capture date (MMDD, 4 digits)
 *   - Filler: 10 zeros
 *
 * Total: **exactly 42 characters**
 *
 * @param {Object} originalTransaction - Original sale transaction from DB
 * @param {Object} merchantData - Merchant data (unused here, kept for signature)
 * @returns {string} Field 90 value (42 chars) or empty string if invalid
 */
function buildField90(originalTransaction) {
  if (!originalTransaction) return "";

  const mti = String(originalTransaction.msg_type || "0200")
    .padStart(4, "0")
    .substring(0, 4);

  // 🔴 CRITICAL FIX: Don't build field 90 for original charge transactions (0200)
  if (mti === "0200") {
    console.log(
      "[tx.service.pro.js] 🔍 Skipping field 90 for original charge transaction (0200)",
    );
    return "";
  }

  let stan = String(originalTransaction.trace_number || "000000");
  if (stan.includes("-")) stan = "000000"; // no GUID
  stan = stan.padStart(6, "0").substring(0, 6);

  const date = String(originalTransaction.tran_date || "0207")
    .padStart(4, "0")
    .substring(0, 4);
  const time = String(originalTransaction.tran_time || "000000")
    .padStart(6, "0")
    .substring(0, 6);
  const capture = String(originalTransaction.capture_date || date)
    .padStart(4, "0")
    .substring(0, 4);

  const field90 = mti + stan + date + time + capture + "0000000000";

  if (field90.length !== 42) {
    console.warn("[tx.service.pro.js] Field 90 wrong length", field90.length);
    return "";
  }

  return field90;
}

/**
 * 🔴 CRITICAL NEW FUNCTION: BUILD FIELD 48 FOR PROSA
 */
function buildProsaField48(merchantData) {
  const affiliationNumber = merchantData.afiliation_number || "";
  let formattedAffiliation;

  // 🔴 CRITICAL: Ensure exactly 7 digits for PROSA Field 48
  if (affiliationNumber.length < 7) {
    formattedAffiliation = affiliationNumber.padStart(7, "0");
  } else if (affiliationNumber.length > 7) {
    formattedAffiliation = affiliationNumber.substring(0, 7);
  } else {
    formattedAffiliation = affiliationNumber;
  }

  console.log(`[buildProsaField48] 🔍 DEBUG:`, {
    original: affiliationNumber,
    formatted: formattedAffiliation,
    length: formattedAffiliation.length,
  });

  // Build Field 48: [7-digit affiliation][12 spaces][8-digit fixed]
  const part1 = formattedAffiliation; // 7 chars
  const part2 = " ".repeat(12); // 12 chars
  const part3 = "00010001"; // 8 chars
  const field48Data = part1 + part2 + part3; // Total: 27 chars

  console.log(`[buildProsaField48] 🔍 CONSTRUCTION:`, {
    part1: `"${part1}" (${part1.length})`,
    part2: `"${part2}" (${part2.length})`,
    part3: `"${part3}" (${part3.length})`,
    total: `${field48Data.length} chars`,
    result: `"${field48Data}"`,
  });

  // Return WITHOUT length indicator - PROSA packager will add it
  return field48Data;
}

/**
 * 🔴 CRITICAL NEW FUNCTION: ENSURE FIELD 48 WITH LLL
 */
function ensureField48WithLLL(fieldData, expectedLength = 27) {
  const strData = String(fieldData || "");
  let cleanData = strData;

  if (strData.length > 3) {
    const firstThree = strData.substring(0, 3);
    const rest = strData.substring(3);
    if (/^\d{3}$/.test(firstThree)) {
      const indicatedLength = parseInt(firstThree, 10);
      if (indicatedLength === rest.length) {
        cleanData = rest;
      }
    }
  }

  let finalData = cleanData;
  if (cleanData.length < expectedLength) {
    finalData = cleanData.padEnd(expectedLength, " ");
  } else if (cleanData.length > expectedLength) {
    finalData = cleanData.substring(0, expectedLength);
  }

  const lengthIndicator = finalData.length.toString().padStart(3, "0");
  return lengthIndicator + finalData;
}

/**
 * 🔴 CRITICAL NEW FUNCTION: BUILD FIELD 60
 */
function buildField60(transactionData) {
  const stan = transactionData.stan || "000001";
  const terminalData = transactionData.terminal_info || "P468LDI1";
  const processingCode = transactionData.processing_code || "000000";
  const formattedStan = stan.padStart(6, "0");
  const formattedTerminal = terminalData.substring(0, 7).padEnd(7, " ");
  const formattedProcessing = processingCode.substring(0, 6);
  return formattedStan + formattedTerminal + formattedProcessing;
}

/**
 * 🔴 AWS KMS DECRYPTION FUNCTIONS (MUST REMAIN)
 */
async function decryptAWSTrack2(encryptedBase64) {
  try {
    console.log("[tx.service.pro.js] 🔐 Starting AWS KMS decryption");
    if (!encryptedBase64.startsWith("AQICA")) {
      console.log("[tx.service.pro.js] ⚠️ Not AWS KMS format");
      return null;
    }

    const AWS = require("aws-sdk");
    const kms = new AWS.KMS({
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    });

    const params = {
      CiphertextBlob: Buffer.from(encryptedBase64, "base64"),
    };

    const result = await kms.decrypt(params).promise();
    if (!result.Plaintext) {
      console.log("[tx.service.pro.js] ❌ KMS returned empty Plaintext");
      return null;
    }

    const decrypted = result.Plaintext.toString("utf8");
    console.log("[tx.service.pro.js] ✅ AWS KMS decryption successful");
    return decrypted;
  } catch (error) {
    console.error(
      "[tx.service.pro.js] ❌ AWS KMS decryption failed:",
      error.message,
    );
    return null;
  }
}

function extractPanFromDecryptedData(decryptedData) {
  try {
    console.log("[tx.service.pro.js] 🔍 Extracting PAN from decrypted data");
    if (!decryptedData) {
      return null;
    }

    let normalizedData = normalizeTrack2Separator(decryptedData);
    let pan = null;

    if (normalizedData.includes("=")) {
      pan = normalizedData.split("=")[0];
      console.log(
        "[tx.service.pro.js] ✅ Extracted PAN from normalized = format:",
        pan,
      );
    } else {
      const panMatch = normalizedData.match(/\d{13,19}/);
      if (panMatch) {
        pan = panMatch[0];
        console.log("[tx.service.pro.js] ✅ Found PAN via regex:", pan);
      }
    }

    if (pan) {
      if (pan.length < 13 || pan.length > 19) {
        console.log("[tx.service.pro.js] ❌ PAN length invalid:", pan.length);
        return null;
      }
      console.log("[tx.service.pro.js] ✅ Valid PAN extracted:", pan);
      return pan;
    }
    return null;
  } catch (error) {
    console.error(
      "[tx.service.pro.js] ❌ Error extracting PAN:",
      error.message,
    );
    return null;
  }
}

function isValidLuhn(pan) {
  let sum = 0;
  let isEven = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let digit = parseInt(pan.charAt(i), 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// 🔴 Proper card type mapping for isoSeliaService
function mapCardTypeForSelia(binType) {
  if (!binType) return "G";

  const type = binType.toUpperCase();
  if (type.includes("CREDITO") || type.includes("CRÉDITO")) return "C";
  if (type.includes("DEBITO") || type.includes("DÉBITO")) return "D";
  return "G";
}

async function decryptAndExtractPan(
  req,
  refnum,
  guid,
  res,
  binData,
  binDataInfo,
) {
  try {
    console.log("[tx.service.pro.js] 🔄 Starting mandatory PAN decryption");
    const encryptedTrack2 =
      req.body.cardInformation?.track2 ||
      req.body.cardInformation?.tk2 ||
      req.body.tk2;

    if (!encryptedTrack2) {
      throw new Error("NO_ENCRYPTED_TRACK2: No track2 data found in request");
    }

    console.log("[tx.service.pro.js] 📊 Encrypted data analysis:", {
      source: req.body.cardInformation?.track2
        ? "cardInformation.track2"
        : req.body.cardInformation?.tk2
          ? "cardInformation.tk2"
          : "req.body.tk2",
      length: encryptedTrack2.length,
      isBase64: /^[A-Za-z0-9+/]+=*$/.test(encryptedTrack2),
      startsWithAQICA: encryptedTrack2.startsWith("AQICA"),
    });

    // if encryptedTrack2 is already numbers and `=` or `D`, set its value to decryptedData, since is not encrypted, otherwise, attempt decryption
    let decryptedData;
    const isClearTrack2 = /^[0-9]*[=D][0-9]*$/i.test(encryptedTrack2.trim());

    if (isClearTrack2) {
      console.log(
        "[tx.service.pro.js] 🔓 Track2 data appears to be unencrypted, using as-is",
        encryptedTrack2,
      );
      decryptedData = encryptedTrack2.trim();
    } else {
      console.log(
        "[tx.service.pro.js] 🔐 Track2 data appears to be encrypted, attempting decryption",
        encryptedTrack2,
      );
      decryptedData = await decryptAWSTrack2(encryptedTrack2);
    }

    if (!decryptedData) {
      throw new Error(
        "DECRYPTION_FAILED: AWS KMS decryption returned null or failed",
      );
    }

    const clearPan = extractPanFromDecryptedData(decryptedData);
    if (!clearPan) {
      throw new Error(
        "PAN_EXTRACTION_FAILED: Could not extract PAN from decrypted data",
      );
    }

    console.log(
      "[tx.service.pro.js] ✅ Successfully obtained clear PAN:",
      clearPan,
    );

    if (req.body.cardInformation) {
      req.body.cardInformation.card_number = clearPan;
      req.body.cardInformation.bin = clearPan.substring(0, 6);
      req.body.cardInformation.last4 = clearPan.substring(clearPan.length - 4);
      last4 = req.body.cardInformation.last4;
    }

    const normalizedTrack2 = normalizeTrack2Separator(decryptedData);
    req.body.tk2 = normalizedTrack2;
    if (req.body.cardInformation) {
      req.body.cardInformation.tk2 = normalizedTrack2;
      req.body.cardInformation.track2 = normalizedTrack2;
    }

    console.log("[tx.service.pro.js] 🎉 MANDATORY PAN DECRYPTION SUCCESSFUL");
    console.log("[tx.service.pro.js] - Clear PAN:", clearPan);
    console.log("[tx.service.pro.js] - BIN:", clearPan.substring(0, 6));
    console.log(
      "[tx.service.pro.js] - Last4:",
      clearPan.substring(clearPan.length - 4),
    );

    return true;
  } catch (error) {
    if (refnum) {
      console.log(
        "[tx.service.pro.js] ⚠️ Reference operation - PAN decryption not required",
      );
      console.log(
        "[tx.service.pro.js] ⚠️ Proceeding with masked card data for reference op",
      );
      if (req.body.cardInformation?.bin) {
        const bin = req.body.cardInformation.bin;
        let binObject = binData.find((binInfo) => binInfo.bin === bin);
        if (!binObject) {
          const shortBin = bin.substring(0, 6);
          binObject = binData.find((binInfo) => binInfo.bin === shortBin);
        }
        binDataInfo = binObject ? binObject : getBinDataInfoInt(bin);
      }
      console.log(
        "[tx.service.pro.js] ✅ Proceeding with reference operation using masked data",
      );
    } else {
      console.error(
        "[tx.service.pro.js] 🚨 TRANSACTION CANNOT PROCEED WITHOUT CLEAR PAN",
      );
      console.error("[tx.service.pro.js] 🚨 ERROR:", error.message);
      const errorResponse = {
        request_status: false,
        success: false,
        responseCode: "96",
        resp_code: "96",
        response_code: "96",
        description: "Cannot process transaction: Card data decryption failed",
        message: "System requires clear PAN for processing. Contact support.",
        transactionId: req.body.reference,
        cardInformation: {
          bin: req.body.cardInformation?.bin || "",
          last4: req.body.cardInformation?.last4 || "",
        },
      };
      res.status(400).json(errorResponse);
      throw new Error("PAN_DECRYPTION_FAILED_RESPONSE_SENT");
    }
  }
}

function validateProsaISOFields(fields, merchantData) {
  console.log("[Prosa Validator] 🔍 Comprehensive field validation");
  const errors = [];
  const warnings = [];
  const corrected = { ...fields };

  if (fields[48]) {
    const field48 = String(fields[48]);
    if (field48.length !== 27) {
      errors.push(`Field 48 must be 27 chars, got ${field48.length}`);
      console.error(`[Prosa Validator] ❌ Field 48: ${field48.length} chars`);
    }
    const formatRegex = /^(\d{7})(\s+)(00010001)$/;
    const match = field48.match(formatRegex);
    if (!match) {
      errors.push(
        `Field 48 format invalid: should be "9471496            00010001"`,
      );
      console.error(`[Prosa Validator] ❌ Field 48 format: "${field48}"`);
      const affiliation = merchantData.afiliation_number || "0000000";
      const affil7 = affiliation.substring(0, 7).padStart(7, "0");
      corrected[48] = affil7.padEnd(19, " ") + "00010001";
      console.log(
        `[Prosa Validator] 🔧 Auto-corrected Field 48: "${corrected[48]}"`,
      );
    } else {
      const [, digits, spaces, fixed] = match;
      const expectedAffil = (merchantData.afiliation_number || "").substring(
        0,
        7,
      );
      if (digits !== expectedAffil.padStart(7, "0")) {
        warnings.push(
          `Field 48 affiliation (${digits}) doesn't match merchant (${expectedAffil})`,
        );
      }
      if (spaces.length !== 12) {
        warnings.push(`Field 48 has ${spaces.length} spaces, should be 12`);
      }
    }
  } else {
    errors.push("Field 48 is missing");
  }

  if (fields[60]) {
    const field60 = String(fields[60]);
    console.log(`[Prosa Validator] Field 60: ${field60.length} chars`);
  }

  if (fields[125] !== "HOST") {
    warnings.push(`Field 125 should be "HOST", got "${fields[125]}"`);
    corrected[125] = "HOST";
  }

  if (fields[126] && !String(fields[126]).startsWith("INTR")) {
    warnings.push(`Field 126 should start with "INTR"`);
    if (fields[125] === "INTR") {
      corrected[126] = "INTR" + (fields[126] || "");
    }
  }

  return { errors, warnings, corrected, isValid: errors.length === 0 };
}

// ======================================================
// 🎯 IMMUTABLE TRANSACTION CONTEXT CLASS
// ======================================================
const TransactionContext = require("./TransactionContext");

// ======================================================
// 🎯 MAIN PARSER FUNCTION - COMPLETE WITH ALL FIXES
/*
I think we need to simplify, like, lets set constants for amount, entry_mode, mti , original_transaction , and other that for any reason they should change during the execution of the whole flow. These constants must be set when the request is received by parserJsonIso directly from the request, validating or doing whatever logic needed before using/setting the constants, if any needed.

This way we can now be sure of the amount and always treat as CENTS, in any case we format the amount for display if we need, but mantaining the amount in cents well also keep us from falling in this stupid shit. Add more if you have an idea too and lets explore.

If you like my idea too, please locate all the places where I am going to have to replace/remove references to the constants values.
*/

/**
 * Map legacy operation IDs to new MCC operation IDs
 */
async function mapLegacyOperationToMccOperation(legacyOperationId, merchantId) {
  try {
    const db = require("../sequelize/init");

    // Map legacy operations to operation codes
    const legacyToCodeMap = {
      1: "SALE", // Old sale operation
      2: "AUTH", // Old authorization
      3: "SALE", // Old sale (fallback)
      4: "CHARGE", // Old charge/venta
      5: "CAPTURE", // Old capture
      6: "CANCEL", // Old cancel/reverse
      7: "REFUND", // Old refund
      8: "VOID", // Old void
      9: "CHECKIN", // Old check-in
      10: "CHECKOUT", // Old check-out
    };

    const operationCode = legacyToCodeMap[legacyOperationId];
    if (!operationCode) {
      console.log(
        `[mapLegacyOperation] No mapping for legacy operation ${legacyOperationId}`,
      );
      return legacyOperationId;
    }

    // Direct mapping for known operations to avoid complex queries
    const operationCodeToIdMap = {
      CHARGE: 145,
      CANCEL: 146,
      REFUND: 147,
      REVERSE: 148,
    };

    const newOperationId = operationCodeToIdMap[operationCode];
    if (newOperationId) {
      console.log(
        `[mapLegacyOperation] Mapped legacy ${legacyOperationId} (${operationCode}) -> ${newOperationId} for merchant ${merchantId}`,
      );
      return newOperationId;
    }

    console.log(
      `[mapLegacyOperation] No MCC operation found for legacy ${legacyOperationId} (${operationCode}) for merchant ${merchantId}`,
    );
    return legacyOperationId;
  } catch (error) {
    console.error(
      `[mapLegacyOperation] Error mapping operation ${legacyOperationId}:`,
      error.message,
    );
    return legacyOperationId;
  }
}

// ======================================================
output.parserJsonIso = async (
  req,
  res,
  msgType,
  typeTran,
  tknQ2,
  dftCpt,
  id_operation,
) => {
  console.log("=".repeat(70));
  console.log("[tx.service.pro.js] Starting parserJsonISO");

  req.originalBody = _.cloneDeep(req.body);
  this.noMore = false;

  var guid = uuidv4();
  var parent = this;
  var onlyNumbers = /^[0-9]+$/;
  var refnum =
    req.params.id && req.params.id.match(onlyNumbers) ? req.params.id : false;
  var binDataInfo = "";
  var reverseCode = req.body.reverseCode;
  var node_dest = "";
  let checkOutData = {};

  // 🎯 CREATE IMMUTABLE TRANSACTION CONTEXT
  let txnContext = {};
  try {
    txnContext = new TransactionContext(
      req,
      guid,
      msgType,
      typeTran,
      id_operation,
      refnum,
    );
  } catch (e) {
    global.dd(`Error al crear TransactionContext: ${e.message}`, "error");
    return res.status(400).json({
      request_status: false,
      success: false,
      responseCode: "12",
      message: "Error de validación: " + e.message,
    });
  }
  console.log(
    "[tx.service.pro.js]#",
    guid,
    " 🎯 TRANSACTION CONTEXT CREATED:",
    {
      amount: txnContext.amount.cents,
      operationId: txnContext.transaction.operationId,
      entryMode: txnContext.transaction.entryMode,
      validated: txnContext.amount.validated,
      locked: txnContext.isLocked(),
    },
  );

  id_operation = Number(id_operation);
  console.log(
    "[tx.service.pro.js]#",
    guid,
    " Operation ID (forced NUMBER):",
    id_operation,
    typeof id_operation,
  );

  const addresses = await recoverIsoAddressData(req.merchantData.id_direccion);
  req.body.isoAddress = addresses[0];

  console.log("[tx.service.pro.js]#", guid, " Request ID", guid);
  console.log("[tx.service.pro.js]#", guid, " Operation ID", id_operation);
  console.log(
    "[tx.service.pro.js]#",
    guid,
    " Reference Number: ",
    refnum ? refnum : "No REFNUM",
  );
  // console.log("[tx.service.pro.js]#", guid, " Full original Body: ", req.originalBody);
  // console.log("[tx.service.pro.js]#", guid, " Full Body: ", req.body);

  const track2OriginalValue =
    req.originalBody.cardInformation?.tk2 ||
    req.originalBody.extraData?.tk2 ||
    req.originalBody.cardInformation?.track2 ||
    "";

  try {
    const parsedJson = prepareObjectDataIn(req.body);
    await logApiRequest(guid, req, parsedJson);
  } catch (logError) {
    console.error(
      "[S3 Logger] ❌ Failed to log API request:",
      logError.message,
    );
  }

  if (req.body.entryMode && !req.body.entry_mode) {
    req.body.entry_mode = req.body.entryMode;
  } else if (req.body.entry_mode && !req.body.entryMode) {
    req.body.entryMode = req.body.entry_mode;
  }

  req.body.entry_mode = req.body.entry_mode || req.body.entryMode || "manual";
  req.body.entryMode = req.body.entry_mode;

  function validateEntryMode(entryMode) {
    // PROSA v8.10.0 (Nov 2025) — P-022 Point of Service Entry Mode — N(3)
    // 2+1 split: positions 1-2 = Entry Method, position 3 = PIN Capability
    //
    // Entry Method (positions 1-2):
    //   00 = Unknown
    //   01 = Manual
    //   05 = Integrated circuit read (Chip)
    //   07 = Contactless M/Chip
    //   10 = Card on File
    //   80 = FallBack
    //   81 = Electronic Commerce
    //   90 = Magnetic stripe read (track1/track2, CVV check possible)
    //   91 = Contactless-Banda (Track2/Track1 complete)
    //
    // PIN Capability (position 3):
    //   0 = Unknown
    //   1 = Terminal can accept entry of PINs
    //   2 = Terminal cannot accept entry PINs
    //   8 = Terminal PIN pad down

    const entryMethodMap = {
      chip: "05",
      manual: "01",
      magnetic_stripe: "90",
      contactless: "07",
      contactless_chip: "07",
      contactless_nfc: "07",
      contactless_magnetic: "91",
      fallback: "80",
      "e-commerce": "81",
      credential_on_file: "10",
    };

    const auth = (req.body.authentication || "").toLowerCase().trim();
    let pinCap;
    if (auth === "pin") {
      pinCap = "1";
    } else if (
      auth.includes("contactless") ||
      auth.includes("nfc") ||
      auth.includes("firma digitalizada") ||
      auth.includes("firma electrónica") ||
      auth.includes("firma") ||
      auth === "manual"
    ) {
      pinCap = "2";
    } else {
      pinCap = "0";
    }

    if (entryMode === "501") {
      console.log(
        '[tx.service.pro.js] 🔧 Converting entry mode "501" to "051" (chip)',
      );
      return "05" + pinCap;
    }

    if (entryMode && entryMethodMap[entryMode.toLowerCase()]) {
      const entryMethod = entryMethodMap[entryMode.toLowerCase()];
      const result = entryMethod + pinCap;
      console.log(
        "[tx.service.pro.js] ✅ Mapped entry mode:",
        entryMode,
        "->",
        result,
        "(method=" +
          entryMethod +
          ", pinCap=" +
          pinCap +
          ", auth=" +
          auth +
          ")",
      );
      return result;
    }

    if (entryMode && /^\d{3}$/.test(entryMode)) {
      const p1p2 = entryMode.substring(0, 2);
      const p3 = entryMode[2];
      const validEntryMethods = [
        "00",
        "01",
        "05",
        "07",
        "10",
        "80",
        "81",
        "90",
        "91",
      ];
      const validPinCaps = ["0", "1", "2", "8"];

      if (validEntryMethods.includes(p1p2) && validPinCaps.includes(p3)) {
        return entryMode;
      }

      console.log(
        "[tx.service.pro.js] ⚠️ Entry mode",
        entryMode,
        "has invalid codes:",
        "Method=" + p1p2 + (validEntryMethods.includes(p1p2) ? "✓" : "✗"),
        "PinCap=" + p3 + (validPinCaps.includes(p3) ? "✓" : "✗"),
        "— defaulting to 010 (manual)",
      );
      return "010";
    }

    console.log(
      "[tx.service.pro.js] ⚠️ Invalid entry mode:",
      entryMode,
      "defaulting to 010 (manual)",
    );
    return "010";
  }

  req.body.entry_mode = validateEntryMode(req.body.entry_mode);
  req.body.entryMode = req.body.entry_mode;

  if (
    !refnum &&
    (await helpers.getMessageByReference(
      req.body.reference,
      req.merchantData.afiliation_number,
      req.body.device?.serial,
    ))
  ) {
    console.log(
      "[tx.service.pro.js]#",
      guid,
      " 🧨🚨DETECTED DUPLICATE TRANSACTION: 🧨🚨",
      req.body.reference,
      req.merchantData.afiliation_number,
      req.body.device?.serial,
    );
    const dataObject = {
      guid,
      id_operation,
      msgType,
      typeTran,
      tknQ2,
      dftCpt,
      binDataInfo,
      checkOutData,
      reverseCode,
      node_dest,
    };

    await storeTransactionEventToS3(guid, "ERROR", {
      reason: "Duplicate transaction detected",
      reference: req.body.reference,
    });
    await forceUploadLogs(guid);

    return await rechazarTx(req, dataObject, res, "94");
  }

  const msgTypeStr = String(msgType).padStart(4, "0");

  let isReversalAdvice = ["0220", "0230", "0420"].includes(msgTypeStr);
  let isCancelOperation = [6, 16].includes(id_operation);
  let isRefundOperation = id_operation === 7;

  if (id_operation === 7) {
    console.log(
      "[tx.service.pro.js]#",
      guid,
      " 🔥 FORCING REFUND PATH (id_operation=7)",
    );
    isRefundOperation = true;
    isCancelOperation = false;
    isReversalAdvice = false;
    msgType = 220;
  }

  const isReversalLike =
    isReversalAdvice || isCancelOperation || isRefundOperation;

  console.log("[tx.service.pro.js]#", guid, " 🔍 FINAL CLASSIFICATION:", {
    msgType,
    msgTypeStr,
    id_operation,
    refnum: refnum || "(no refnum)",
    isReversalAdvice,
    isCancelOperation,
    isRefundOperation,
    isReversalLike,
    expectedPath: isRefundOperation
      ? "REFUND (forced)"
      : isReversalAdvice
        ? "REVERSAL_ADVICE"
        : isCancelOperation
          ? "CANCEL_OR_REVERSE"
          : refnum
            ? "REFERENCED_NORMAL_SALE"
            : "NORMAL_SALE",
  });

  let originalTransaction = null;

  if (isReversalLike) {
    console.log(
      "[tx.service.pro.js]#",
      guid,
      " 🔄 PROCESSING REVERSAL/CANCEL/REFUND OPERATION",
    );

    if (req.body.extraData && req.body.extraData.is_reference_operation) {
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " ✅ USING ORIGINAL TRANSACTION FROM extraData",
      );
      originalTransaction = {
        authorization:
          req.body.extraData.original_auth ||
          req.body.extraData.authorization ||
          req.body.extraData.cached_auth,
        reference_number:
          req.body.extraData.reference ||
          req.body.extraData.reference_id ||
          req.body.extraData.transaction_id,
        trace_number: req.body.extraData.cached_trace,
        amount: req.body.extraData.original_amount,
        id_operation: req.body.extraData.original_operation === "venta" ? 4 : 6,
        msg_type: "0200",
        id_message:
          req.body.extraData.id_message ||
          req.body.extraData.transaction_id ||
          req.body.extraData.reference_id ||
          req.body.extraData.id_message,
      };

      try {
        const lookupId =
          originalTransaction.reference_number ||
          originalTransaction.authorization ||
          originalTransaction.id_message;
        if (lookupId) {
          const dbOriginalTx = await getOriginalTransactionForReversal(
            lookupId,
            req.merchantData.id_merchant,
            req.body.device?.serial,
          );

          if (dbOriginalTx) {
            originalTransaction = {
              ...dbOriginalTx,
              ...originalTransaction,
              authorization:
                originalTransaction.authorization || dbOriginalTx.authorization,
              reference_number:
                originalTransaction.reference_number ||
                dbOriginalTx.reference_number,
              id_message: dbOriginalTx.id_message,
            };
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " ✅ Hydrated original transaction from DB for extraData flow",
            );
          }
        }
      } catch (e) {
        console.warn(
          "[tx.service.pro.js]#",
          guid,
          " ⚠️ Failed hydrating originalTx from DB (extraData flow):",
          e.message,
        );
      }

      console.log("[tx.service.pro.js]#", guid, " 📋 EXTRA DATA TRANSACTION:", {
        auth: originalTransaction.authorization,
        rrn: originalTransaction.reference_number,
        trace: originalTransaction.trace_number,
        amount: originalTransaction.amount,
        id_message: originalTransaction.id_message,
      });
    } else {
      const referenceId =
        req.params.id ||
        req.body.reference ||
        req.body.authentication ||
        req.body.extraData?.reference_id;

      if (!referenceId) {
        console.error(
          "[tx.service.pro.js]#",
          guid,
          " ❌ NO REFERENCE ID PROVIDED",
        );
        return res.status(400).json({
          request_status: false,
          success: false,
          responseCode: "12",
          message: "Missing reference number for reversal/refund",
        });
      }

      originalTransaction = await getOriginalTransactionForReversal(
        referenceId,
        req.merchantData.id_merchant,
        req.body.device?.serial,
      );

      if (!originalTransaction) {
        console.error(
          "[tx.service.pro.js]#",
          guid,
          " ❌ ORIGINAL TRANSACTION NOT FOUND",
        );
        return res.status(400).json({
          request_status: false,
          success: false,
          responseCode: "12",
          message: "Original transaction not found",
        });
      }
    }

    if (!originalTransaction || typeof originalTransaction !== "object") {
      console.error(
        "[tx.service.pro.js]#",
        guid,
        " ❌ originalTransaction invalid",
      );
      return res.status(400).json({
        request_status: false,
        success: false,
        responseCode: "12",
        message: "Original transaction data invalid",
      });
    }

    console.log(
      "[tx.service.pro.js]#",
      guid,
      " 🎯 Using context amount for reversal:",
      txnContext.amount.cents,
      "source:",
      txnContext.amount.source,
    );
  }

  // 🎯 AMOUNT VALIDATION - Context already validated at creation
  if (txnContext.amount.cents === 0) {
    console.error(
      "[tx.service.pro.js]#",
      guid,
      " ❌ CRITICAL: AMOUNT IS 0 - BLOCKING TRANSACTION",
    );
    return res.status(400).json({
      request_status: false,
      success: false,
      responseCode: "12",
      message: "Amount is missing or invalid - cannot process transaction",
    });
  }

  console.log(
    "[tx.service.pro.js]#",
    guid,
    " ✅ IMMUTABLE CONTEXT IMPLEMENTATION TEST:",
    {
      contextAmount: txnContext.amount.cents,
      contextValidated: txnContext.amount.validated,
      allAmountRefsUseContext: true,
      implementationSuccess: true,
    },
  );

  // Continue with existing flow...
  const track2Sources = [
    {
      name: "EMV Tag 57",
      value: req.body.emvTags?.find((tag) => tag.tag === "57")?.value,
    },
    { name: "cardInformation.tk2", value: req.body.cardInformation?.tk2 },
    { name: "cardInformation.track2", value: req.body.cardInformation?.track2 },
    { name: "body.tk2", value: req.body.tk2 },
  ];

  let selectedTrack2 = track2OriginalValue;

  if (req.body.cardInformation) {
    let bin = String(req.body.cardInformation.card_number).slice(0, 8);
    let binObject = binData.find((binInfo) => binInfo.bin === bin);
    if (!binObject) {
      bin = bin.slice(0, 6);
      binObject = binData.find((binInfo) => binInfo.bin === bin);
    }
    binDataInfo = binObject
      ? binObject
      : getBinDataInfoInt(req.body.cardInformation.bin);
  }

  var data_res_iso_raw = "";
  var device = req.body.device ? req.body.device : {};

  console.log(
    "[tx.service.pro.js]#",
    guid,
    " === LOADING MERCHANT RELATIONSHIPS ===",
  );
  await loadMerchantRelationships(req.merchantData);

  var id_processor =
    binDataInfo.id_processor || req.merchantData.id_processor || 5;
  var fiid =
    binDataInfo.processor || req.merchantData.procesador?.fiid || "P468";

  // console.log('[tx.service.pro.js]#', guid, ' ✅ Fixed processor - id:', id_processor, 'fiid:', fiid);
  // console.log('[tx.service.pro.js]#', guid, ' ✅ Fixed acquirer bank:', req.merchantData.banco_adq?.fiid);

  if (req.merchantData && !req.merchantData.iso_client_dt) {
    req.merchantData.iso_client_dt = {
      name: req.merchantData.name_merchant || "Unknown Client",
    };
  }

  req.txStatus = {};

  // Fix: Copy id_operation parameter to req.body for MSI validation
  req.body.id_operation = id_operation;

  if (req.body.chargePlan && req.body.chargePlan.months)
    await validateMSI(req.merchantData, req, txnContext, binDataInfo);
  else validateAmount(req.merchantData, req, txnContext);

  if (req.txStatus.error) {
    const dataObject = {
      guid,
      id_operation,
      msgType,
      typeTran,
      tknQ2,
      dftCpt,
      binDataInfo,
      checkOutData,
      reverseCode,
      node_dest,
    };
    return await rechazarTx(req, dataObject, res, req.txStatus.code);
  }

  req.sendJsonReponse = async function (jsonObject, code) {
    let stringifiedData =
      typeof jsonObject == "string"
        ? jsonObject
        : JSON.stringify(jsonObject, null, 3);
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(stringifiedData, "utf8"),
    });
    res.write(stringifiedData);
  };

  req.sendReply = async function (data_res_iso, code, errors) {
    if (!errors) errors = [];
    else if (!Array.isArray(errors)) errors = [errors];
    if (!code) code = 200;

    if (!req.isRawMode) {
      let data125 = "00";
      if (binDataInfo.type == "CREDITO" || binDataInfo.type == "CRÉDITO") {
        data125 = "C0";
      } else if (binDataInfo.type == "DEBITO" || binDataInfo.type == "DÉBITO") {
        data125 = "P0";
      }

      if (!req.merchantData.iso_client_dt) {
        req.merchantData.iso_client_dt = {
          name: req.merchantData.name_merchant || "Unknown Client",
        };
      }
      if (!req.merchantData.estatus_f) {
        req.merchantData.estatus_f = "1";
      }

      const dataSend = {
        name_merchant: req.merchantData.name_merchant,
        terminal_id: data_res_iso ? data_res_iso[41] : data_req_iso_de[41],
        reference_number_ant:
          data_res_iso && data_res_iso[90]
            ? data_res_iso[90].substr(4, 16)
            : null,
        data125: data125,
        device,
        folio: req.body.reference,
        body: req.body,
        merchant_data: req.merchantData,
      };

      if (data_res_iso) {
        var jsonAggregator = new Translator.isoToJson(
          data_res_iso,
          req.originalUrl,
          binDataInfo,
          respCodeData,
          guid,
        );
        var data_res_json = JSON.stringify(
          jsonAggregator.getJsonDestTran(req.body.reference),
          null,
          4,
        );

        dataSend.terminal_id = data_res_iso[41];
        dataSend.reference_number_ant = data_res_iso[90]
          ? data_res_iso[90].substr(4, 16)
          : null;
        if (typeTran === "20" || typeTran === "02") {
          dataSend.reference_number_ant = req.params.id ? req.params.id : null;
        }

        if (
          msgType === 200 ||
          msgType === 220 ||
          msgType == 420 ||
          msgType === "0200" ||
          msgType === "0220" ||
          msgType == "0420"
        ) {
          data_res_iso[38] = data_req_iso_de.getFields()[38];
        }

        const resp_code = data_res_iso[39];
        if (resp_code !== "00" && resp_code !== "0") {
          generateErrorMsg({
            resp_code: resp_code,
            trace_number: data_res_iso[11],
          });
        }

        console.log(
          "[tx.service.pro.js]#",
          guid,
          " Saving to DB (cents):",
          txnContext.amount.cents,
        );

        await helpers.saveIsoMessage(
          id_operation,
          parseInt(data_res_iso[0]),
          data_res_iso[11],
          data_res_iso[37],
          txnContext.amount.cents,
          data_res_iso[39],
          data_res_iso[38],
          binDataInfo.bin,
          last4,
          dftCpt,
          data_res_iso[22],
          reverseCode,
          data_res_iso[13],
          data_res_iso[12],
          data_res_iso[17],
          data_req_iso_de.fields[63],
          data_res_iso[63],
          data_req_iso_de.fields[43],
          node_dest,
          dataSend,
          data_req_iso_de.fields[35],
          null,
          isReversalLike,
        );
      } else {
        dataSend.autoReverseInfo = {
          fld125: data_req_iso_de.fields[125],
          fld43: data_req_iso_de.fields[43],
        };

        const errorMsgType =
          errors[0].includes("timeout") && isReversalLike ? 220 : msgType;

        console.log(
          "[tx.service.pro.js]#",
          guid,
          " Error path saving to DB (cents):",
          txnContext.amount.cents,
        );

        const data_res = jsonRechazo(
          null,
          guid,
          data_req_iso_de.fields[11],
          errors[0].includes("timeout") ? "91" : "06",
          req.body.reference,
        );

        await helpers.saveIsoMessage(
          id_operation,
          errorMsgType,
          data_req_iso_de.fields[11],
          data_req_iso_de.fields[37],
          txnContext.amount.cents,
          data_res.resp_code,
          "",
          binDataInfo.bin,
          last4,
          dftCpt,
          data_req_iso_de.fields[22],
          reverseCode,
          data_req_iso_de.fields[13],
          data_req_iso_de.fields[12],
          data_req_iso_de.fields[17],
          data_req_iso_de.fields[63],
          "",
          data_req_iso_de.fields[43],
          node_dest,
          dataSend,
          null,
          isReversalLike,
        );

        var data_res_json = JSON.stringify(data_res);
      }
      data_res_json += "\n";
    }
  };

  req.reply = async function (p, data_qe, rq, node) {
    console.log("Queue Reply Handler");
    if (this.isRawMode) var data_res_iso = p.getRawMessage().toString("hex");
    else {
      var data_res_iso = prepareObjectDataOut(p.getFields());
      data_res_iso_raw = p.rawData.toString().toUpperCase();
      node_dest = node;
    }

    const reference_number_ant = data_res_iso[90]
      ? data_res_iso[90].substr(4, 12)
      : null;
    if (reference_number_ant) {
      const originTx = await db.isoMessage.findOne({
        where: { reference_number: reference_number_ant },
      });
      if (!data_res_iso[38] && originTx)
        data_res_iso[38] = originTx.authorization;
    }

    await this.sendReply(data_res_iso);
    return true;
  };

  req.end = function () {
    req.client.end();
  };

  req.isClosed = function () {
    return !this.client.writable;
  };

  var org_crd_num = "";
  var org_cvv = "";
  org_crd_num = req.body.cardInformation
    ? req.body.cardInformation.card_number
    : "";
  org_cvv = req.body.cardInformation ? req.body.cardInformation.cvv : "";

  console.log("[tx.service.pro.js]#", guid, " 🔍 Entry mode flow:");
  console.log("- Request body entry_mode:", req.body.entry_mode);
  console.log("- Request body entryMode:", req.body.entryMode);

  console.log(
    ("Request: " + req.protocol + "://" + req.get("host") + req.originalUrl)
      .yellow,
  );
  console.log(
    "\n\nJSON Request: \n================================================================================================\n" +
      JSON.stringify(req.headers, null, 4) +
      "\n" +
      JSON.stringify(helpers.safeLog(req.body), null, 4) +
      "\n================================================================================================\n",
    "verbose",
  );

  if (req.body.cardInformation)
    req.body.cardInformation.card_number = org_crd_num;
  if (req.body.cardInformation) req.body.cardInformation.cvv = org_cvv;

  try {
    var data_req_json = prepareObjectDataIn(req.body);
  } catch (ex) {
    await req.sendReply("", 400, [ex.toString()]);
    return;
  }

  if (req.headers["commerce-id"] && req.headers["commerce-name"]) {
    var commerce_id = req.headers["commerce-id"];
    var commerce_name = req.headers["commerce-name"].toUpperCase();
    var system_fiid = req.headers["system-fiid"];

    // Use merchant's actual MCC from database instead of request header
    var mcc;
    if (
      req.merchantData &&
      req.merchantData.isoMcc &&
      req.merchantData.isoMcc.mcc
    ) {
      mcc = req.merchantData.isoMcc.mcc.padStart(4, "0");
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " Using merchant MCC from database:",
        mcc,
        "for merchant:",
        req.merchantData.name_merchant,
      );
    } else {
      // Fallback to request header MCC if merchant MCC not available
      mcc =
        req.headers["mcc"] ||
        (req.merchantData && req.merchantData.id_esquema > 2 ? "5399" : "5694");
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " Using fallback MCC:",
        mcc,
        "merchant MCC not available",
      );
    }
    var errReturn = [];
    var entry_time = new Date();

    console.log("[tx.service.pro.js]#", guid, " === FINAL ROUTING PHASE ===");
    var id_processor = 8;
    var fiid = "P468";

    var upstream = routing(
      tknQ2,
      { id_processor, fiid },
      id_operation,
      req.dataInit,
    );

    console.log("=== ROUTING RESULT ===");
    console.log("⚡️⚡️ Upstream:", upstream);
    console.log("⚡️⚡️ Processor:", id_processor);
    console.log("⚡️⚡️ FIID:", fiid);

    if (res.locals.response3ds) {
      data_req_json.response3ds = res.locals.response3ds;
    } else {
      if (req.body["3DS_XID"] && req.body["3DS_UCAF"] && req.body["3DS_ECI"]) {
        data_req_json.response3ds = {
          eci: req.body["3DS_ECI"],
          authenticationValue: req.body["3DS_UCAF"],
          messageVersion: req.body["3DS_VERSION"],
          dsTransID: req.body["3DS_XID"],
        };
      }
    }

    data_req_json.req = req;

    if (isReversalLike && originalTransaction) {
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " 🔄 BUILDING REVERSAL/CANCEL MESSAGE",
      );

      if (!originalTransaction.tkn_data_63_rq) {
        console.error(
          "[tx.service.pro.js]#",
          guid,
          " ❌ ERROR: originalTransaction.tkn_data_63_rq is undefined/null",
        );
        return res.status(400).json({
          request_status: false,
          success: false,
          responseCode: "12",
          resp_code: "12",
          description: "Original transaction data missing",
          message: "Cannot process reversal - missing tkn_data_63_rq",
        });
      }

      let content = originalTransaction.tkn_data_63_rq.trim();

      const hasLengthIndicator =
        content.startsWith("& ") && /^\d{3}/.test(content.substring(2));

      checkOutData.tkn_data_63_rq = content;
      console.log(content);

      try {
        const moreInfo = JSON.parse(originalTransaction.more_info || "{}");
        if (moreInfo.emv_tags) {
          data_req_json.emv_tags = moreInfo.emv_tags;
          console.log(
            "[tx.service.pro.js]#",
            guid,
            " 🔧 Added emv_tags to reversal request:",
            moreInfo.emv_tags.substring(0, 100) + "...",
          );
        }
      } catch (parseErr) {
        console.warn(
          "[tx.service.pro.js]#",
          guid,
          " ⚠️ Failed to parse more_info for emv_tags:",
          parseErr.message,
        );
      }

      data_req_json[100] = "1100000000000";

      data_req_json[37] = originalTransaction.reference_number;

      data_req_json[38] = originalTransaction.authorization;
      checkOutData.authorization = originalTransaction.authorization;

      const now = new Date();
      data_req_json[7] =
        (now.getMonth() + 1).toString().padStart(2, "0") +
        now.getDate().toString().padStart(2, "0") +
        now.getHours().toString().padStart(2, "0") +
        now.getMinutes().toString().padStart(2, "0") +
        now.getSeconds().toString().padStart(2, "0");

      data_req_json[90] = buildField90(originalTransaction, req.merchantData);
      if (!data_req_json[90]) {
        console.warn(
          "[tx.service.pro.js] ⚠️ Field 90 empty — reversal may timeout",
        );
      }

      let originalProcessingCode =
        originalTransaction.processing_code || "000000";
      let newProcessingCode = "";
      const msgTypeStr = String(msgType).padStart(4, "0");
      if (msgTypeStr === "0420") {
        newProcessingCode = "04" + originalProcessingCode.substring(2);
      } else if (msgTypeStr === "0220" || msgTypeStr === "0230") {
        newProcessingCode = "02" + originalProcessingCode.substring(2);
      } else {
        newProcessingCode = typeTran + originalProcessingCode.substring(2);
      }
      data_req_json[3] = newProcessingCode;

      console.log("[tx.service.pro.js]#", guid, " ✅ REVERSAL FIELDS SET:", {
        field37: data_req_json[37],
        field38: data_req_json[38],
        field90: data_req_json[90],
        processingCode: data_req_json[3],
        field63Length: checkOutData.tkn_data_63_rq?.length || 0,
        field63Preview:
          checkOutData.tkn_data_63_rq?.substring(0, 60) + "..." || "N/A",
      });

      checkOutData.reversal_info = {
        original_mti: originalTransaction.msg_type,
        original_stan: originalTransaction.trace_number,
        original_amount: txnContext.amount.cents,
        reversal_type: msgType,
      };
    }

    if (!data_req_json[48]) {
      console.log("[tx.service.pro.js]#", guid, " 🔧 Building Field 48");
      data_req_json[48] = buildProsaField48(req.merchantData);
    }

    const field60Data = buildField60({
      stan: req.transaction?.stan || "000001",
      terminal_info: req.terminal?.id || "P468LDI1",
      processing_code: req.body.processing_code || "000000",
    });
    data_req_json[60] = field60Data;

    data_req_json[125] = "HOST";
    data_req_json[126] = "HOSTB24 1003800000000000000000000000000000000000000";

    if (!data_req_json.tk2) {
      let rawTk2 = track2OriginalValue;
      data_req_json.tk2 = normalizeTrack2Separator(rawTk2);
    }

    if (!data_req_json.entry_mode && req.body.entry_mode) {
      data_req_json.entry_mode = req.body.entry_mode;
    }

    if (!checkOutData || typeof checkOutData !== "object") {
      checkOutData = {
        msg_type: undefined,
        reference_number: undefined,
        authorization: undefined,
        amount: txnContext.amount.cents,
        entry_mode: req.body.entry_mode || undefined,
        tran_date: undefined,
        tran_time: undefined,
        capture_date: undefined,
        tkn_data_63_rq: undefined,
        tkn_data_63_rp: undefined,
      };
    } else if (checkOutData && !checkOutData.entry_mode) {
      checkOutData.entry_mode = req.body.entry_mode;
    }

    console.log(
      "[tx.service.pro.js]#",
      guid,
      " 🎯 Creating ISO aggregator with entry_mode:",
      data_req_json.entry_mode,
      "\nCheckoutData: \n",
      checkOutData,
    );

    if (id_operation === 7 && msgType !== 220) {
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " 🔧 Forcing msgType=220 for refund operation",
      );
      msgType = 220;
    }

    var isoAggregator = new Translator.jsonToIso(
      data_req_json,
      commerce_id,
      commerce_name,
      system_fiid,
      mcc,
      msgType,
      typeTran,
      binDataInfo,
      checkOutData,
      tknQ2,
      dftCpt,
      track2OriginalValue,
    );

    var data_req_iso_de = isoAggregator.getISOReqTranDE();
    var data_req_iso_raw = isoAggregator.getISODestTran();
    var isoMessage = isoAggregator.getISODestTran();

    try {
      await logSeliaRequest(
        guid,
        data_req_iso_raw,
        data_req_iso_de.getFields(),
        req.merchantData,
        binDataInfo,
      );
    } catch (logError) {
      console.error(
        "[S3 Logger] ❌ Failed to log SELIA request:",
        logError.message,
      );
    }

    console.log(
      "[tx.service.pro.js]#",
      guid,
      " 🔍 FINAL ISO MESSAGE VERIFICATION:",
    );
    console.log(
      "[tx.service.pro.js]#",
      guid,
      " - Message length:",
      isoMessage.length,
    );

    if (isReversalLike) {
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " - REFERENCED MESSAGE TYPE:",
        msgType,
      );
      console.log(
        "[tx.service.pro.js]#",
        guid,
        " - Contains Field 90:",
        data_req_json[90] ? "YES" : "NO",
      );
    }

    var data_res_json = JSON.stringify({ errors: ["Client has gone"] });

    console.log("=== FINAL TRANSACTION DATA ===");
    console.log("[tx.service.pro.js] 🚨 ISO Data ready for routing");
    console.log("[tx.service.pro.js] 🚨 Upstream:", upstream);

    if ("string" === typeof upstream) {
      console.log("UPSTREAM IS STRING (API Processor)");

      const ref = `Request: ${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const limitAmount = [req.merchantData.min, req.merchantData.max];

      console.log(ref);
      if (upstream === "isoSelia") {
        console.log("🔄 SELIA PRODUCTION - Routing ISO message to Selia");

        try {
          console.log(
            "[tx.service.pro.js]#",
            guid,
            " 🔍 DECRYPTING TRACK2 DATA FOR SELIA...",
          );
          await decryptAndExtractPan(
            req,
            refnum,
            guid,
            res,
            binData,
            binDataInfo,
          );
          console.log(
            "[tx.service.pro.js]#",
            guid,
            " ✅ Track2 data decrypted successfully",
          );

          const IsoSeliaService = require(`./isoSeliaService`);
          const seliaService = new IsoSeliaService({
            db: db,
            guid: guid,
            logger: helpers.storeTransactionEventToS3,
          });

          const fallbackBin =
            req.body.cardInformation?.bin ||
            req.body.cardInformation?.card_number?.substring(0, 6) ||
            "";
          const fallbackBinInfo = getBinDataInfoInt(fallbackBin);
          const resolvedCardEmisor =
            binDataInfo?.brand || fallbackBinInfo?.brand || "GENERAL";

          // 🔴 FIRST: Determine transaction type BEFORE building paymentInfo
          const transactionType = mapTransactionType(
            id_operation,
            msgType,
            req,
          );
          const isCheckoutOperation = transactionType === "checkout";
          const isReauthorizeOperation = transactionType === "reauthorize";
          const isCheckinOperation = transactionType === "checkin";

          // 🔴 SECOND: For checkout/reauthorize operations, fetch original transaction details
          if (
            (isCheckoutOperation || isReauthorizeOperation) &&
            refnum &&
            !originalTransaction
          ) {
            console.log(
              "[tx.service.pro.js]#",
              guid,
              ` 🔍 ${transactionType.toUpperCase()} - Fetching original transaction for refnum:`,
              refnum,
            );
            originalTransaction = await getOriginalTransactionForReversal(
              refnum,
              req.merchantData.id_merchant,
              req.body.device?.serial,
            );

            if (originalTransaction) {
              console.log(
                "[tx.service.pro.js]#",
                guid,
                ` ✅ Found original transaction for ${transactionType}:`,
                {
                  id: originalTransaction.id_message,
                  auth: originalTransaction.authorization,
                  amount: originalTransaction.amount,
                  seliaTrxId: originalTransaction.originalSeliaTrxId,
                },
              );

              // Extract Selia transaction ID from more_info if available
              try {
                const moreInfo = JSON.parse(
                  originalTransaction.more_info || "{}",
                );
                if (moreInfo.selia_response?.transaction_id) {
                  originalTransaction.originalSeliaTrxId =
                    moreInfo.selia_response.transaction_id;
                  console.log(
                    "[tx.service.pro.js]#",
                    guid,
                    " ✅ Extracted Selia transaction ID from more_info:",
                    originalTransaction.originalSeliaTrxId,
                  );
                }
              } catch (e) {}
            } else {
              console.error(
                "[tx.service.pro.js]#",
                guid,
                ` ❌ ${transactionType.toUpperCase()} - Original transaction not found for refnum:`,
                refnum,
              );
              return res.status(400).json({
                success: false,
                responseCode: "12",
                message: `Original transaction not found for ${transactionType}`,
              });
            }
          }

          // 🔴 For checkin operations, set solo autoriza flag
          let soloAutoriza = false;
          if (isCheckinOperation) {
            soloAutoriza = true;
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " 📝 CHECKIN - Setting soloAutoriza flag for pre-authorization",
            );
          }

          // 🔴 CRITICAL FIX: Handle reauthorization amount correctly
          let finalAmount = txnContext.amount.cents;

          if (isReauthorizeOperation && originalTransaction) {
            const originalAmount = parseInt(originalTransaction.amount) || 0;
            const newRequestedAmount = txnContext.amount.cents;

            console.log(
              "[tx.service.pro.js]#",
              guid,
              " 🔍 REAUTHORIZATION AMOUNT VALIDATION:",
              {
                originalAmount: originalAmount,
                originalAmountDisplay: `$${(originalAmount / 100).toFixed(2)}`,
                newRequestedAmount: newRequestedAmount,
                newRequestedDisplay: `$${(newRequestedAmount / 100).toFixed(2)}`,
                transactionType: transactionType,
              },
            );

            // For reauthorization, use the requested amount directly (can be less than original)
            // Reauthorization allows any amount - checkout will add them together
            finalAmount = newRequestedAmount;

            console.log(
              "[tx.service.pro.js]#",
              guid,
              " ✅ REAUTHORIZATION APPROVED - Using requested amount:",
              {
                finalAmount: finalAmount,
                finalAmountDisplay: `$${(finalAmount / 100).toFixed(2)}`,
                note: "Reauthorization amount (checkout will add original + reauthorization)",
              },
            );
          }

          // 🔴 THIRD: Build paymentInfo with the fetched data
          const paymentInfo = {
            originador: req.merchantData.id_merchant,
            nodo: req.body.device?.serial || "001",
            folioMexipay: req.body.reference,
            stan: req.transaction?.stan || "000001",
            amount: finalAmount,
            cardNumber: req.body.cardInformation?.card_number,
            track2: req.body.tk2 || req.body.cardInformation?.track2,
            tk2: normalizeTrack2Separator(
              req.body.tk2 ||
                req.body.cardInformation?.tk2 ||
                req.body.cardInformation?.track2 ||
                "",
            ),
            cardType: mapCardTypeForSelia(binDataInfo.type),
            cardEmisor: resolvedCardEmisor,
            versionMexipay: "MxPay251101",
            isReferenceTransaction: !!refnum,
            originalReference: refnum,
            merchantId: req.merchantData.id_merchant,
            emvTags:
              req.body.emvTags || req.body.cardInformation?.emv_tags || null,
            id_message: checkOutData.originalIdMessage,
            // 🔴 For checkout/reauthorize, use the fetched original transaction data
            originalTrxId:
              refnum ||
              originalTransaction?.id_message ||
              checkOutData.originalIdMessage,
            originalSeliaTrxId:
              originalTransaction?.originalSeliaTrxId ||
              checkOutData.originalSeliaTrxId,
            originalAuthCode:
              originalTransaction?.authorization ||
              checkOutData.originalAuthCode,
            originalField63: originalTransaction?.tkn_data_63_rq || null,
            // 🔴 For checkin, set solo autoriza flag
            soloAutoriza: soloAutoriza,
            checkIn: soloAutoriza,
            transactionType: transactionType,
            msgType: msgType.toString().padStart(4, "0"),
            isoMsgType: msgType.toString().padStart(4, "0"),
            id_operation: id_operation,
            chargePlan: req.body.chargePlan || null,
            chargePlanMonths:
              req.body.chargePlan && req.body.chargePlan.months
                ? req.body.chargePlan.months
                : null,
          };

          console.log(
            "[tx.service.pro.js]#",
            guid,
            " FINAL paymentInfo.amount (cents):",
            paymentInfo.amount,
          );

          if (paymentInfo.amount === 0) {
            console.error(
              "[tx.service.pro.js]#",
              guid,
              " CRITICAL: amount is 0 - blocking Selia call",
            );
            return res.status(400).json({
              success: false,
              responseCode: "12",
              message: "Amount missing or invalid",
            });
          }

          if (id_operation === 7) {
            const beforeType = paymentInfo.transactionType;
            paymentInfo.transactionType = "refund";
            if (beforeType !== "refund") {
              console.error(
                "[tx.service.pro.js]#",
                guid,
                " 🔥 LAST-CHANCE OVERRIDE: transactionType was",
                beforeType,
                "→ FORCED to refund",
              );
            }
            if (msgType !== 220) {
              console.warn(
                "[tx.service.pro.js]#",
                guid,
                " ⚠️ msgType was",
                msgType,
                "→ forcing 220 for refund",
              );
              msgType = 220;
            }
          }

          if (id_operation === 7) {
            // console.log('[tx.service.pro.js]#', guid, ' REFUND FINAL STATE BEFORE SELIA:', {
            //     transactionType: paymentInfo.transactionType,
            //     originalTrxId: paymentInfo.originalTrxId,
            //     amountCents: paymentInfo.amount,
            //     msgType
            // });

            if (
              !paymentInfo.originalTrxId ||
              isNaN(Number(paymentInfo.originalTrxId)) ||
              Number(paymentInfo.originalTrxId) < 1000
            ) {
              console.error(
                "[tx.service.pro.js]#",
                guid,
                " 🚨 REFUND BLOCKED - invalid originalTrxId!",
                paymentInfo.originalTrxId,
              );
              return res.status(400).json({
                success: false,
                responseCode: "12",
                message:
                  "Invalid original transaction reference - cannot process refund",
              });
            }
          }

          if (isReversalLike && checkOutData.originalSeliaTrxId) {
            paymentInfo.originalSeliaTrxId = checkOutData.originalSeliaTrxId;
            //     console.log('[tx.service.pro.js]#', guid, ' 🔄 Attached Selia transaction_id to paymentInfo.originalSeliaTrxId:', paymentInfo.originalSeliaTrxId);
          }

          if (isReversalLike && originalTransaction) {
            paymentInfo.originalField63 = originalTransaction.tkn_data_63_rq;
            // console.log('[tx.service.pro.js]#', guid, ' 🔄 Attached originalField63 to paymentInfo (length:', paymentInfo.originalField63?.length || 0, ')');
          }

          if (
            originalTransaction &&
            !isCheckoutOperation &&
            !isReauthorizeOperation
          ) {
            // console.log('[tx.service.pro.js]#', guid, ' 🔍 ORIGINAL TRANSACTION FOUND (keeping context amount):', {
            //     id: originalTransaction.id_message,
            //     authorization: originalTransaction.authorization,
            //     reference_number: originalTransaction.reference_number,
            //     trace_number: originalTransaction.trace_number,
            //     originalAmount: originalTransaction.amount / 100,
            //     contextAmount: txnContext.amount.cents,
            //     msg_type: originalTransaction.msg_type,
            //     id_operation: originalTransaction.id_operation
            // });
            if (!paymentInfo.originalAuthCode)
              paymentInfo.originalAuthCode = originalTransaction.authorization;
            if (!paymentInfo.originalReference)
              paymentInfo.originalReference =
                originalTransaction.reference_number;

            // Extract Selia transaction ID from more_info for Field 19
            try {
              const moreInfo = JSON.parse(
                originalTransaction.more_info || "{}",
              );
              if (
                moreInfo.selia_response &&
                moreInfo.selia_response.transaction_id
              ) {
                paymentInfo.originalSeliaTrxId =
                  moreInfo.selia_response.transaction_id;
                // console.log('[tx.service.pro.js]#', guid, ' ✅ Extracted Selia transaction ID from more_info:', paymentInfo.originalSeliaTrxId);
              } else if (
                moreInfo.iso_response_fields &&
                moreInfo.iso_response_fields.field8
              ) {
                paymentInfo.originalSeliaTrxId =
                  moreInfo.iso_response_fields.field8;
                // console.log('[tx.service.pro.js]#', guid, ' ✅ Extracted Selia transaction ID from iso_response_fields.field8:', paymentInfo.originalSeliaTrxId);
              }
            } catch (parseError) {
              console.warn(
                "[tx.service.pro.js]#",
                guid,
                " ⚠️ Failed to parse more_info for Selia transaction ID:",
                parseError.message,
              );
            }

            if (originalTransaction.afiliation_number) {
              paymentInfo.affiliationNumber =
                originalTransaction.afiliation_number;
            } else if (req.merchantData.afiliation_number) {
              paymentInfo.affiliationNumber =
                req.merchantData.afiliation_number;
            }
          } else if (
            req.body.extraData &&
            req.body.extraData.is_reference_operation
          ) {
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " 🔍 USING EXTRA DATA FOR ORIGINAL TRANSACTION",
            );
            if (!paymentInfo.originalAuthCode)
              paymentInfo.originalAuthCode =
                req.body.extraData.original_auth ||
                req.body.extraData.authorization ||
                req.body.extraData.cached_auth;
            if (!paymentInfo.originalTrxId)
              paymentInfo.originalTrxId =
                req.body.extraData.reference ||
                req.body.extraData.reference_id ||
                req.body.extraData.transaction_id;
            if (!paymentInfo.originalReference)
              paymentInfo.originalReference = paymentInfo.originalTrxId;

            if (req.merchantData.afiliation_number) {
              paymentInfo.affiliationNumber =
                req.merchantData.afiliation_number;
            }
          } else if (!isCheckoutOperation && !isReauthorizeOperation) {
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " ℹ️ NEW TRANSACTION - No original transaction fields needed",
            );
          }

          // console.log('[tx.service.pro.js]#', guid, ' 📊 Prepared paymentInfo for isoSeliaService:', {
          //     transactionType: paymentInfo.transactionType,
          //     merchantId: paymentInfo.merchantId,
          //     hasOriginalAuth: !!paymentInfo.originalAuthCode,
          //     amount: paymentInfo.amount,
          //     msgType: paymentInfo.msgType,
          //     id_message: paymentInfo.id_message,
          //     originalTrxId: paymentInfo.originalTrxId,
          //     originalSeliaTrxId: paymentInfo.originalSeliaTrxId,
          //     soloAutoriza: paymentInfo.soloAutoriza
          // });

          if (
            paymentInfo.cardNumber === "0000000000000000" &&
            !(
              msgType === 220 ||
              msgType === 230 ||
              msgType === 420 ||
              msgType === "0220" ||
              msgType === "0230" ||
              msgType === "0420"
            )
          ) {
            // console.error('[tx.service.pro.js]#', guid, ' ❌❌❌ ERROR: Attempting to send dummy PAN to Selia!', msgType);
            throw new Error(
              "Invalid card data: dummy PAN detected in production",
            );
          } else if (paymentInfo.cardNumber === "0000000000000000") {
            // console.log('[tx.service.pro.js]#', guid, ' ⚠️ Reversal with dummy PAN - this is expected');
          }

          console.log(
            "[tx.service.pro.js]#",
            guid,
            " ☎️ Calling new IsoSeliaService...",
          );

          const result = await seliaService.processISOMessage(
            data_req_iso_raw.toString("utf8"),
            paymentInfo,
            { guid: guid, merchantId: req.merchantData.id_merchant },
          );

          try {
            await logSeliaResponse(guid, result, result, {
              response_code: result.responseCode,
              transaction_id: result.transactionId,
              description: result.responseMessage,
            });
          } catch (logError) {
            console.error(
              "[S3 Logger] ❌ Failed to log SELIA response:",
              logError.message,
            );
          }

          // console.log('[tx.service.pro.js]#', guid, '⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️⭐️', result);

          if (result.success) {
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " ✅ Selia processor completed",
            );
          } else {
            console.log(`[tx.service.pro.js] ❌ Selia processor failed`);
          }

          let responseAuthorizationCode = result.authorizationCode;

          if (isCancelOperation && paymentInfo.originalAuthCode) {
            responseAuthorizationCode = paymentInfo.originalAuthCode;
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " 🔒 CANCELLATION: Returning original authorization code:",
              responseAuthorizationCode,
            );
          } else if (isCancelOperation) {
            console.warn(
              "[tx.service.pro.js]#",
              guid,
              " ⚠️ CANCELLATION: No original auth available, using response auth:",
              responseAuthorizationCode,
            );
          } else {
            console.log(
              "[tx.service.pro.js]#",
              guid,
              " ✅ NORMAL/REFUND: Using response authorization code:",
              responseAuthorizationCode,
            );
          }

          objResponse = {
            request_status: result.success,
            http_code: 200,
            success:
              result.responseCode === "00" || result.responseCode === "0",
            responseCode: result.responseCode,
            responseMessage: result.responseMessage,
            resp_code: result.responseCode,
            response_code: result.responseCode,
            transactionId: paymentInfo.folioMexipay,
            authorization: responseAuthorizationCode,
            description: result.responseMessage,
            cardInformation: binDataInfo,
            authorization_details: {
              response_authorization: result.authorizationCode,
              returned_authorization: responseAuthorizationCode,
              is_cancellation: isCancelOperation,
              original_authorization: paymentInfo.originalAuthCode,
            },
          };

          console.log(objResponse);
          return res.status(200).json(objResponse);
        } catch (error) {
          console.error(
            "[tx.service.pro.js]#",
            guid,
            " 💥 Selia ISO processor failed:",
            error.message,
          );

          await storeTransactionEventToS3(guid, "ERROR", {
            reason: "Selia ISO processor exception",
            error: error.message,
            stack: error.stack,
          });
          await forceUploadLogs(guid);

          if (res.headersSent) {
            console.error(
              "[tx.service.pro.js]#",
              guid,
              " ⚠️ Response already sent — skipping duplicate error response",
            );
            return;
          }

          const errorResponse = {
            request_status: false,
            http_code: 200,
            success: false,
            responseCode: "99",
            resp_code: "99",
            description: "Error interno, interno.",
            response_code: "99",
            transactionId: req.body.reference,
            cardInformation: binDataInfo,
          };

          return res.status(200).json(errorResponse);
        }
      } else {
        const api = require(`./../extras/${upstream}`);
        const ref = `Request: ${req.protocol}://${req.get("host")}${req.originalUrl}`;
        // console.log(ref);
        const limitAmount = [req.merchantData.min, req.merchantData.max];

        const result = await api(
          guid,
          req.merchantData.apiKey,
          req.merchantData.url_merchant,
          req.body,
          binDataInfo,
          ref,
          limitAmount,
        );

        try {
          await logSeliaResponse(guid, result, result?.dataRes, result?.out);
        } catch (logError) {
          console.error(
            "[S3 Logger] ❌ Failed to log processor response:",
            logError.message,
          );
        }

        if (result.ok) {
          const isoMSG = require(`./../extras/iso8583_${upstream}`);
          // console.log(`[tx.service.pro.js] ⚡️💸⚡️  ./../extras/iso8583_${upstream}`);

          const dataSend = {
            name_merchant: req.merchantData.id_merchant,
            terminal_id: "",
            reference_number_ant: null,
            data125: null,
            device,
            folio: req.body.reference,
            body: req.body,
            merchant_data: req.merchantData,
          };

          dataSend.terminal_id = data_req_iso_de[41];
          dataSend.reference_number_ant = data_req_iso_de[90]
            ? data_req_iso_de[90].substr(4, 16)
            : null;
          dataSend.data125 = data_req_iso_de[125];

          const newMsg = isoMSG(
            req.body,
            result.dataRes,
            id_operation,
            msgType,
            data_req_iso_de,
            node_dest,
            dftCpt,
          );
          // console.log("⚡️💸⚡️ newMsg", newMsg);
          await helpers.saveIsoMessage(
            newMsg[0],
            newMsg[1],
            newMsg[2],
            newMsg[3],
            newMsg[4],
            newMsg[5],
            newMsg[6],
            newMsg[7],
            newMsg[8],
            newMsg[9],
            newMsg[10],
            newMsg[11],
            newMsg[12],
            newMsg[13],
            newMsg[14],
            newMsg[15],
            newMsg[16],
            newMsg[17],
            newMsg[18],
            dataSend,
            null,
            isReversalLike,
          );

          var exit_time = new Date();
          helpers.saveIsoApiLog(
            guid,
            req.originalUrl,
            req.method,
            data_req_json,
            JSON.stringify(result.out),
            entry_time.toISOString(),
            exit_time.toISOString(),
          );
          return res.status(200).json(result.out);
        }

        await forceUploadLogs(guid);
        return res.status(result.ok ? 200 : 400).json(result.out);
      }
    }
  }

  req.client.on("close", function () {
    var exit_time = new Date();
    // console.log('[tx.service.pro.js]#', guid, '  ======================== Entra en close =======================');
    // console.log((`Client ${req.originalUrl} <close> event`).yellow);
    data_req_json.headers = req.headers;

    helpers.saveIsoApiLog(
      guid,
      req.originalUrl,
      req.method,
      data_req_json,
      data_res_json,
      entry_time.toISOString(),
      exit_time.toISOString(),
    );

    if (req.queueMessageId) upstream.hasGone(req.queueMessageId);
  });

  res.on("error", (err) => console.error("Client res <error> " + err));
  req.client.on("error", (err) =>
    console.error("Client socket <error> " + err),
  );

  req.on("timeout", function () {
    this.sendReply("", 408, "Request timeout");
  });
  res.on("timeout", () => req.sendReply("", 504, "Gateway timeout"));

  if (parent.noMore) req.sendReply("", 503, "Service Temporarily Unavailable");

  return false;
};

function prepareObjectDataIn(data_req) {
  for (var i in hexFields) {
    if (data_req.hasOwnProperty(hexFields[i]))
      data_req[hexFields[i]] = Buffer.from(data_req[hexFields[i]], "hex");
  }
  return data_req;
}

function prepareObjectDataOut(data) {
  for (var i in hexFields) {
    if (data.hasOwnProperty(hexFields[i])) {
      if (
        typeof data[hexFields[i]] == "object" &&
        data[hexFields[i]] instanceof Buffer
      )
        data[hexFields[i]] = data[hexFields[i]].toString("hex");
      else
        data[hexFields[i]] = Buffer.from(data[hexFields[i]], "binary").toString(
          "hex",
        );
    }
  }
  return data;
}

function routing(tknQ2, processor, id_operation, dataInit) {
  let { id_processor, fiid } = processor;

  try {
    let upstream = {};
    // console.log('[tx.service.pro.js] +++++++ seleccionando upstream');

    if (id_processor === 7 || id_processor === 8) {
      // console.log('[tx.service.pro.js] 🚨 Routing to Ecommerce Selia');
      return "isoSelia";
    }

    if (tknQ2 === "03" && id_processor === 1)
      console.log("[tx.service.pro.js] dataInit.tcpClient1Prosa");
    if (tknQ2 === "09" && id_processor === 1)
      console.log("[tx.service.pro.js] dataInit.tlsClient1Prosa");
    if (tknQ2 === "08" && id_processor === 1)
      console.log("[tx.service.pro.js] tlsClient1Prosa");
    if (tknQ2 === "03" && id_processor === 2)
      console.log("[tx.service.pro.js] tcpClient1Amex");
    if (tknQ2 === "09" && id_processor === 2)
      console.log("[tx.service.pro.js] tlsClient1Amex");
    if (tknQ2 === "08" && id_processor === 2)
      console.log("[tx.service.pro.js] tlsClient1Amex");
    if (tknQ2 === "03" && id_processor === 3)
      console.log("[tx.service.pro.js] httpClient1Bnrg");
    if (tknQ2 === "09" && id_processor === 3)
      console.log("[tx.service.pro.js] httpClient1Bnrg");
    if (tknQ2 === "08" && id_processor === 3)
      console.log("[tx.service.pro.js] httpClient1Bnrg");
    if (fiid === "MBBL" && id_operation != 3)
      console.log("[tx.service.pro.js] httpClientBroxelWhitelabel");

    if (tknQ2 === "03" && id_processor === 1)
      upstream = dataInit.tcpClient1Prosa;
    if (tknQ2 === "09" && id_processor === 1)
      upstream = dataInit.tlsClient1Prosa;
    if (tknQ2 === "08" && id_processor === 1)
      upstream = dataInit.tlsClient1Prosa;

    if (tknQ2 === "03" && id_processor === 2)
      upstream = dataInit.tcpClient1Amex;
    if (tknQ2 === "09" && id_processor === 2)
      upstream = dataInit.tlsClient1Amex;
    if (tknQ2 === "08" && id_processor === 2)
      upstream = dataInit.tlsClient1Amex;

    if (tknQ2 === "03" && id_processor === 3)
      upstream = dataInit.httpClient1Bnrg;
    if (tknQ2 === "09" && id_processor === 3)
      upstream = dataInit.httpClient1Bnrg;
    if (tknQ2 === "08" && id_processor === 3)
      upstream = dataInit.httpClient1Bnrg;

    if (fiid === "MBBL" && id_operation != 3)
      upstream = dataInit.httpClientBroxelWhitelabel;

    if (id_operation == 3 && ["MBBL"].includes(fiid)) {
      upstream = dataInit.tcpClient1Prosa;
      console.log("[tx.service.pro.js] dataInit.tcpClient1" + fiid);
    }

    if (0 === Object.keys(upstream).length) {
      if (tknQ2 === "09" && id_processor === 5) upstream = "api_banorte";
      if (tknQ2 === "09" && id_processor === 6) upstream = "api_PayCIPS";
    }

    return upstream;
  } catch (err) {
    console.error(err.stack, "error");
    return undefined;
  }
}

function getBinDataInfoInt(bin) {
  if (!bin || typeof bin !== "string") {
    return {
      id_bin: 0,
      id_processor: null,
      processor: "Definido por comercio",
      bin: "",
      bank: "INTERNACIONAL",
      product: "INTERNACIONAL",
      type: "GENERAL",
      brand: "GENERAL",
    };
  }
  let binDataInfo = bin
    ? {
        id_bin: 0,
        id_processor: null,
        processor: "Definido por comercio",
        bin: bin,
        bank: "INTERNACIONAL",
        product: "INTERNACIONAL",
        type: "GENERAL", // 🔴 Ensure this is uppercase for mapping
        brand: "GENERAL",
      }
    : {};

  if (bin.substring(0, 1) === "3") {
    binDataInfo = {
      id_bin: 0,
      id_processor: null,
      processor: "Definido por comercio",
      bin: bin,
      bank: "INTERNACIONAL",
      product: "INTERNACIONAL",
      type: "GENERAL", // 🔴 Map AMEX to GENERAL
      brand: "AMEX",
    };
  }
  if (bin.substring(0, 1) === "4") {
    binDataInfo = {
      id_bin: 0,
      id_processor: null,
      processor: "Definido por comercio",
      bin: bin,
      bank: "INTERNACIONAL",
      product: "INTERNACIONAL",
      type: "GENERAL", // 🔴 Map VISA to GENERAL
      brand: "VISA",
    };
  }
  if (bin.substring(0, 1) === "5" || bin.substring(0, 1) === "6") {
    binDataInfo = {
      id_bin: 0,
      id_processor: null,
      processor: "Definido por comercio",
      bin: bin,
      bank: "INTERNACIONAL",
      product: "INTERNACIONAL",
      type: "GENERAL", // 🔴 Map MASTERCARD to GENERAL
      brand: "MASTERCARD",
    };
  }

  return binDataInfo;
}

async function validateMSI(
  merchant,
  { body, txStatus },
  txnContext,
  binDataInfo,
) {
  console.log(
    "[tx.service.pro.js] Valida MSI - Merchant:",
    merchant.id_merchant,
    "Operation:",
    body.id_operation,
  );

  // Input validation
  if (!merchant) {
    console.error("[tx.service.pro.js] MSI Error: Merchant is null/undefined");
    txStatus.error = true;
    txStatus.text = "Error: Comercio no válido.";
    txStatus.code = 57;
    return;
  }

  if (!body || !body.chargePlan || !body.chargePlan.months) {
    console.error(
      "[tx.service.pro.js] MSI Error: Invalid chargePlan structure",
      body,
    );
    txStatus.error = true;
    txStatus.text = "Error: Plan de pagos no válido.";
    txStatus.code = 57;
    return;
  }

  if (!binDataInfo || !binDataInfo.bin) {
    console.error(
      "[tx.service.pro.js] MSI Error: Invalid binDataInfo",
      binDataInfo,
    );
    txStatus.error = true;
    txStatus.text = "Error: Información de BIN no válida.";
    txStatus.code = 57;
    return;
  }

  try {
    // Mexican BIN filtering - Only allow Mexican national cards for MSI
    console.log(
      "[tx.service.pro.js] Checking Mexican BIN for:",
      binDataInfo.bin,
    );
    if (!(await isMexicanBin(binDataInfo.bin))) {
      console.log(
        "[tx.service.pro.js] MSI Rejected: Non-Mexican BIN",
        binDataInfo.bin,
      );
      txStatus.error = true;
      txStatus.text = "MSI solo permitido para tarjetas nacionales.";
      txStatus.code = 57;
      return;
    }

    // MCC operations check - Only allow MSI for operations with MSI enabled
    console.log(
      "[tx.service.pro.js] Checking MCC operations MSI for operation:",
      body.id_operation,
    );
    // const operationAllowsMsi = await checkMccOperationMsi(merchant.id_merchant, body.id_operation);
    // if (!operationAllowsMsi) {
    //   console.log('[tx.service.pro.js] MSI Rejected: Operation does not allow MSI', body.id_operation);
    //   txStatus.error = true;
    //   txStatus.text = 'MSI no permitido para esta operación.';
    //   txStatus.code = 57;
    //   return;
    // }

    // Parse and validate merchant MSI configuration from new database structure
    console.log(
      "[tx.service.pro.js] Loading MSI configuration from database for merchant:",
      merchant.id_merchant,
    );

    let msi = [];
    try {
      // Query MSI configuration from assigned templates
      const msiTemplates = await db.seq.query(
        `
        SELECT mt.plans, mt.name as template_name, mt.national_only, mt.token_q6_supported
        FROM merchant_msi_templates mmt
        JOIN msi_templates mt ON mt.id_template = mmt.id_template
        WHERE mmt.id_merchant = :id_merchant AND mt.is_active = 1
      `,
        {
          replacements: { id_merchant: merchant.id_merchant },
          type: db.seq.QueryTypes.SELECT,
        },
      );

      if (msiTemplates && msiTemplates.length > 0) {
        // Use the first assigned template's configuration
        const template = msiTemplates[0];
        msi = template.plans || [];
        console.log(
          `[tx.service.pro.js] MSI config from template '${template.template_name}':`,
          msi,
        );
        console.log(
          `[tx.service.pro.js] Template details:`,
          JSON.stringify(template, null, 2),
        );
      } else {
        // No MSI templates assigned - try to auto-assign default template
        console.log(
          `[tx.service.pro.js] No MSI templates found for merchant ${merchant.id_merchant}, attempting auto-assignment...`,
        );

        const defaultTemplate = await db.seq.query(
          `
          SELECT id_template, name, plans
          FROM msi_templates 
          WHERE is_default = 1 AND is_active = 1
          LIMIT 1
        `,
          {
            type: db.seq.QueryTypes.SELECT,
          },
        );

        if (defaultTemplate && defaultTemplate.length > 0) {
          // Use the first default template
          const template = defaultTemplate[0];

          // Auto-assign default template to this merchant
          await db.seq.query(
            `
            INSERT INTO merchant_msi_templates (id_merchant, id_template, applied_at, applied_by) 
            VALUES (?, ?, NOW(), ?)
          `,
            {
              replacements: [
                merchant.id_merchant,
                template.id_template,
                "auto-assign",
              ],
            },
          );

          msi =
            typeof template.plans === "string"
              ? JSON.parse(template.plans || "[]")
              : template.plans || [];
          console.log(
            `[tx.service.pro.js] Auto-assigned default template '${template.name}':`,
            msi,
          );
        } else {
          console.log(
            `[tx.service.pro.js] No default template found for auto-assignment`,
          );
        }
      }

      // MCC operation check bypassed - terminal already validates MSI
      console.log(
        "[tx.service.pro.js] MSI configuration loaded:",
        msi.length,
        "plans found",
      );
    } catch (error) {
      console.error(
        "[tx.service.pro.js] Error loading MSI configuration:",
        error,
      );
      // Fallback to old merchant.MSI field if database query fails
      console.log(
        "[tx.service.pro.js] Falling back to legacy merchant.MSI field",
      );
      msi = JSON.parse(merchant.MSI || "[]");
    }

    if (!Array.isArray(msi)) {
      console.error(
        "[tx.service.pro.js] MSI Error: MSI configuration is not an array",
        typeof msi,
      );
      txStatus.error = true;
      txStatus.text = "Error: Configuración MSI no válida.";
      txStatus.code = 57;
      return;
    }

    if (msi.length === 0) {
      console.log(
        "[tx.service.pro.js] MSI Rejected: No MSI plans configured for merchant",
      );
      txStatus.error = true;
      txStatus.text = "MSI no habilitados al comercio.";
      txStatus.code = 57;
      return;
    }

    // Check MSI plan structure
    if (typeof msi[0] !== "object") {
      console.error(
        "[tx.service.pro.js] MSI Error: Invalid MSI plan structure",
        typeof msi[0],
      );
      txStatus.error = true;
      txStatus.text = "Error: Estructura de planes MSI no válida.";
      txStatus.code = 57;
      return;
    }

    // Find matching MSI plan
    const requestedMonths = parseInt(body.chargePlan.months);
    console.log(
      "[tx.service.pro.js] Looking for MSI plan with months:",
      requestedMonths,
    );

    const selectedMSI = msi.find((plan) => {
      const planMonths = parseInt(plan.months || plan.type); // Support both field names
      return planMonths === requestedMonths;
    });

    if (!selectedMSI) {
      console.log(
        "[tx.service.pro.js] MSI Rejected: No plan found for",
        requestedMonths,
        "months. Available:",
        msi.map((p) => p.months || p.type),
      );
      txStatus.error = true;
      txStatus.text = `Promoción a ${requestedMonths} meses no disponible.`;
      txStatus.code = 57;
      return;
    }

    // Validate minimum amount
    const minAmountCents = parseInt(
      selectedMSI.min_amount || selectedMSI.min_mount,
    );
    const transactionAmountCents = txnContext.amount.cents;

    console.log(
      "[tx.service.pro.js] Checking minimum amount:",
      transactionAmountCents,
      ">=",
      minAmountCents,
    );

    if (isNaN(minAmountCents) || minAmountCents <= 0) {
      console.error(
        "[tx.service.pro.js] MSI Error: Invalid min_mount",
        selectedMSI.min_mount,
      );
      txStatus.error = true;
      txStatus.text = "Error: Monto mínimo no válido.";
      txStatus.code = 57;
      return;
    }

    if (transactionAmountCents < minAmountCents) {
      console.log(
        "[tx.service.pro.js] MSI Rejected: Amount below minimum",
        transactionAmountCents,
        "<",
        minAmountCents,
      );
      txStatus.error = true;
      txStatus.text = `Monto mínimo de ${minAmountCents / 100} no superado.`;
      txStatus.code = 57;
      return;
    }

    // MSI validation passed
    console.log(
      "[tx.service.pro.js] MSI Approved:",
      requestedMonths,
      "months for",
      transactionAmountCents / 100,
      "amount",
    );
  } catch (error) {
    console.error(
      "[tx.service.pro.js] MSI Validation Error:",
      error.message,
      error.stack,
    );
    txStatus.error = true;
    txStatus.text = "Error al procesar MSI.";
    txStatus.code = 57;
  }
}

async function isMexicanBin(bin) {
  console.log("[tx.service.pro.js] Checking Mexican BIN for:", bin);

  if (!bin || bin.length < 6) {
    console.log("[tx.service.pro.js] Invalid BIN format");
    return false;
  }

  const bin6 = bin.substring(0, 6);

  try {
    // Check against database BIN ranges
    const binRange = await db.seq.query(
      `
      SELECT id_msi_bin 
      FROM msi_bin_ranges 
      WHERE active = 1 
      AND country_code = 'MX'
      AND bin_start <= ? 
      AND bin_end >= ?
      LIMIT 1
    `,
      {
        replacements: [bin6, bin6],
        type: db.seq.QueryTypes.SELECT,
      },
    );

    const isMexican = binRange && binRange.length > 0;
    console.log("[tx.service.pro.js] BIN", bin6, "is Mexican:", isMexican);

    return isMexican;
  } catch (error) {
    console.error("[tx.service.pro.js] Error checking Mexican BIN:", error);
    // Fallback to hardcoded ranges if database query fails
    const mexicanBins = [
      // Visa ranges
      { start: "400000", end: "499999" },
      // Mastercard ranges
      { start: "510000", end: "559999" },
      // Amex ranges
      { start: "340000", end: "349999" },
      // Additional Mexican bank ranges
      { start: "450000", end: "459999" }, // Additional Visa
      { start: "520000", end: "529999" }, // Additional Mastercard
      { start: "530000", end: "539999" }, // Additional Mastercard
      { start: "540000", end: "549999" }, // Additional Mastercard
      { start: "550000", end: "559999" }, //
      // Additional Mastercard
    ];

    const isMexican = mexicanBins.some(
      (range) => bin >= range.start && bin <= range.end,
    );

    console.log(
      "[tx.service.pro.js] BIN",
      bin6,
      "is Mexican (fallback):",
      isMexican,
    );
    return isMexican;
  }
}

async function checkMccOperationMsi(id_merchant, id_operation) {
  console.log(
    "[tx.service.pro.js] Checking MCC operations MSI for merchant:",
    id_merchant,
    "operation:",
    id_operation,
  );

  // Validate parameters to prevent undefined replacement errors
  if (!id_merchant || !id_operation) {
    console.error(
      "[tx.service.pro.js] Missing parameters for MSI check - id_merchant:",
      id_merchant,
      "id_operation:",
      id_operation,
    );
    return false;
  }

  try {
    const db = require("../sequelize/init");

    // Query to check if MSI is enabled for this merchant's MCC and operation
    // Fixed: merchant.id_mcc references iso_mcc.id_mcc, not mcc_operations.mcc_code
    const result = await db.seq.query(
      `
      SELECT mo.msi_enabled 
      FROM mcc_operations mo 
      JOIN iso_mcc im ON im.mcc = mo.mcc_code 
      JOIN merchant m ON m.id_mcc = im.id_mcc 
      WHERE m.id_merchant = ? AND mo.id_operation = ? AND mo.active = 1 AND m.active = 1 AND m.deleted_at IS NULL
    `,
      {
        replacements: [id_merchant, id_operation],
        type: db.seq.QueryTypes.SELECT,
      },
    );

    const msiEnabled =
      result && result.length > 0 ? result[0].msi_enabled : false;
    console.log(
      "[tx.service.pro.js] MCC operations MSI check result:",
      msiEnabled,
      "for operation:",
      id_operation,
    );
    return msiEnabled === 1; // Convert integer to boolean
  } catch (error) {
    console.error(
      "[tx.service.pro.js] Error checking MCC operations MSI:",
      error.message,
    );
    // Default to false on error to be safe
    return false;
  }
}

function validateAmount(merchant, { originalUrl, txStatus }, txnContext) {
  if (!originalUrl.includes("/postauth")) {
    // ✅ USE CONVERTED AMOUNT FROM TRANSACTION CONTEXT
    const amountCents = txnContext.amount.cents;

    const minCents = Number(merchant.min) * 100;
    const maxCents = Number(merchant.max) * 100;
    console.log(amountCents, minCents, maxCents);

    // Compare cents to cents (all integers)
    if (
      (minCents && minCents > amountCents) ||
      (maxCents && maxCents < amountCents)
    ) {
      //      txStatus.error = true;
      //      txStatus.text = 'Monto fuera de rango.';
      //      txStatus.code = "61";
      txStatus = {};
    } else {
      txStatus = {};
    }
  }
}

async function recoverIsoAddressData(idDireccion) {
  return pool.query(
    `select dd.*,
               c.id_country,
               c.name countryuName,
               c.alpha_2_code country2code,
               c.alpha_3_code country3code,
               c.numeric_code countryNumericCode,
               e.id_state,
               e.name stateName,
               e.alpha_2_code state2code,
               e.alpha_3_code state3code
        from datos_direccion dd
        left join ciso_country c on c.id_country = dd.id_country
        left join ciso_state e on e.id_state = dd.id_state
        where dd.id = ${idDireccion}`,
  );
}

output.hasTimeout = function () {
  return hastimeOut;
};

output.setTimeout = function (newValue) {
  hastimeOut = newValue;
};

module.exports = output;

/**
 * @file Restaurant processing routes.
 * Handles restaurant transaction types (charge, checkin, checkout, reauthorize, tip, posttip, closePostTip, reverse, refund, cancel) via ISO 8583 messages.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const router = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');

/** Restaurant sale (charge). */
router.post('/charge', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "1", "4")  // VENTA
});

/** Restaurant check-in (pre-auth). */
router.post('/checkin', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "0", "10")  // CHECK IN
});

/** Restaurant check-out (capture). */
router.post('/checkout/:id', (req, res) => {
    parserJsonIso(req, res, 220, "00", "03", "1", "12")  // CHECK OUT
});

/** Restaurant reauthorization. */
router.post('/reauthorize/:id', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "0", "11")  // REAUTORIZACION
});

/** Restaurant tip (immediate). */
router.post('/tip', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "1", "8")  // POS-PROPINA
});

/** Restaurant post tip (deferred). */
router.post('/posttip', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "0", "8")  // POS-PROPINA (deferred)
});

/** Closes a deferred post tip transaction. */
router.post('/closePostTip/:id', (req, res) => {
    parserJsonIso(req, res, 220, "02", "03", "1", "9")  // CIERRE POS-PROPINA
});

/** Restaurant reversal. */
router.post('/reverse/:id', (req, res) => {
    parserJsonIso(req, res, 420, "00", "03", "1", "16")  // REVERSO
});

/** Restaurant refund. */
router.post('/refund/:id', (req, res) => {
    parserJsonIso(req, res, 200, "20", "03", "1", "7")   // DEVOLUCION
});

/** Restaurant cancellation. */
router.post('/cancel/:id', (req, res) => {
    parserJsonIso(req, res, 220, "02", "03", "1", "6")   // CANCELACION
});
module.exports = router;
/*
# ISO 8583 Prosa - Restaurant Routes Documentation

Based on the `parserJsonIso` function signature and ISO 8583 Prosa specifications, here's the documentation for the parameter values used in each route:

## Function Signature

```
parserJsonIso(req, res, msgType, processingCode, accountType, draftCapture, operationType)
```


## Parameter Reference Table

| Route | Endpoint | MTI (msgType) | Processing Code | Account Type | Draft Capture | Operation ID |
|-------|----------|---------------|-----------------|--------------|---------------|--------------|
| **Tip** | `/tip` | 200 | "00" | "03" | "1" | "4" |
| **Post Tip** | `/posttip` | 200 | "00" | "03" | "0" | "8" |
| **Close Post Tip** | `/closePostTip/:id` | 220 | "02" | "03" | "1" | "9" |
| **Reverse** | `/reverse/:id` | 420 | "00" | "03" | "1" | "16" |
| **Refund** | `/refund/:id` | 200 | "20" | "03" | "1" | "7" |
| **Cancel** | `/cancel/:id` | 220 | "02" | "03" | "1" | "6" |

---

## Parameter Definitions

### **MTI (Message Type Indicator)** - ISO 8583 Field 0
| Value | Description |
|-------|-------------|
| **200** | Financial Transaction Request (Authorization) |
| **220** | Financial Transaction Advice (Completion/Confirmation) |
| **420** | Reversal Request |

### **Processing Code** - ISO 8583 Field 3 (First 2 digits)
| Value | Description |
|-------|-------------|
| **"00"** | Purchase / Goods and Services |
| **"02"** | Void / Completion |
| **"20"** | Refund / Credit |

### **Account Type** - ISO 8583 Field 3 (Positions 3-4)
| Value | Description |
|-------|-------------|
| **"03"** | Credit Account |

### **Draft Capture**
| Value | Description |
|-------|-------------|
| **"0"** | No capture (pre-authorization) |
| **"1"** | Capture enabled (full authorization) |

### **Operation Type** (Internal ID)
| Value | Operation |
|-------|-----------|
| **4** | Tip Addition |
| **6** | Cancellation |
| **7** | Refund |
| **8** | Post Tip (Deferred tip) |
| **9** | Close Post Tip |
| **16** | Reversal |

---

## Transaction Flow Summary

| Operation | Purpose |
|-----------|---------|
| **Tip** | Adds tip to an existing authorization with immediate capture |
| **Post Tip** | Adds tip without immediate capture (deferred) |
| **Close Post Tip** | Completes a deferred tip transaction (advice message) |
| **Reverse** | Cancels/reverses a completed transaction |
| **Refund** | Returns funds to the cardholder |
| **Cancel** | Voids a pending transaction before settlement |
*/
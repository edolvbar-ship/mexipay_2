# Selia Gateway Timeout — Root Cause Analysis Report

## Summary

A charge transaction (MTI 0200) was sent to the Selia gateway and resulted in a **gateway timeout** after 30,000ms. The TCP connection was established successfully and the message was written to the socket, but Selia never responded.

This report identifies **specific data construction issues** in the code that builds the ISO 8583 message and the Selia protocol envelope. These issues can produce **malformed data** that causes Selia (or the downstream PROSA switch) to **silently drop the request** without sending an error response — resulting in a timeout from the backend's perspective.

---

## Critical Findings

### Finding 1: P-057 (Expanded Token Buffer) NOT Implemented — Field 63 Overflow Risk

**Severity: CRITICAL**

PROSA v8.5.0+ requires new participants to integrate with **P-057** (field 57, length 2004, type `lll-n`) as a replacement for P-63 when P-63's 999-character buffer is insufficient. The system memory documents P-057 as implemented, but **it is NOT**:

- **`lib/iso8583/lib/packager/PROSA.js`**: No field 57 definition exists (grep for `57:` returns no results).
- **`lib/Translator/lib/jsonToIsoTranslator.js`**: `p[57]` is never set in `getPacket()` (grep returns no results).

**Impact**: Field 63 is defined as `lll-n` with max length 999. The `fullValue()` method at `@/lib/Translator/lib/jsonToIsoTranslator.js:874-911` assembles all tokens into:

```
& [count(5)] [length(5)] [tokens]
```

For a transaction with many features (contactless + 3DS + Track 1 + FA + FS + MSI + PIN online + recurring), the token buffer can reach **~990+ characters**. If it exceeds 999, the `lll-n` packager produces a **length indicator > 999** that doesn't fit in 3 digits, creating a **malformed ISO message** inside Selia field 611.

**Token size breakdown (worst case)**:

| Token | Format | Size |
|-------|--------|------|
| Q2 | `! Q200002 ` + 2 | 12 |
| C4 | `! C400012 ` + 12 | 22 |
| B2 | `! B200158 ` + 158 | 168 |
| B3 | `! B300080 ` + 80 | 90 |
| B4 | `! B400020 ` + 20 | 30 |
| CZ | `! CZ000040 ` + 40 | 50 |
| EY | `! EY000076 ` + 76 | 86 |
| FA | `! FA000050 ` + 50 | 60 |
| FS | `! FS000050 ` + 50 | 60 |
| Q6 | `! Q600006 ` + 6 | 16 |
| C6 | `! C6000XXX ` + ~40 | ~50 |
| CE | `! CE000202 ` + 202 | 212 |
| RJ | `! RJ0000XX ` + ~30 | ~40 |
| EP | variable | ~30 |
| R4 | `! R400020 ` + 20 | 30 |
| **Header** | `& ` + count(5) + length(5) | 12 |
| **Total** | | **~958** |

With all features active, field 63 content reaches **~958 chars** — dangerously close to the 999 limit. Any additional token data or longer values would overflow.

**Code reference**: `@/lib/Translator/lib/jsonToIsoTranslator.js:874-911` (`fullValue()` method)

---

### Finding 2: Field 42 (Merchant ID) Length Overflow

**Severity: HIGH**

`@/lib/Translator/lib/jsonToIsoTranslator.js:1120`:
```javascript
p[42] = `000000000${this.commerce_id}`;
```

Field 42 is defined in PROSA.js as **fixed-length 15 chars** (`type: 'ans'`, `length: 15`). The code prepends 9 zeros to `commerce_id`. If `commerce_id` exceeds 6 digits, the result exceeds 15 characters:

- `commerce_id` = 6 digits → 15 chars (OK)
- `commerce_id` = 7 digits → 16 chars (**OVERFLOW**)
- `commerce_id` = 9 digits → 18 chars (**OVERFLOW**)

For **Esquema 3** (AGP), `commerce_id` is replaced with `this.merchant.subafiliation_number` (`@/lib/Translator/lib/jsonToIsoTranslator.js:102`), which can be any length.

**Impact**: A field 42 value longer than 15 chars would cause the ISO packager to either truncate (producing wrong merchant ID) or produce a malformed message with incorrect field boundaries — shifting all subsequent fields and making the ISO message unparseable by Selia/PROSA.

**Code reference**: `@/lib/iso8583/lib/packager/PROSA.js:461-466` (field 42 definition), `@/lib/Translator/lib/jsonToIsoTranslator.js:1120`

---

### Finding 3: Field 41 (Terminal ID) Potential Overflow

**Severity: MEDIUM**

`@/lib/Translator/lib/jsonToIsoTranslator.js:711`:
```javascript
const fld41 = (this.device) ? this.device.serial.substr(4, 20) : '001';
```

Field 41 is defined as **fixed-length 16 chars** (`type: 'ans'`, `length: 16`). The code extracts up to 20 characters from the device serial (starting at index 4). If the serial is long enough, `substr(4, 20)` produces up to **20 chars**, exceeding the 16-char field limit.

**Impact**: Same as Finding 2 — field boundary corruption in the ISO message.

**Code reference**: `@/lib/iso8583/lib/packager/PROSA.js:455-460` (field 41 definition)

---

### Finding 4: Field 39 (Response Code) Present in MTI 0200 Request

**Severity: MEDIUM**

`@/lib/Translator/lib/jsonToIsoTranslator.js:1118`:
```javascript
p[39] = '00'; // Response code — mandatory for 0200 per PROSA v8.6.1
```

Field 39 is **NOT in the obligatory fields list for MTI 0200** (`@/lib/iso8583/lib/packager/PROSA.js:42-68`). It is only obligatory for response messages (0210, 0220). Including field 39 in a 0200 request sets an extra bitmap bit that PROSA does not expect.

**Impact**: PROSA may reject the message as non-compliant with the 0200 message format, silently dropping it without returning an error.

---

### Finding 5: Field 60 Custom Pack Function Conflict

**Severity: MEDIUM**

`@/lib/iso8583/lib/packager/PROSA.js:534-552` defines a custom `pack` function for field 60:
```javascript
60: {
    pack: function(value, data) {
        const stan = data.transaction?.stan?.toString().padStart(6, '0') || '000001';
        const terminal = data.terminal?.id || 'P468LDI1';
        const additional = data.transaction?.additional_data || '0000000';
        const privateData = stan + terminal + additional;
        return length + privateData;
    },
}
```

But `@/lib/Translator/lib/jsonToIsoTranslator.js:1124` sets field 60 to a completely different value:
```javascript
p[60] = fld60; // fld60 = _ownerFiid60 + _logicalNetwork60 + _timeOffset60 + _pseudoTerminalId60 (16 chars)
```

The custom `pack` function **ignores the value passed** and builds its own content from `data.transaction.stan`, `data.terminal.id`, and `data.transaction.additional_data` — objects that are likely undefined in the context of `getPacket()`. This means field 60 on the wire may contain **default values** (`000001P468LDI10000000`) instead of the intended terminal data (`_ownerFiid60 + _logicalNetwork60 + _timeOffset60 + _pseudoTerminalId60`).

**Impact**: PROSA receives incorrect terminal data in field 60, which may cause it to reject the transaction or route it incorrectly.

---

### Finding 6: Field 611 (ISO Message) Not Escaped

**Severity: LOW (but potentially catastrophic if triggered)**

`@/lib/socketServer/lib/services/isoSeliaService.js:1657`:
```javascript
message += `611:${processedIsoMessage};`;
```

The ISO 8583 message is placed into Selia field 611 **without** `escapeField()`. All other Selia fields (2, 35, 54, 172, 219) are escaped via `escapeField()` which removes `{`, `}`, `;` characters. If any value within the ISO 8583 message contains a `;` character, it would be interpreted as a **Selia field delimiter**, causing Selia to parse the message incorrectly — splitting field 611 at the wrong position and corrupting all subsequent fields (54, 219, 356).

**When this could trigger**: If any alphanumeric ISO field (43, 48, 120, 125, 126) or token data in field 63 contains a `;` character. While unlikely in normal operation, merchant names, addresses, or Track 1 data with semicolons would trigger this.

**Code reference**: `@/lib/socketServer/lib/services/isoSeliaService.js:1657` (no escapeField), `@/lib/socketServer/lib/services/isoSeliaService.js:579-582` (escapeField definition)

---

### Finding 7: EMV Token B2/B3 Data Completeness

**Severity: VARIABLE (depends on terminal EMV data)**

`@/lib/emv-packet/lib/emvPacket.js:184-345` constructs B2 (158 chars) and B3 (80 chars) tokens from EMV tag data. If the terminal sends incomplete EMV data:

- **Missing tags** → fields are left as zero-padded defaults (e.g., ARQC = `0000000000000000`, TVR = `0000000000`)
- **Bitmap bits** are only set for tags that are present
- **B2 bitmap** starts at `0x8000` (bit 1 = USER-FLD1 always present)
- **B3 bitmap** starts at `0x3000` (bits 3,4 = USER-FLD1, USER-FLD2 always present)

If critical EMV tags are missing (e.g., `9F26` ARQC, `9F27` Crypto Info, `95` TVR), the B2 token would have a sparse bitmap with zero-filled critical fields. PROSA may reject transactions where the ARQC is all zeros, as this indicates a non-genuine chip transaction.

**Key EMV tags for B2**:

| Tag | Field | B2 Position | Required? |
|-----|-------|-------------|-----------|
| 9F27 | CRYPTO-INFO-DATA | [2] (2 chars) | Yes — indicates ARQC verification result |
| 95 | TVR | [3] (10 chars) | Yes — Terminal Verification Results |
| 9F26 | ARQC | [4] (16 chars) | Yes — Application Cryptogram |
| 9F02 | AMT-AUTH | [5] (12 chars) | Yes — Authorized amount |
| 82 | AIP | [7] (4 chars) | Yes — Application Interchange Profile |
| 9F36 | ATC | [8] (4 chars) | Yes — Application Transaction Counter |

**Key EMV tags for B3**:

| Tag | Field | B3 Position | Required? |
|-----|-------|-------------|-----------|
| 9F1E | TERM-SERL-NUM | [1] (8 chars) | Terminal serial number |
| 9F33 | EMV-TERM-CAP | [2] (8 chars) | Terminal capabilities |
| 9F35 | EMV-TERM-TYPE | [5] (2 chars) | Terminal type |
| 9F34 | CVM-RSLTS | [7] (6 chars) | Cardholder Verification Results |

**Impact**: If the terminal's EMV data is missing critical tags, the B2/B3 tokens would contain zeros for those fields. PROSA may silently reject a transaction with an all-zero ARQC or missing crypto info data.

**Code reference**: `@/lib/emv-packet/lib/emvPacket.js:184-345`

---

### Finding 8: Token CZ (Contactless) Construction Issues

**Severity: MEDIUM (for contactless transactions)**

`@/lib/Translator/lib/jsonToIsoTranslator.js:1413-1492` builds Token CZ (40 chars) from:
- ATC (4 chars) — from `this.atc` (extracted from B2 token)
- Form factor indicator (2 chars) — mapped from `9F6E` tag via `mapDeviceTypeToFormFactor()`
- ATC validity indicator (1 char)
- Card authentication indicator (1 char)
- Payment initiation channel (1 char)
- Cardholder verification by device (1 char)
- Additional data code (1 char)
- Reserved (29 chars of zeros/spaces)

If `9F6E` is missing (as noted in the EMV validation warnings), the form factor indicator defaults to `'00'`, which may not be a valid PROSA value for contactless transactions. PROSA could reject this.

**Code reference**: `@/lib/Translator/lib/jsonToIsoTranslator.js:1413-1492`, `@/lib/Translator/lib/jsonToIsoTranslator.js:851-852`

---

### Finding 9: Token FS (POS Location) Data Dependencies

**Severity: LOW**

`@/lib/Translator/lib/jsonToIsoTranslator.js:1490-1531` builds Token FS (50 chars) from merchant address data:
- City (13 chars) — from `this.isoAddress.alcaldia`
- State code (3 chars) — from `this.isoAddress.state3code`
- Country code (3 chars) — from `this.isoAddress.countryNumericCode` (defaults to `484`)
- Postal code (10 chars) — from `this.isoAddress.cp`
- Geo coordinates (20 chars) — from env vars `SELIA_LATITUDE` / `SELIA_LONGITUDE`
- User field ACI (1 char) — space

If any address field is missing, it's padded with spaces or zeros. While this shouldn't cause a silent drop, incorrect geo coordinates or missing postal code could cause PROSA validation issues.

**Code reference**: `@/lib/Translator/lib/jsonToIsoTranslator.js:1490-1531`

---

## Transaction Flow Summary

### 1. Message Construction

1. **`tx.service.js` → `parserJsonIso()`**: Entry point. Request body parsed, card data decrypted, BIN lookup, `jsonToIsoTranslator` invoked.
2. **`jsonToIsoTranslator.js` → `packTranBzpay`**: Built ISO 8583 fields including Field 63 tokens (B2/B3/B4, C4, CZ, FA, FS, EY, etc.).
3. **`isoSeliaService.js` → `processISOMessage()`**: Orchestrated Selia message construction.
4. **`isoSeliaService.js` → `buildProductionMessage()`**: Constructed Selia `{field:value;...}` envelope with field 611 containing the ISO message.

### 2. TCP Connection (Successful)

- TCP socket created to `SELIA_ISO_HOST:SELIA_ISO_PORT`
- Connection established, message written to socket

### 3. Timeout (Failure)

- No `data`, `end`, or `error` events from Selia
- 30s timeout fired, socket destroyed
- Promise rejected with `Error: Selia gateway timeout after 30000ms`

---

## Root Cause Analysis

The timeout is caused by Selia (or PROSA) **silently dropping the request** without sending a response. The most likely data issues causing this are:

| Priority | Finding | Impact |
|----------|---------|--------|
| **1** | P-057 not implemented, field 63 overflow risk | Malformed ISO message if tokens > 999 chars |
| **2** | Field 42 length overflow | Corrupt ISO field boundaries if commerce_id > 6 digits |
| **3** | Field 41 length overflow | Corrupt ISO field boundaries if device serial is long |
| **4** | Field 39 in MTI 0200 | Non-standard field may cause PROSA rejection |
| **5** | Field 60 custom pack conflict | Wrong terminal data sent to PROSA |
| **6** | Field 611 not escaped | Selia protocol corruption if ISO data contains `;` |
| **7** | EMV token B2/B3 incomplete data | Zero ARQC/TVR may cause PROSA rejection |
| **8** | Token CZ form factor issues | Invalid contactless data if 9F6E missing |

---

## Code References

| Component | File | Lines |
|-----------|------|-------|
| Field 63 token assembly | `lib/Translator/lib/jsonToIsoTranslator.js` | 794-911 (`fullValue()`) |
| Field 42 construction | `lib/Translator/lib/jsonToIsoTranslator.js` | 1120 |
| Field 41 construction | `lib/Translator/lib/jsonToIsoTranslator.js` | 711 |
| Field 39 in 0200 | `lib/Translator/lib/jsonToIsoTranslator.js` | 1118 |
| Field 60 pack conflict | `lib/iso8583/lib/packager/PROSA.js` | 534-552 |
| Field 611 no escape | `lib/socketServer/lib/services/isoSeliaService.js` | 1657 |
| EMV B2/B3 construction | `lib/emv-packet/lib/emvPacket.js` | 184-345 |
| Token CZ construction | `lib/Translator/lib/jsonToIsoTranslator.js` | 1413-1492 |
| Token FS construction | `lib/Translator/lib/jsonToIsoTranslator.js` | 1490-1531 |
| PROSA field definitions | `lib/iso8583/lib/packager/PROSA.js` | 430-640 |
| PROSA obligatory fields | `lib/iso8583/lib/packager/PROSA.js` | 37-68 |
| Selia message builder | `lib/socketServer/lib/services/isoSeliaService.js` | 1590-1682 |
| TCP send + timeout | `lib/socketServer/lib/services/isoSeliaService.js` | 2235-2402 |

---

## Recommendations

1. **Implement P-057**: Add field 57 definition to PROSA.js (`lll-n`, length 2004) and populate it in `getPacket()` with the same token data as field 63 when field 63 content exceeds 999 chars.

2. **Fix field 42 length**: Truncate or pad `commerce_id` to exactly 6 digits before prepending 9 zeros: `p[42] = this.padLeft(String(this.commerce_id), 15, '0').substring(0, 15)`.

3. **Fix field 41 length**: Change `substr(4, 20)` to `substr(4, 16)` to respect the 16-char field limit.

4. **Remove field 39 from 0200**: Delete `p[39] = '00'` from the 0200 case in `getPacket()`, or verify with PROSA that field 39 is actually required for 0200.

5. **Fix field 60 pack conflict**: Remove the custom `pack` function from PROSA.js field 60 definition, or align it with the `fld60` value built in `jsonToIsoTranslator.js`.

6. **Escape field 611**: Apply `escapeField()` to `processedIsoMessage` before placing it in Selia field 611, or verify that the ISO 8583 message format never produces `;`, `{`, or `}` characters.

7. **Validate EMV data completeness**: Before building B2/B3 tokens, check that critical EMV tags (9F26, 9F27, 95, 9F02, 82, 9F36) are present. Reject or flag transactions with missing critical tags.

8. **Validate field 63 length**: After `fullValue()` is called, check if the result exceeds 999 chars. If so, log a warning and consider using P-057 or truncating non-essential tokens.

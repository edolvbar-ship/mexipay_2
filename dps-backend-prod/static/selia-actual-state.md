# SeliaWebService, MasterCard Token Generation & E-commerce Updates

> Consolidated reference of the current backend state as of the latest commits (HEAD includes changes through **2026-07-29**).
> This document is built from the live source files and the git history of `mexipay-dps-backend`.

---

## 1. SeliaWebService — Current State

### 1.1 Service Location

- Production service: `lib/socketServer/lib/services/seliaWebService.js`
- Imported / instantiated in:
  - `lib/socketServer/lib/routes/api.routes.js`
  - `lib/socketServer/lib/routes/processing/links/ecommerce.links.routes.js`
  - `lib/socketServer/lib/routes/processing/links/affiliatePayments.routes.js`
  - `commands/charge-transaction.js`
  - `commands/cancel-transaction.js`
  - `commands/refund-transaction.js`
  - `commands/trigger-cancel-ecommerce.js`

### 1.2 Constructor Configuration

```javascript
class SeliaWebService {
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.SELIA_HOST || '200.94.104.94',
            port: config.port || process.env.SELIA_PORT || 32003,
            branchId: config.branchId || process.env.SELIA_BRANCH_ID || 16739,
            aesKey: config.aesKey || process.env.SELIA_AES_KEY || 'W0ten03L3rvxC851',
            companyId: config.companyId || process.env.SELIA_COMPANY_ECOMMERCE_ID || 98,
            username: config.username || process.env.SELIA_USERNAME || 'crytest99w3D',
            password: config.password || process.env.SELIA_PASSWORD || 'tac',
            debug: config.debug || process.env.SELIA_DEBUG === 'true' || true,
            inputEncoding: config.inputEncoding || process.env.SELIA_INPUT_ENCODING || 'utf8'
        };
        this.db = config.db || null;
    }
}
```

### 1.3 Multi-tenant `selia_id` Lookup

```javascript
async getSeliaIdForMerchant(merchantId) {
    if (!this.db || !this.db.merchant) {
        return this.config.companyId;
    }
    const merchant = await this.db.merchant.findOne({
        where: { id_merchant: merchantId },
        attributes: ['selia_id']
    });
    return (merchant && merchant.selia_id) ? merchant.selia_id : this.config.companyId;
}
```

### 1.4 Payment Message Builder (`processPayment`)

```javascript
async processPayment(paymentData) {
    const seliaId = paymentData.sandboxTest
        ? 98
        : (paymentData.merchantId
            ? await this.getSeliaIdForMerchant(paymentData.merchantId)
            : this.config.companyId);

    const message = await this.buildPaymentMessage(paymentData, seliaId);
    const response = await this.sendHttpsRequest(message);
    return await this.parseSeliaResponse(response);
}

async buildPaymentMessage(paymentData, seliaId) {
    const { cardNumber, amount, cvv, expiration, transactionType = '501', entryMode = '81', terminalId = '1' } = paymentData;
    const timestamp = this.generateSeliaTimestamp();
    const ticketNumber = this.generateTicketNumber();
    const randomField = this.generateRandomField();
    const tokenData = await this.getMerchantTokenData(paymentData.merchantId);

    let message = `{161:${seliaId};`;
    message += paymentData.sandboxTest ? `1:16739;` : `1:1;`;
    message += `2:${terminalId};`;
    message += `3:${timestamp};`;
    message += `7:${transactionType};`;
    message += `56:0;`;
    message += `45:${amount};`;
    message += `58:${entryMode};`;
    message += `54:${this.config.username};`;
    message += `219:${this.config.password};`;

    if (tokenData.p43) message += `43:${tokenData.p43};`;
    if (tokenData.ft) message += `614:${tokenData.ft};`;
    if (tokenData.ha) message += `615:${tokenData.ha};`;
    if (tokenData.hb) message += `616:${tokenData.hb};`;
    if (tokenData.fs) message += `617:${tokenData.fs};`;

    const encryptedData = this.encryptSensitiveFields({ cardNumber, expiration, cvv, ticketNumber, randomField });
    message += `465:${encryptedData}}`;
    return message;
}
```

### 1.5 RC4 Encryption

Sensitive fields are joined into a `;`-delimited string and encrypted with RC4 using `this.config.aesKey`:

```javascript
encryptSensitiveFields(fields) {
    const fieldsToEncrypt = [
        `35:${fields.cardNumber}`,
        `37:${fields.expiration}`,
        `73:${fields.cvv}`,
        `19:${fields.ticketNumber}`,
        `604:${fields.randomField}`
    ];
    const dataToEncrypt = fieldsToEncrypt.join(';');
    const key = this.config.aesKey;
    const encrypted = this.rc4(dataToEncrypt, key);
    return Buffer.from(encrypted).toString('hex').toUpperCase();
}

rc4(input, key) {
    const bytes = Buffer.from(input, 'ascii');
    const keyBytes = Buffer.from(key, 'ascii');
    const s = new Uint8Array(256);
    const k = new Uint8Array(256);
    let j = 0;

    for (let i = 0; i < 256; i++) {
        s[i] = i;
        k[i] = keyBytes[i % keyBytes.length];
    }

    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + k[i]) % 256;
        [s[i], s[j]] = [s[j], s[i]];
    }

    let i = 0; j = 0;
    const output = new Uint8Array(bytes.length);
    for (let x = 0; x < bytes.length; x++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        [s[i], s[j]] = [s[j], s[i]];
        const t = (s[i] + s[j]) % 256;
        output[x] = bytes[x] ^ s[t];
    }

    return output;
}
```

### 1.6 AN 6022 Merchant Token Data (`getMerchantTokenData`)

Builds the tokens `FT`, `HA`, `HB`, `FS` and the `P-43` subdivision field. The formats are left/right-padded to fixed sizes.

```javascript
async getMerchantTokenData(merchantId) {
    const DEFAULT_URL = 'www.taakpay.com';
    const DEFAULT_STREET = 'AV SIEMPRE VIVA';
    const DEFAULT_PHONE = '00000000000';
    const DEFAULT_GEO_COORD = process.env.SELIA_DEFAULT_GEO_COORD || '19.4326,-99.1332';
    const DEFAULT_SERVICE_GEO_COORD = process.env.SELIA_DEFAULT_SERVICE_GEO_COORD || DEFAULT_GEO_COORD;
    const DEFAULT_COUNTRY_SUBDIVISION = 'CDMX';

    let url = DEFAULT_URL;
    let streetAddr = DEFAULT_STREET;
    let phone = DEFAULT_PHONE;
    let countrySubdivision = DEFAULT_COUNTRY_SUBDIVISION;
    let geoCoord = DEFAULT_GEO_COORD;
    let serviceGeoCoord = DEFAULT_SERVICE_GEO_COORD;
    let merchantName = '';
    let rfc = '';
    let city = '';
    let stateCode = '';
    let postalCode = '';

    if (merchantId && this.db && this.db.merchant) {
        try {
            const merchant = await this.db.merchant.findOne({
                where: { id_merchant: merchantId },
                include: [{
                    model: this.db.datosDireccion,
                    as: 'datos_direccion',
                    required: false
                }],
                attributes: ['url_merchant', 'tel1_contact', 'id_direccion', 'name_merchant', 'rfc_merchant']
            });
            if (merchant) {
                if (merchant.url_merchant) url = merchant.url_merchant;
                if (merchant.tel1_contact) phone = merchant.tel1_contact;
                if (merchant.name_merchant) merchantName = merchant.name_merchant;
                if (merchant.rfc_merchant) rfc = merchant.rfc_merchant;
                const addr = merchant.datos_direccion;
                if (addr) {
                    const parts = [addr.calle, addr.no_ext].filter(Boolean).join(' ').trim();
                    if (parts) streetAddr = parts;
                    if (addr.ciudad) city = addr.ciudad;
                    if (addr.cp) postalCode = addr.cp;
                    if (addr.id_state && this.db.cisoState) {
                        const state = await this.db.cisoState.findOne({
                            where: { id_state: addr.id_state },
                            attributes: ['name']
                        });
                        if (state && state.name) {
                            countrySubdivision = state.name;
                            stateCode = state.name.substring(0, 3).toUpperCase();
                        }
                    }
                }
            }
        } catch (error) { /* fallback to defaults */ }
    }

    const padField = (val, len) => String(val || '').substring(0, len).padEnd(len, ' ');

    // Token FT — Acceptor Address Data (Mastercard anuncio 6022)
    const ftData = padField(phone, 20) + padField(streetAddr, 25) + padField('M', 1) + padField(merchantName, 40) + padField('', 34);
    const ft = `! FT${String(ftData.length).padStart(5, '0')} ${ftData}`;

    // Token HA — Website Token
    const urlPadded = padField(url, 255);
    const urlLgth = String(padField(url, 255).trim().length).padStart(3, '0');
    const haData = urlLgth + urlPadded;
    const ha = `! HA${String(haData.length).padStart(5, '0')} ${haData}`;

    // Token HB — Contact Token
    const hbData = padField('06', 2) + padField('', 2) + padField(phone, 20) + padField('', 25) + padField(rfc, 21) + padField('', 6) + padField(geoCoord, 20) + padField('', 4);
    const hb = `! HB${String(hbData.length).padStart(5, '0')} ${hbData}`;

    // Token FS — Service Location Token (Mastercard anuncio 6022)
    const fsData = padField(city, 13) + padField(stateCode, 3) + padField('MEX', 3) + padField(postalCode, 10) + padField(serviceGeoCoord, 20) + padField('', 1);
    const fs = `! FS${String(fsData.length).padStart(5, '0')} ${fsData}`;

    return { ft, ha, hb, fs, p43: countrySubdivision };
}
```

### 1.7 Reversal and Query Helpers

```javascript
async reverseTransaction(transactionId, authorizationCode, amount, maskedCardNumber, expiration, merchantId = null, transactionType = '502', seliaId = null) { ... }
async queryTransaction(transactionId, authorizationCode, amount, maskedCardNumber, expiration, merchantId = null) { ... }
```

Both build a Selia request string with the merchant-specific `selia_id` and include the original transaction identifiers in fields `35`, `37`, `45`, `50`, `74`, plus the AN 6022 tokens.

---

## 2. MasterCard Token Generation ("anuncio" / 3DS context)

### 2.1 3D Secure / UCAF Tokens (`lib/Translator/lib/jsonToIsoTranslator.js`)

For e-commerce transactions with `cardBrand === 'MASTERCARD'`, the translator produces the following tokens when 3DS data is present:

```javascript
if (cardBrand === "MASTERCARD") {
    // Token C0[10] — Auth collector indicator
    token_C0._10 = '2'; // MasterCard 3DS indicator

    // Token CE — MasterCard UCAF Authentication Data
    token_CE._1 = "01"; // UCAF collection indicator
    token_CE._2 = this.padRight(this._3dsData.authenticationValue, 200, " "); // UCAF data
    token_CE.fullToken = this.buildTkn(token_CE.name, token_CE._1 + token_CE._2);

    // Token RJ — 3DS Common Data
    let version3DS = !!this._3dsData.messageVersion
        ? this._3dsData.messageVersion.substring(0,1)
        : "0";
    version3DS = version3DS === "1" || version3DS === "2" ? version3DS : "0";
    token_RJ._1 = this.padRight(version3DS, 2, " ");
    token_RJ._2 = this._3dsData.dsTransID; // Directory Server Transaction ID
}
```

- **Token C0[5]**: ECI mapping (`2→5`, `1→6`, `0→7`).
- **Token C0[10]**: `2` for MasterCard 3DS.
- **Token CE**: UCAF collection indicator `01` + `authenticationValue` padded to 200 chars.
- **Token RJ**: 3DS version + `dsTransID`.

### 2.2 MasterCard Payment Facilitator / Sales Org Token (`Token FA`)

```javascript
case 'MASTERCARD':
default:
    const mcFac = this.merchant?.mc_pymnt_facilitator;
    token = this.padLeft((mcFac !== undefined && mcFac !== null) ? String(mcFac) : '0', 11, '0');
```

The `FA` token is 50 chars total: `pmnt_facilitator_id(11) + idpnt_sales_org_id(11) + sub_mrch_id(15) + rtlr_ind(3) + cntry_cde(3) + user_fld_aci(7)`.

### 2.3 InitKeys / DUKPT Tokens (`lib/socketServer/lib/services/isoSeliaService.js`)

These are relevant to the MasterCard/PROSA key-exchange flow using Token `ES`, `EW`, and `EX`.

#### `buildTokenES` — Terminal Identification

```javascript
buildTokenES(params) {
    const { softwareVersion = 'SEV820v02_25', pinpadSerial = '', cryptoConfig = '5', ... } = params;
    const sc1 = String(softwareVersion).padEnd(20, ' ').substring(0, 20);
    const sc2 = String(pinpadSerial).padEnd(20, ' ').substring(0, 20);
    const sc3 = cryptoConfig;
    const sc4 = '00000000';
    const sc5 = '00000000';
    const sc6 = '00';
    const sc7 = '1'; // new key flag
    const tokenData = sc1 + sc2 + sc3 + sc4 + sc5 + sc6 + sc7;
    return this.buildSeliaToken('ES', tokenData);
}
```

#### `buildTokenEW` — RSA-Encrypted Transport Key

```javascript
buildTokenEW(params) {
    const { rsaEncryptedKey, checkValue, rsaKeyVersion, paddingAlgorithm = '02' } = params;
    const sc1 = String(rsaEncryptedKey || '').toUpperCase().padEnd(512, '0').substring(0, 512);
    const sc2 = String(checkValue || '000000').padStart(6, '0').substring(0, 6);
    const sc3 = String(rsaKeyVersion || '').padEnd(10, ' ').substring(0, 10);
    const sc4 = String(paddingAlgorithm).substring(0, 2);
    const sc5 = calcCrc32(sc1); // CRC32 over the 512-char RSA-encrypted key
    const tokenData = sc1 + sc2 + sc3 + sc4 + sc5;
    return this.buildSeliaToken('EW', tokenData);
}
```

EW length: 538 chars (512 + 6 + 10 + 2 + 8).

#### `parseTokenEX` — DUKPT IPEK Response

```javascript
parseTokenEX(tokenEXData) {
    if (!tokenEXData || tokenEXData.length < 68) return null;
    const status = tokenEXData.substring(58, 60);
    return {
        encryptedNewKey: tokenEXData.substring(0, 32),
        ksn: tokenEXData.substring(32, 52),
        checkValue: tokenEXData.substring(52, 58),
        status: status,
        crc32: tokenEXData.substring(60, 68),
        statusDescription: statusDescriptions[status] || 'Unknown status'
    };
}
```

### 2.4 New Selia Key-Init Message Format

```javascript
async buildKeyInitMessage(data) {
    const { deviceSerial, rsaEncryptedKey, checkValue, rsaKeyVersion, paddingAlgorithm = '02', seliaId } = data;
    const tknES = this.buildTokenES({ softwareVersion: 'SEV820v02_25', pinpadSerial: deviceSerial, cryptoConfig: '5', newKeyFlag: '1' });
    const tknEW = this.buildTokenEW({ rsaEncryptedKey, checkValue, rsaKeyVersion, paddingAlgorithm });

    let message = process.env.SELIA_ISO_MODE !== 'Prod'
        ? "{161:1;"
        : "{161:" + seliaId + ";";
    message += `7:506;`;     // dedicated key init transaction code
    message += `1:1;`;
    message += `2:${this.escapeField(nodoDigits)};`;
    message += `3:${this.generateProductionTimestamp()};`;
    message += `19:0;`;
    message += `331:${tknES};`;
    message += `332:${tknEW};`;
    message += `4:2;`;
    message += `54:${this.escapeField(this.config.username)};`;
    message += `219:${this.escapeField(this.config.password)};`;
    message += `356:${this.config.posVersion || 'SeliaPos V5.98'};`;
    message += `901:${this.config.keyInitPort || '9327'};`;
    message += "}";
    return message;
}
```

### 2.5 Important Notes on MasterCard / PROSA Tokens

- `FT`, `FS`, and `HI` are explicitly linked in `static/approvedISO.md` to MasterCard announcements **6022** and **7102**.
- The 3DS tokens (`C0`, `CE`, `RJ`) support MasterCard UCAF / 3-D Secure 1.x / 2.x.
- P-057 Expanded Token Buffer is now defined in `lib/iso8583/lib/packager/PROSA.js`:

```javascript
57: {
    length: 2004,
    name: 'P-057 Expanded Token Buffer',
    type: 'lll-n',
    alias: '',
}
```

---

## 3. E-commerce Updates Performed After 2026-07-17

### 3.1 Git Commits After 2026-07-17

```
a90cc5d  2026-07-29  chore: add build scripts and configuration files
21f35fe  2026-07-29  feat: transaction services and route updates
41c7f07  2026-07-29  feat: EMV packet processing and tag validation improvements
94d76e6  2026-07-29  feat: add PROSA P-057 expanded token buffer and packager updates
27ad8f7  2026-07-29  feat: update Selia key initialization flow and routes
0297aee  2026-07-29  docs: update env examples, gitignore and initKeys service plan
693b1b4  2026-07-25  fix(emv): fallback digital wallet detection when 9F6E is not sent
ff5c996  2026-07-25  docs: clarify Selia vs PROSA fields in open questions section
99b464a  2026-07-25  docs: mark Phase C as implemented in integration plan
154a3e9  2026-07-25  feat(pin-online): Phase D+E — forward Token EP in Field 63, suppress Field 52
a63e264  2026-07-25  feat(initKeys): Phase A+B — parse Token EX and return DUKPT keys to terminal
3632429  2026-07-25  feat(emv): Phase 001 — relax CVM + digital wallet validation for contactless
```

### 3.2 E-commerce Route File (`lib/socketServer/lib/routes/processing/ecommerce.routes.js`)

```javascript
const router = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');
const { seccion } = require('../../services/3ds.service');

router.post('/charge', seccion, (req, res) => { parserJsonIso(req, res, 200, '00', '09', '1', '4'); });
router.post('/cancel/:id', (req, res) => { parserJsonIso(req, res, 220, '02', '09', '1', '6'); });
router.post('/refund/:id', (req, res) => { parserJsonIso(req, res, 200, '20', '09', '1', '7'); });
router.post('/reverse/:id', (req, res) => { parserJsonIso(req, res, 420, '00', '09', '1', '16'); });
router.post('/preauth', (req, res) => { parserJsonIso(req, res, 200, '00', '09', '0', '18'); });
router.post('/postauth/:id', (req, res) => { parserJsonIso(req, res, 220, '20', '03', "1", "19"); });

module.exports = router;
```

Supported operations: **charge, cancel, refund, reverse, pre-authorization, post-authorization (capture)**.

### 3.3 E-commerce Link & Affiliate Routes (`lib/socketServer/lib/routes/processing/links/ecommerce.links.routes.js`)

New / updated endpoints added after 7/17:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/affiliate/payment` | Direct affiliate payment with `SeliaWebService` and merchant-specific `selia_id` lookup. Creates `linksPago`, stores ISO message, calls Selia, saves S3 transaction object, updates `iso_message` and `linksPago`. |
| `GET`  | `/payment-link` | Validates a payment link by token, returns link details and allowed MSI plans. |
| `POST` | `/payment/payout` | Payout / disbursement through the e-commerce charge endpoint. |
| `POST` | `/payment2` | 3DS reference lookup by `reference` or `name_merchant`. |
| `POST` | `/payment/selia` | Direct Selia payment with robust `MM/YY` and `YY/MM` expiration parsing, sandbox/dummy support, and field-50 bank authorization extraction. |
| `GET`  | `/iso3166` | Returns ISO 3166 country list. |

### 3.4 3DS E-commerce Verification (`lib/socketServer/lib/routes/processing/3ds.ecommerce.routes.js`)

```javascript
router.get('/very/charge/:referencia', statusLink, async (req, res) => { ... });
router.post('/very/charge', status, async (req, res) => { ... });
```

These routes replay stored 3DS headers to `POST /gateway/v1/ecommerce/charge` and update the `linksPago` status based on the result.

### 3.5 `SeliaWebService` E-commerce Integration Changes

- Constructor now accepts `db` for merchant `selia_id` lookup.
- `processPayment` uses `getSeliaIdForMerchant(merchantId)` instead of a hard-coded `SELIA_COMPANY_ECOMMERCE_ID`.
- `buildPaymentMessage` now adds merchant-specific AN 6022 tokens `FT`, `HA`, `HB`, `FS`, and field `P-43`.
- `extractBankAuthorizationCode` returns field `50` (6-char bank authorization) for e-commerce responses.

### 3.6 PROSA / Translator Changes

- `lib/Translator/lib/jsonToIsoTranslator.js`: Added `token_ep` in constructor and includes `tknEP` in Field 63 token buffer; suppresses PIN `Field 52` when Token EP is present.
- `lib/socketServer/lib/services/tx.service.pro.js` and `tx.service.js`: Extract `token_ep` from `cardInformation.token_ep` and pass it through.
- `lib/iso8583/lib/packager/PROSA.js`: Added field `57` as P-057 Expanded Token Buffer (`lll-n`, length 2004).

---

## 4. Environment Variables Used

| Variable | Purpose |
|----------|---------|
| `SELIA_HOST` / `SELIA_PORT` | Selia gateway endpoint |
| `SELIA_BRANCH_ID` | Development branch ID fallback |
| `SELIA_AES_KEY` | RC4 / AES key for Selia encryption |
| `SELIA_COMPANY_ECOMMERCE_ID` | Default Selia company ID for e-commerce |
| `SELIA_USERNAME` / `SELIA_PASSWORD` | LDI gateway credentials |
| `SELIA_DEBUG` | Enable verbose logging |
| `SELIA_DEFAULT_GEO_COORD` / `SELIA_DEFAULT_SERVICE_GEO_COORD` | Default geolocation for `FS` token |
| `SELIA_ISO_MODE` | `Dev`/`Prod` switch for `IsoSeliaService` |
| `SELIA_ISO_DEV_HOST` / `SELIA_ISO_DEV_PORT` | Dev ISO gateway override |
| `SELIA_POS_VERSION` | Default POS version, e.g. `SeliaPos V5.98` |
| `SELIA_KEY_INIT_PORT` | Key init endpoint ID, default `9327` |
| `MTIP_STRICT` | MasterCard contactless MTIP strict mode |

---

## 5. Key Files Referenced

| File | Relevance |
|------|-----------|
| `lib/socketServer/lib/services/seliaWebService.js` | Production Selia HTTPS / RC4 service |
| `lib/socketServer/lib/services/isoSeliaService.js` | ISO 8583 / Selia key init (Token ES/EW/EX) |
| `lib/Translator/lib/jsonToIsoTranslator.js` | 3DS, UCAF, token FA, P-057 handling |
| `lib/socketServer/lib/routes/processing/ecommerce.routes.js` | Main e-commerce operation routes |
| `lib/socketServer/lib/routes/processing/links/ecommerce.links.routes.js` | New e-commerce / affiliate / payout routes |
| `lib/socketServer/lib/routes/processing/3ds.ecommerce.routes.js` | 3DS verification replay routes |
| `lib/socketServer/lib/routes/processing/processing.routes.js` | `/initKeys` endpoint calling `sendKeyInitialization` |
| `lib/iso8583/lib/packager/PROSA.js` | PROSA field / token definitions including P-057 |
| `docs/initKeys-service-plan.md` | Key init architecture and token specs |

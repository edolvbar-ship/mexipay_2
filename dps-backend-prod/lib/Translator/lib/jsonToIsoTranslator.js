/* eslint-disable no-useless-concat */
/* eslint-disable eqeqeq */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-param-reassign */
/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-concat */
/* eslint-disable eqeqeq */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-param-reassign */
/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
//
// This file contains the logic for converting JSON data to ISO 8583 messages
// lib/Translator/lib/jsonToIsoTranslator.js
//
const moment = require('moment');
const iso8583Packet = require('../../iso8583-packet');
const helpers = require('../../helpers');

/**
 * ISO 8583 Transaction Packer for BzPay Payment System
 * Handles construction of ISO 8583 messages for various transaction types
 * including purchases, reversals, authorizations, and 3D Secure transactions
 */



class packTranBzpay {
    /**
     * Constructor - Initializes transaction data and prepares ISO 8583 message components
     * @param {Object} data - Main transaction data object
     * @param {string} commerce_id - Merchant identifier
     * @param {string} commerce_name - Merchant name
     * @param {string} system_fiid - Financial institution ID
     * @param {string} mcc - Merchant category code
     * @param {string} msgType - ISO 8583 message type (0200, 0220, 0420, 0800)
     * @param {string} typeTran - Transaction type processing code
     * @param {Object} binData - Card BIN information
     * @param {Object} checkOutData - Original transaction data for reversals
     * @param {string} tknQ2 - Token Q2 type indicator
     * @param {string} dftCpt - Deferred capture flag
     * @param {string} fld35 - Track 2 data (optional)
     */
    constructor(
        data,
        commerce_id,
        commerce_name,
        system_fiid,
        mcc,
        msgType,
        typeTran,
        binData,
        checkOutData,
        tknQ2,
        dftCpt,
        track2Data = null,
    ) {

    // SAFEGUARD: Ensure checkOutData exists and has expected properties
    if (!checkOutData || typeof checkOutData !== 'object') {
        checkOutData = {};
    }

    // Initialize with defaults if properties are undefined
    checkOutData = {
        msg_type: checkOutData.msg_type || undefined,
        reference_number: checkOutData.reference_number || undefined,
        authorization: checkOutData.authorization || undefined,
        amount: checkOutData.amount || undefined,
        entry_mode: checkOutData.entry_mode || undefined, // 🔴 ADD ENTRY MODE
        tran_date: checkOutData.tran_date || undefined,
        tran_time: checkOutData.tran_time || undefined,
        capture_date: checkOutData.capture_date || undefined,
        tkn_data_63_rq: checkOutData.tkn_data_63_rq || undefined,
        tkn_data_63_rp: checkOutData.tkn_data_63_rp || undefined
    };
        // ========================================================================
        // SECTION 1: INITIAL DATA ASSIGNMENT AND VALIDATION
        // ========================================================================


        // Basic merchant and transaction identification
        this.commerce_id = commerce_id;
        this.commerce_name = commerce_name;
        this.merchant = data.req.merchantData; // Complete merchant profile data
        const esquema = this.merchant.id_esquema;

        // Handle different merchant schemes - Esquema 3 uses sub-affiliation number
        this.commerce_id = esquema === 3 ? this.merchant.subafiliation_number : commerce_id;
        this.mcc = mcc; // Merchant Category Code
        this.binData = binData; // Card BIN information (brand, type, etc.)
        this.typeTran = typeTran; // Transaction type code

        // ========================================================================
        // SECTION 2: REVERSAL/ORIGINAL TRANSACTION DATA PRESERVATION
        // ========================================================================

        // Store original transaction data for reversals and follow-ons
        this.reverseMsgType = checkOutData.msg_type; // Original message type
        this.reverseSecNum = checkOutData.reference_number; // Original STAN
        this.reverseAuthNum = checkOutData.authorization; // Original auth code
        this.revereseAmount = checkOutData.amount; // Original amount
        this.revereseEntryMode = checkOutData.entry_mode; // 🔴 ORIGINAL ENTRY MODE
        this.revereseTranDate = checkOutData.tran_date; // Original transaction date
        this.revereseTranTime = checkOutData.tran_time; // Original transaction time
        this.revereseCptDate = checkOutData.capture_date; // Original capture date
        this.revereseTknData63 = checkOutData.tkn_data_63_rq; // Original field 63 data
        this.orgResTknData63 = checkOutData.tkn_data_63_rp; // Original response field 63

        // Add this in the constructor after line 50
        console.log('🔍 [packTranBzpay] DEBUG checkOutData values:');
        console.log('- reverseAuthNum:', this.reverseAuthNum, 'type:', typeof this.reverseAuthNum);
        console.log('- revereseEntryMode:', this.revereseEntryMode, 'type:', typeof this.revereseEntryMode); // 🔴 ADD ENTRY MODE LOG
        console.log('- revereseTranDate:', this.revereseTranDate, 'type:', typeof this.revereseTranDate);
        console.log('- revereseTranTime:', this.revereseTranTime, 'type:', typeof this.revereseTranTime);
        console.log('- revereseCptDate:', this.revereseCptDate, 'type:', typeof this.revereseCptDate);
        console.log('- reverseSecNum:', this.reverseSecNum, 'type:', typeof this.reverseSecNum);

        // Check for string "undefined"
        const checkString = (value, name) => {
            if (typeof value === 'string' && value.includes('undefined')) {
                console.log(`🚨 ${name} contains "undefined" string:`, value);
            }
            if (value === undefined) {
                console.log(`⚠️ ${name} IS undefined (not string)`);
            }
        };
        checkString(this.reverseAuthNum, 'reverseAuthNum');
        checkString(this.revereseEntryMode, 'revereseEntryMode'); // 🔴 CHECK ENTRY MODE
        checkString(this.revereseTranDate, 'revereseTranDate');
        checkString(this.revereseTranTime, 'revereseTranTime');
        checkString(this.revereseCptDate, 'revereseCptDate');
        checkString(this.reverseSecNum, 'reverseSecNum');
        // ========================================================================
        // SECTION 3: TRANSACTION SPECIFIC DATA AND CONFIGURATION
        // ========================================================================

        this.isoType = data.isoType; // ISO network type
        this.device = data.device; // Terminal/device information
        this.rsa_name = data.rsa_name; // RSA encryption identifier
        this.check_value = data.check_value; // Data validation checksum
        this.crc32 = data.crc32 ? data.crc32.toUpperCase() : null; // CRC32 validation
        this.cardInformation = data.cardInformation; // Card data (number, expiry, CVV)
        this.amount = data.amount; // Transaction amount
        this.reference = data.reference; // Transaction reference number
        this.entry_mode = data.entry_mode; // Card entry method (chip, manual, etc.)
        this.authentication = data.authentication; // Authentication type
        this.reverseCode = data.reverseCode; // Reversal reason code
        this.chargePlan = data.chargePlan; // Installment plan data
        this.currency = data.currency; // Currency code
        this.forcedTransaction = data.forcedTransaction; // Force transaction flag
        this.authCollectorIndicator = data.authCollectorIndicator; // Auth collection method
        this.fraudPropentionFlag = data.fraudPropentionFlag; // Fraud risk indicator
        this.cavvValidationResult = data.cavvValidationResult; // CAVV validation result
        this.contract = data.contract; // Recurring contract reference

        // ========================================================================
        // SECTION 4: TOKEN AND EMV DATA INITIALIZATION
        // ========================================================================

        // Initialize token containers for EMV and proprietary data
        this.tokenB2 = ''; // EMV token B2 - transaction data
        this.tokenB3 = ''; // EMV token B3 - additional data
        this.tokenB4 = ''; // EMV token B4 - terminal data
        this.cvm_rslts = ''; // Cardholder Verification Method results
        this.msg_type = msgType; // ISO message type
        this.dftCpt = dftCpt; // Deferred capture indicator

        // Network and routing configuration with null checks
        this.system_fiid = this.merchant?.banco_adq?.fiid || 'P468'; // Acquirer FIID with null check
        this.logical_network = this.merchant?.iso_logical_network?.ln || ''; // Logical network with null check
        this.rsa = data.rsa ? data.rsa.toUpperCase() : null; // RSA encryption flag

        // ========================================================================
        // SECTION 5: 3D SECURE AND ADVANCED AUTHENTICATION DATA
        // ========================================================================

        this._3dsData = data.response3ds; // 3D Secure authentication data
        this.isoAddress = data.isoAddress; // Merchant location data
        this.isQPS = data.qps || false; // Quick Payment Service flag
        this.deviceTypeIndicator; // Contactless device type indicator
        this.atc; // Application Transaction Counter (EMV)
        this.tknQ2 = tknQ2; // Token Q2 type
        this.paymentChannel = data.req.body.paymentChannel ?? "00"; // Payment channel (e-commerce, etc.)

        // MTIP strict mode for Mastercard contactless validation
        this.mtipStrict = process.env.MTIP_STRICT || false;

        // Validate and format payment channel (2 digits, zero-padded)
        if(/^\d{1,2}$/.test(this.paymentChannel)){
            this.paymentChannel = this.padLeft(this.paymentChannel, 2, '0')
        }else{
            this.paymentChannel = "00" // Default to e-commerce
        }

        // Debug output for RSA initialization transactions
        if (this.rsa) {
            dd('================================= Es una operacion de inicializacion ===========================');
        }

        // ========================================================================
        // SECTION 6: ARQC VERIFICATION AND EMV DATA PROCESSING
        // ========================================================================

        // Extract ARQC verification result from original response data
        if (this.orgResTknData63) {
            // Look for ARQC verification result in token B4 data
            if (this.orgResTknData63.includes('! B400020')) {
                this.arqc_vrfy = this.orgResTknData63.substring(
                    this.orgResTknData63.indexOf('! B400020') + 28,
                    this.orgResTknData63.indexOf('! B400020') + 29
                );
            } else {
                this.arqc_vrfy = 0; // Default to no ARQC verification
            }
        } else {
            this.arqc_vrfy = 0; // No original data available
        }

        // ========================================================================
        // SECTION 7: EMV TAG PROCESSING AND TOKEN EXTRACTION
        // ========================================================================

        // Prepare date components for default values
        const tran_year = this.padLeft(new Date().getUTCFullYear(), 2, '0');
        const tran_month = this.padLeft(new Date().getUTCMonth() + 1, 2, '0');

        // Process EMV tags if present (chip transactions)
        if (this.cardInformation && this.cardInformation.emv_tags) {
            const emv63 = require('../../../lib/emv-packet').unpack55t063(
                this.cardInformation.emv_tags,
            );
            // Extract tokens from EMV data
            this.tokenB2 = emv63.tokenB2; // Transaction-specific data
            this.tokenB3 = emv63.tokenB3; // Additional EMV data
            this.tokenB4 = emv63.tokenB4 || '  '; // Terminal data or spaces
            this.cvm_rslts = emv63.cvm_rslts; // Card verification results
            this.deviceTypeIndicator = emv63.deviceTypeIndicator || ''; // Contactless device type
            this.atc = emv63.atc; // Application Transaction Counter
        }

        // ========================================================================
        // SECTION 8: AMOUNT FORMATTING AND VALIDATION
        // ========================================================================

        // Format amount to ISO 8583 specification (12 digits, no decimal)
        if (this.amount) {
            // 🔴 FIXED: Check if amount is already in cents (no decimal point)
            if (typeof this.amount === 'string' && !this.amount.includes('.')) {
                // Amount is already in cents format (e.g., "1151")
                this.amount = this.padLeft(this.amount, 12, '0');
                console.log('🔧 [packTranBzpay] Amount already in cents:', this.amount, '(padded)');
            } else {
                // Amount is in dollars format, convert to cents
                const entero = Math.floor(this.amount).toString(); // Integer part
                const decimal = (this.amount - entero).toFixed(2).substring(2); // Decimal part
                this.amount = entero.toString() + decimal.toString(); // Combine without decimal
                this.amount = this.padLeft(this.amount, 12, '0'); // Zero-pad to 12 digits
                console.log('🔧 [packTranBzpay] Amount converted from dollars:', this.amount, '(cents)');
            }
        } else if (this.revereseAmount) {
            this.amount = this.revereseAmount; // Use original amount for reversals
        } else {
            this.amount = '000000000000'; // Default zero amount
        }

        // ========================================================================
        // SECTION 9: TOKEN CONSTRUCTION - INITIALIZATION
        // ========================================================================

        // Token C0 - E-commerce and Security Indicators
        let token_C0 = {};

        // C0[5] - E-commerce/authentication indicator
        // Maps authentication types to specific codes
        token_C0._5 = (this.authentication === "unknown" ? "7" : "") +
            (this.authentication === "mail_tel" ? "1" : "") +
            (this.authentication !== "unknown" && this.authentication !== "mail_tel"? " ": "");

        // Override with contract indicator if recurring transaction
        token_C0._5 = this.contract ? "0" : token_C0._5;

        // C0[10] - Auth collector indicator (default space)
        token_C0._10 = ' ';

        // Token CE - MasterCard UCAF Authentication Data
        let token_CE = {
            name : "CE",
            _1 : "", // UCAF indicator
            _2 : "", // Authentication value
            fullToken : "",
        };

        // Token C6 - Visa Authentication Data
        let token_C6 = {
            name : "C6",
            _1 : "", // DS Transaction ID
            _2 : "", // Authentication value (hex)
            fullToken : "",
        };

        // Token RJ - 3D Secure Common Data
        let token_RJ = {
            name : "RJ",
            fullToken : "",
            _1 :  this.padRight( "0" ,2 ," "), // 3DS version or auth method
            _2 :  this.padRight( "" ,36 ," "), // DS Transaction ID
            _3 :  this.padRight( "" ,2 ," "), // Reserved for future use
        };

        // Determine card brand for brand-specific processing
        const cardBrand = !this.binData.brand ? 'GENERAL' : this.binData.brand.toUpperCase();
        dd('Brand: '+cardBrand);

        // ========================================================================
        // SECTION 10: 3D SECURE PROCESSING LOGIC
        // ========================================================================

        // Process 3D Secure data if available
        if(!!this._3dsData){
            dd('================================= Es una operacion con 3DS ===========================');

            //=========================================== TOKEN C0[5] - ECI MAPPING ===========================================
            const eciValue = Number(this._3dsData.eci).toString();

            // Map ECI values to internal codes:
            // ECI 2 → 5 (Fully authenticated)
            // ECI 1 → 6 (Attempts processing)
            // ECI 0 → 7 (Not authenticated)
            token_C0._5 = eciValue == 2 ? 5 : eciValue == 1 ? 6 : eciValue == 0 ? 7 : eciValue;

            // Brand-specific 3DS processing
            if( cardBrand === "MASTERCARD" ){
                // =========================================== TOKEN C0[10] - AUTH COLLECTOR ===========================================
                token_C0._10 = '2'; // MasterCard 3DS indicator

                // =========================================== TOKEN CE - MASTERCARD UCAF ===========================================
                token_CE._1 = "01"; // UCAF collection indicator
                token_CE._2 = this.padRight( this._3dsData.authenticationValue, 200 , " "); // UCAF data
                token_CE.fullToken = this.buildTkn( token_CE.name , token_CE._1 + token_CE._2 );

                // =========================================== TOKEN RJ MASTERCARD - 3DS VERSION ================================
                // Extract and validate 3DS version (1.x or 2.x)
                let version3DS = !!this._3dsData.messageVersion ?
                    this._3dsData.messageVersion.substring(0,1):
                    "0";
                version3DS = version3DS === "1" || version3DS === "2" ? version3DS : "0" ;
                token_RJ._1 = this.padRight( version3DS ,2," ");
                token_RJ._2 = this._3dsData.dsTransID; // Directory Server Transaction ID
            }

            if( cardBrand === "VISA" ){
                // =========================================== TOKEN C0[10] - AUTH COLLECTOR ===========================================
                token_C0._10 = '0'; // Visa 3DS indicator

                // =========================================== TOKEN C6 - VISA AUTH DATA ===========================================
                token_C6._1 = this.padRight('' ,40," "); // Reserved space
                // Convert base64 authentication value to hex
                token_C6._2 = this.padLeft(
                    Buffer.from(this._3dsData.authenticationValue, 'base64').toString('hex'),
                    40,
                    "0"
                );
                token_C6.fullToken = this.buildTkn( token_C6.name , token_C6._1 + token_C6._2 );

                // =========================================== TOKEN RJ VISA - AUTH METHOD =======================================
                // Map Visa auth methods to internal codes
                let authMethod;
                switch(this._3dsData.authMethod){
                    case '01': authMethod = 'D'; break; // Frictionless authentication
                    case '02': authMethod = 'A'; break; // Challenge authentication
                    default: authMethod = 'B'; // Default/fallback
                }
                token_RJ._1 = this.padRight( authMethod ,2," ");
            }

            // =========================================== TOKEN RJ COMMON - FINAL ASSEMBLY =======================================
            token_RJ.fullToken = this.buildTkn( token_RJ.name , token_RJ._1 + token_RJ._2 + token_RJ._3 );
        }
        // End 3DS processing section

        // ========================================================================
        // SECTION 11: TOKEN FA - PAYMENT FACILITATOR DATA
        // ========================================================================

        let token_FA = { fullToken :  '' };
        // Only include FA token for non-AGP, non-initialization, non-scheme-1 transactions
        if( ! this.isAGP() && ! this.rsa && this.merchant.id_esquema != 1){
            token_FA = {
                name : "FA",
                _1 :  this.getFacilitatorToken(cardBrand), // Payment facilitator ID (11 chars)
                _2 :  this.getSaleOrganizarionToken(cardBrand), // Sales organization ID (11 chars)
                _3 :  this.padRight( this.padLeft( this.merchant.id_merchant ,9 ,'0'), 15, ' ' ), // Sub-merchant ID (15 chars)
                _4 : 'F  ',  // Retailer indicator (3 chars)
                _5 : this.isoAddress.countryNumericCode, // ISO country code (3 digits)
                _6 : '       ', // User field ACI (7 chars)
                fullToken :  '',
            };

            token_FA.fullToken = this.buildTkn(
                token_FA.name,
                token_FA._1 + token_FA._2 + token_FA._3 + token_FA._4 + token_FA._5 + token_FA._6
            );
        }

        // ========================================================================
        // SECTION 12: ISO 8583 FIELD CONSTRUCTION
        // ========================================================================

        // Field 03 - Processing Code (Transaction type + account type)
        // TODO: Check with Juan if account type rule applies
        const accTypeOrg = '00'; // Default credit account
        //if (this.binData.type == "CREDITO") accTypeOrg = "00";
        //if (this.binData.type == "DEBITO") accTypeOrg = "20";
        const fld03 = `${this.typeTran + accTypeOrg}00`;

        // Field 04 - Amount (already formatted to 12 digits)
        const fld04 = this.amount;

        // Field 07 - Transmission date/time (MMDDHHMMSS)
        const fld07 = helpers.fechaUTC();

        // Field 18 - Merchant Category Code
        // Priority: Merchant MCC > Constructor MCC > Default by type
        const fld18 = (this.merchant && this.merchant.isoMcc && this.merchant.isoMcc.mcc) ? 
            this.merchant.isoMcc.mcc.padStart(4, '0') :
            (this.mcc) ? this.mcc :
                ((this.isoType == 'AGRS') ? '5399' : '5694'); // Default: Misc or Clothing
        
        console.log('[jsonToIsoTranslator] Field 18 (MCC):', fld18, 
            '- Merchant MCC available:', !!(this.merchant && this.merchant.isoMcc && this.merchant.isoMcc.mcc),
            '- Constructor MCC:', this.mcc,
            '- ISO Type:', this.isoType);
//
        // Field 22 - POS Entry Mode - 🔴 FIXED VERSION
        console.log('🔍 [packTranBzpay] Field 22 calculation:', {
            msg_type: this.msg_type,
            typeTran: this.typeTran,
            reverseEntryMode: this.revereseEntryMode,
            currentEntryMode: this.entry_mode,
            isReversal: this.msg_type == "0220" || this.msg_type == "0420",
            isPostAuth: this.msg_type == "0200" && this.typeTran == '20'
        });

        // Use original entry mode for reversals and post-auth transactions
        let fld22; // 🔴 CHANGED: Use let instead of var
        if ((this.msg_type == "0220" || this.msg_type == "0420") && this.revereseEntryMode) {
            // For reversal messages, use the original transaction's entry mode
            fld22 = this.revereseEntryMode;
            console.log('🔍 [packTranBzpay] Using reverse entry mode for reversal:', fld22);
        } else if (this.msg_type == "0200" && this.typeTran == '20' && this.revereseEntryMode) {
            // For post-auth transactions, use the original entry mode
            fld22 = this.revereseEntryMode;
            console.log('🔍 [packTranBzpay] Using reverse entry mode for post-auth:', fld22);
        } else {
            // For new transactions, map internal entry modes to PROSA v8.10.0 Field 22 codes
            // 2+1 split: positions 1-2 = Entry Method, position 3 = PIN Capability
            //
            // Entry Method: 00=Unknown, 01=Manual, 05=Chip, 07=Contactless M/Chip,
            //   10=Card on File, 80=FallBack, 81=Electronic Commerce,
            //   90=Magstripe read, 91=Contactless-Banda
            // PIN Capability: 0=Unknown, 1=Can accept PIN, 2=Cannot accept PIN, 8=PIN pad down

            const entryMethodMap = {
                'chip': '05',
                'magnetic_stripe': '90',
                'manual': '01',
                'contactless_magnetic': '91',
                'fallback': '80',
                'e-commerce': '81',
                'contactless': '07',
                'contactless_chip': '07',
                'contactless_nfc': '07',
                'credential_on_file': '10'
            };

            const auth = (this.authentication || '').toLowerCase().trim();
            let pinCap;
            if (auth === 'pin') {
                pinCap = '1';
            } else if (auth.includes('contactless') || auth.includes('nfc') ||
                       auth.includes('firma digitalizada') || auth.includes('firma electrónica') ||
                       auth.includes('firma') || auth === 'manual') {
                pinCap = '2';
            } else {
                pinCap = '0';
            }

            fld22 = '000'; // Default

            // If entry_mode is already a 3-digit code, use it
            if (this.entry_mode && /^\d{3}$/.test(this.entry_mode)) {
                fld22 = this.entry_mode;
            } else if (this.entry_mode && entryMethodMap[this.entry_mode.toLowerCase()]) {
                fld22 = entryMethodMap[this.entry_mode.toLowerCase()] + pinCap;
            }
            console.log('🔍 [packTranBzpay] Mapped entry mode:', this.entry_mode, '->', fld22,
                '(pinCap=' + pinCap + ', auth=' + auth + ')');
        }

        // Special handling for RSA initialization
        if (this.rsa) {
            fld22 = '010'; // Manual entry for RSA init
            console.log('🔍 [packTranBzpay] Override for RSA init:', fld22);
        }

        // Ensure Field 22 is exactly 3 digits
        if (fld22 && fld22.length !== 3) {
            console.log('⚠️ [packTranBzpay] Field 22 invalid length:', fld22.length, 'padding to 3');
            fld22 = fld22.padStart(3, '0').substring(0, 3);
        }

        console.log('✅ [packTranBzpay] Final Field 22:', fld22);

        // Field 32 - Acquirer Institution ID
        const fld32 = this.padLeft(
            !(this.merchant.banco_adq.id_acquirer && this.merchant.banco_adq.id_acquirer != '0') ?
                this.merchant.banco_adq.fiid?.slice(-3) : // Use last 3 of FIID
                this.merchant.banco_adq.id_acquirer, // Or direct acquirer ID
            11,
            '0'
        );

        // Field 35 - Track 2 Data or Card Data
        console.log('🔍 DEBUG - Field 35 logic:');
        console.log('- data.tk2 available:', !!data.tk2);
        console.log('- tknQ2:', this.tknQ2);
        console.log('- entry_mode:', this.entry_mode);

        // Function to validate and fix Track 2
        const validateTrack2 = (track2) => {
            if (!track2) return null;

            let cleaned = track2.trim();

            // Check if it contains valid separators
            if (!(cleaned.includes('=') || cleaned.includes('D'))) {
                console.log('❌ Invalid Track 2 - no separator:', cleaned.substring(0, 20));
                return null;
            }

            // Log the length for debugging
            console.log(`📏 Track 2 length: ${cleaned.length} chars`);

            return cleaned;
        };

        let fld35 = track2Data || ''; // Now this is fine// 🔴 ONLY DECLARE ONCE HERE

        // PRIMARY LOGIC: Always use data.tk2 if it's a valid track2
        if (data.tk2) {
            console.log('🔍 data.tk2 value:', data.tk2.substring(0, 30) + '...');
            const validated = validateTrack2(data.tk2);
            if (validated) {
                console.log('✅ Using data.tk2 for Field 35');
                fld35 = validated;
            }
        }

        // SECONDARY LOGIC: If no valid track2, construct from card number
        if (!fld35) {
            console.log('⚠️ Constructing Field 35 from card number');

            if ((this.tknQ2 === '09' || this.tknQ2 === '08' || this.tknQ2 === '03' ||
                 this.contract || this.entry_mode == 'manual') &&
                this.cardInformation && this.cardInformation.card_number) {

                const pan = this.cardInformation.card_number;
                const expYear = this.cardInformation.expiration_year || tran_year.substring(2, 4);
                const expMonth = this.cardInformation.expiration_month || tran_month;

                // Construct Track 2: PAN + '=' + YYMM + service code (101) + padding
                fld35 = `${pan}=${expYear}${expMonth}10100000000000000000`;

                // Ensure exactly 37 characters
                fld35 = fld35.substring(0, 37);
                console.log('🔨 Constructed Track 2 (37 chars):', fld35);
            } else {
                console.log('❌ Cannot construct Field 35 - insufficient data');
                fld35 = '';
            }
        }

        console.log('🎯 Final Field 35 value:', fld35 ? fld35.substring(0, 37) + (fld35.length > 37 ? '...' : '') : 'EMPTY');
        console.log('📏 Final length:', fld35 ? fld35.length : 0);

        // Field 37 - Retrieval Reference Number (STAN)
        const safeReverseSecNum = (this.reverseSecNum !== undefined &&
                                  this.reverseSecNum !== null &&
                                  this.reverseSecNum !== '') ?
                                 String(this.reverseSecNum) : null;
        const fld37 = safeReverseSecNum ? safeReverseSecNum :
            ((this.reference) ? this.reference : helpers.randomString(12, 1));

        // Field 38 - Authorization Code
        // FIXED: Proper undefined/null/empty string check
        const fld38 = (this.reverseAuthNum !== undefined &&
                       this.reverseAuthNum !== null &&
                       this.reverseAuthNum !== '') ?
            String(this.reverseAuthNum) : '';

        // Field 41 - Terminal ID
        const fld41 = (this.device) ? this.device.serial.substr(4, 20) : '001'; // Device serial or default

        // Field 43 - Card Acceptor Name/Location
        // Format: Terminal Owner (22) + City (13) + State (3) + Country (2)
        const aux = (this.merchant.id_esquema != 1) ?  `${ this.merchant.ln_agregador }*` : ''; // Aggregator prefix
        const c_terminalOwner = this.padRight( `${ aux }${ this.commerce_name }`.substring(0,22), 22, ' ');
        const c_terminalCity = this.padRight( this.isoAddress.alcaldia.substring(0,13),13,' ');
        const fld43 = `${ c_terminalOwner }${c_terminalCity}${ this.isoAddress.state3code }${ this.isoAddress.country2code }`
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents

        // Field 48 - Additional Private Data
        // Contains affiliation data and fixed values
        let afiliation = 0;
        if (this.merchant.esquema_transaccional.esquema == 'Esquema 3') {
            afiliation = this.merchant.subafiliation_number; // Sub-affiliation for scheme 3
        } else if (this.merchant.esquema_transaccional.esquema == 'Esquema 4' || this.merchant.esquema_transaccional.esquema == 'Esquema 1') {
            afiliation = this.merchant.afiliation_number; // Main affiliation for schemes 1/4
        } else {
            afiliation = this.commerce_id; // Default commerce ID
        }
        const fld48 = `${this.padRight(afiliation, 19, ' ')}0001` + '00010001'; // Affiliation + fixed data

        // Field 60 - Terminal Data (Reserved)
        const isoType = this.merchant.iso_logical_network.ln ? this.merchant.iso_logical_network.ln : this.isoType;
        let fld60 = (this.system_fiid ? this.system_fiid : this.merchant.ln_agregador) +
            (isoType) + "1000" + "0000"; // FIID + network type + fixed

        // Field 62 - Postal Code
        const fld62 = this.padRight(this.isoAddress.cp.substring(0, 3) + '  ' + this.isoAddress.cp.substring(3), 10, " ");

        // ========================================================================
        // SECTION 13: TOKEN C0 CONSTRUCTION FOR MANUAL/E-COMMERCE
        // ========================================================================

        let tknC0 = '';
        const tknC4 = '';

        // Build token C0 only for manual entry or e-commerce transactions
        if (this.entry_mode == 'manual' || this.entry_mode == 'e-commerce') {
            const cvv4 = this.padRight(
                this.cardInformation?.cvv ? this.cardInformation.cvv : '    ', // 1-4: CVV2 (4 chars)
                4,
                ' ',
            );

            const transmissionStatus = ' '; // 5: Transmission status (space)
            const retransmissionCounter = '001'; // 6-8: Retransmission counter (001)
            const merchantPostalCode = '          '; // 9-18: Merchant postal code (10 spaces) - per existing comment
            const ecomIndicator = `${token_C0._5}`; // 19: E-commerce indicator (1 char)
            const cardTypeSpace = ' '; // 20: Card type (space)
            const forcedTran = this.forcedTransaction ? this.forcedTransaction : ' '; // 21
            const additionalDataIndicator = this.cardInformation?.cvv ? '1' : ' '; // 22
            const additionalInfoIndicator = ' '; // 23
            const authCollectorIndicator = token_C0._10 ? token_C0._10 : ' '; // 24
            const fraudPropensity = this.fraudPropentionFlag ? this.fraudPropentionFlag : ' '; // 25
            const cavvValidation = this.cavvValidationResult ? this.cavvValidationResult : ' '; // 26

            const c0Value =
                cvv4 +
                transmissionStatus +
                retransmissionCounter +
                merchantPostalCode +
                ecomIndicator +
                cardTypeSpace +
                forcedTran +
                additionalDataIndicator +
                additionalInfoIndicator +
                authCollectorIndicator +
                fraudPropensity +
                cavvValidation;

            tknC0 = this.buildTkn('C0', c0Value);
        }
    // ========================================================================
    // SECTION 14: FIELD 63 - ADDITIONAL DATA (TOKENS CONSTRUCTION)
    // ========================================================================

    let fld63;
    // Build field 63 unless we have original data for non-purchase transactions
//    if (!this.revereseTknData63 || (this.msg_type == "0200" && this.typeTran != '20') ) {
    if (!this.revereseTknData63 || (this.msg_type == "0200" && this.typeTran != '20') || this.msg_type == "0220") {
      fld63 = {
        // Q1 token disabled: this.rsa ? this.buildTkn("Q1", "9 ") : "",
        tknQ2: this.tknQ2 ? this.buildTkn('Q2', this.contract ? '02' : this.tknQ2) : '', // Token type
        tknC0, // E-commerce security token
        tknC4: this.buildTkn('C4', this.getTokenC4(this.tknQ2, this.cvm_rslts, !!this.rsa, !!this.contract)), // Terminal capabilities
        tknES: '', // Reserved token
        tknEW: '', // Reserved token
        tknEZ: '', // Reserved token
        tknQ6: (this.chargePlan && this.chargePlan.months) ? this.buildTkn( // Installment plan data - only for MSI/deferred
          'Q6',
          this.padLeft(this.chargePlan.first_payment || '00', 2, '0') + // First payment (default to 00 if not provided)
          this.padLeft(this.chargePlan.months || '00', 2, '0') + // Number of months
          this.padLeft(this.chargePlan.type || '00', 2, '0') // Plan type
        ) : '',
        tknB2: (this.cardInformation && this.cardInformation.emv_tags && this.tokenB2) ? // EMV transaction data
               this.buildTkn('B2', this.tokenB2) : '',
        tknB3: (this.cardInformation && this.cardInformation.emv_tags && this.tokenB3) ? // EMV additional data
               this.buildTkn('B3', this.tokenB3) : '',
        tknB4: this.cardInformation && this.cardInformation.emv_tags ? // EMV terminal data
               this.buildTkn('B4',
                   // 🔴 FIXED: B4 data must be EXACTLY 20 characters
                   // Format: fld22(3) + terminal_capability(1) + terminal_operator(1) +
                   //         fixed(1) + tokenB4(2) + cvm_results(3) + "1508"(4) +
                   //         arqc_verify(1) + spaces(4) = 20 chars
                   this.padRight(`${fld22 || '000'}`, 3, ' ').substring(0, 3) + // POS entry mode (3 chars)
                   this.padRight(`${this.getTerminalEntryCap() || '5'}`, 1, ' ').substring(0, 1) + // Terminal capability (1)
                   '1' + // Terminal operator (1) - always '1'
                   '0' + // Fixed (1)
                   this.padRight(`${this.tokenB4 || '  '}`, 2, ' ').substring(0, 2) + // Terminal data (2)
                   this.padRight(`${this.cvm_rslts || '   '}`, 3, ' ').substring(0, 3) + // CVM results (3)
                   '1508' + // Fixed (4)
                   this.padRight(`${this.arqc_vrfy || '0'}`, 1, ' ').substring(0, 1) + // ARQC verify (1)
                   '    ' // Trailing spaces (4) to make 20 total
               ) : '',
        // 3D Secure tokens
        tknC6: this._3dsData ? token_C6.fullToken : '', // Visa auth
        tknCE: this._3dsData ? token_CE.fullToken : '', // MasterCard UCAF
        tknRJ: this._3dsData ? token_RJ.fullToken : '', // Common 3DS

        // Contactless token
        tknCZ: this.entry_mode?.includes('contactless') && this.getTokenCZ(cardBrand) ?
               this.buildTkn('CZ', this.getTokenCZ(cardBrand)) : '',

        // Recurring charges token
        tknR4: this.contract ? this.buildTkn('R4', this.padRight(this.contract,20, ' ')) : '',

        // Payment facilitator token
        tknFA: token_FA.fullToken,

        /**
         * Assembles all tokens into final field 63 value
         * Format: "& [token_count(5)] [total_length(5)] [all_tokens]"
         */
        fullValue() {
            // SAFEGUARD: Ensure all properties exist
            const tokens = [
                this.tknQ2, this.tknC0, this.tknC4, this.tknES, this.tknEW,
                this.tknEZ, this.tknQ6, this.tknB2, this.tknB3, this.tknB4,
                this.tknC6, this.tknCE, this.tknRJ, this.tknCZ, this.tknR4, this.tknFA
            ];

            // Filter out undefined/null/empty strings
            const validTokens = tokens.filter(t => t && typeof t === 'string' && t.trim() !== '');
            const concatTkns = validTokens.join('');

            // DEBUG: Log what we're working with
            console.log('[jsonToIsoTranslator] Field 63 DEBUG:', {
                msg_type: this.msg_type,
                tokensCount: validTokens.length,
                concatTknsLength: concatTkns.length,
                concatTknsPreview: concatTkns.substring(0, 100) + '...',
                hasLengthIndicator: concatTkns && concatTkns.startsWith('& ') && /^\d{3}/.test(concatTkns.substring(2, 5))
            });

            // If no tokens, return empty string
            // Check if content already has length indicator (starts with '& ' followed by digits)
            const hasLengthIndicator = concatTkns && concatTkns.startsWith('& ') && /^\d{3}/.test(concatTkns.substring(2, 5));
            
            if (!hasLengthIndicator) {
                // Calculate length safely
                const totalLength = concatTkns.length + 12; // +12 for "& " + countTkns(5) + lengthFld63(5)
                const lengthFld63 = packTranBzpay.prototype.padLeft(totalLength, 5, '0');

                // Count tokens by counting '!' characters (each token starts with "! ")
                const tokenCount = (concatTkns.match(/!/g) || []).length;
                const countTkns = packTranBzpay.prototype.padLeft(tokenCount, 5, '0');

                const result = `& ${countTkns}${lengthFld63}${concatTkns}`;
                console.log('[jsonToIsoTranslator] Building NEW field 63:', {
                    totalLength,
                    lengthFld63,
                    tokenCount,
                    countTkns,
                    resultLength: result.length,
                    resultPreview: result.substring(0, 100) + '...'
                });
                return result;
            } else {
                // Content already has length indicator - use as-is
                console.log('[jsonToIsoTranslator] Using EXISTING field 63 with length indicator:', {
                    length: concatTkns.length,
                    preview: concatTkns.substring(0, 100) + '...'
                });
                return concatTkns;
            }
        },
      };
    } else if (this.revereseTknData63 && this.typeTran != '00') {
      // For reversals with existing field 63 data, update transaction type in token B2
      const b2HeaderIndex = this.revereseTknData63.indexOf('! B200158 ');
      if (b2HeaderIndex != -1) {
        // Replace transaction type at position 90-91 in token B2
        this.revereseTknData63 = `${this.revereseTknData63.substring(0, b2HeaderIndex + 90)}${this.typeTran}${this.revereseTknData63.substring(b2HeaderIndex + 92)}`;
      }
      // revereseTknData63 already has proper format - wrap in object with fullValue method
      fld63 = {
        fullValue: () => this.revereseTknData63
      };
    }
    // ========================================================================
    // SECTION 15: REMAINING ISO FIELDS
    // ========================================================================

    // Field 90 - Original Transaction Data (for reversals and authorization responses)
    let fld90;
    if ((!checkOutData || checkOutData === '') &&
        (this.msg_type != '0220' || !this.reverseMsgType || !this.reverseSecNum)) {
        // Not a reversal or authorization response with original data - no field 90 needed
        fld90 = undefined;
    } else {
        // Include field 90 for reversals (0420) and authorization responses (0220)
        // that reference original transaction data
        // 🔴 FIXED: ISO 8583 Field 90 format: 0 + MTI + STAN + Date + Time + Capture Date + 10 zeros
        const safeValue = (value, defaultValue) => {
            if (value === undefined || value === null) return defaultValue;
            const str = String(value);
            return str === 'undefined' ? defaultValue : str;
        };

        // Original Message Type Indicator (4 digits)
        const originalMti = this.padLeft(String(this.reverseMsgType || '0200'), 4, '0');
        
        // Original System Trace Audit Number (6 digits)
        const stan = this.padLeft(safeValue(this.reverseSecNum, '000000'), 6, '0');
        
        // Original Transaction Date (MMDD)
        const date = safeValue(this.revereseTranDate, '0109');
        
        // Original Transaction Time (HHmmss)
        const time = safeValue(this.revereseTranTime, '034105');
        
        // Original Capture Date (MMDD)
        const captureDate = safeValue(this.revereseCptDate, '0109');

        // 🔴 FIXED: Proper ISO 8583 Field 90 format
        fld90 = '0' + originalMti + stan + date + time + captureDate + '0000000000';

        // Final safety check
        fld90 = fld90.replace(/undefined/g, '');
        
        console.log('🔍 [packTranBzpay] FIXED Field 90 constructed:', {
            prefix: '0',
            originalMti,
            stan,
            date,
            time,
            captureDate,
            suffix: '0000000000',
            result: fld90,
            length: fld90.length
        });
    }

    // Field 120 - Terminal Address and Branch
    const c_terminalNameAndLocation = `${ this.isoAddress.calle } ${ this.isoAddress.no_ext }`.substring( 0 , 25 );
    const fld120 = `${this.padRight( c_terminalNameAndLocation , 25, ' ')}    ` // 4 blank spaces for branch ID
                   .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents

    // Field 125 - Statement and Account Data
    const fld125 = `  ${ this.isAGP() || this.merchant.id_esquema === 1 ?"HOST":"INTR"  }B24 ${ this.dftCpt }0`;

    // ========================================================================
    // SECTION 16: FINAL PACKET ASSEMBLY
    // ========================================================================

    const p = this.getPacket(
      this.msg_type,
      fld03, fld04, fld07, fld18, fld22, fld32, fld35, fld37, fld38,
      fld41, fld43, fld48, fld60, fld62, fld63?.fullValue() || '',
      fld90, fld120, fld125
    );

    this.reqPacket = p; // ISO packet object
    this.destPacket = p.getMessage(); // Raw ISO message string
  }

  /**
   * Returns the ISO request transaction data elements
   * @returns {Object} ISO 8583 packet object
   */
  getISOReqTranDE() {
    return this.reqPacket;
  }

  /**
   * Returns the destination transaction message
   * @returns {string} Raw ISO 8583 message string
   */
  getISODestTran() {
    return this.destPacket;
  }
}

packTranBzpay.prototype.getPacket = function (
  msg_type,
  fld03,
  fld04,
  fld07,
  fld18,
  fld22,
  fld32,
  fld35,
  fld37,
  fld38,
  fld41,
  fld43,
  fld48,
  fld60,
  fld62,
  fld63,
  fld90,
  fld120,
  fld125
) {

  console.log("  msg_type: " + msg_type + ", fld03: " + fld03 + ", fld04: " + fld04 + ", fld07: " + fld07 + ", fld18: " + fld18 + ", fld22: " + fld22 + ", fld32: " + fld32 + ", fld35: " + fld35 + ", fld37: " + fld37 + ", fld38: " + fld38 + ", fld41: " + fld41 + ", fld43: " + fld43 + ", fld48: " + fld48 + ", fld60: " + fld60 + ", fld62: " + fld62 + ", fld63: " + fld63 + ", fld90: " + fld90 + ", fld120: " + fld120 + ", fld125")
  const p = {};
  const now = moment(new Date());

  // SAFE DATE HELPER
  const safeDate = (dateValue) => {
    if (!dateValue || dateValue === 'undefined' || dateValue === 'ined') {
      return now.format('MMDD');
    }
    const str = String(dateValue);
    return str.substring(0, 4); // Ensure 4 characters
  };

  // Echo message (0800) - Network management
  if (msg_type == '0800') {
    p[0] = '0800'; // Message Type
    p[7] = fld07; // Transmission date/time
    p[11] = helpers.randomString(6, 1); // System trace audit number
    p[70] = '301'; // Network management code

  // Purchase/transaction message (0200)
  } else if (msg_type == '0200') {
    p[0] = msg_type;
    p[3] = fld03; // Processing code
    p[4] = fld04; // Transaction amount
    p[7] = fld07; // Transmission date/time
    p[11] = helpers.randomString(6, 1); // System trace
    p[12] = now.format('HHmmss'); // Local time
    p[13] = now.format('MMDD'); // Local date
    p[17] = now.format('MMDD'); // Capture date
    p[18] = fld18; // Merchant category
    p[22] = fld22; // POS entry mode
    p[32] = fld32; // Acquirer ID
    if (fld35) p[35] = fld35; // Track 2 data
    p[37] = fld37; // Retrieval reference
    if (fld38 != undefined && fld38 != '') p[38] = fld38; // Auth code
    p[41] = fld41; // Terminal ID
    p[42] = `000000000${this.commerce_id}`; // Merchant ID
    p[43] = fld43; // Merchant name/location
    p[48] = fld48; // Private data
    p[49] = 484; // Currency code (MXN)
    p[60] = fld60; // Reserved
    p[61] = '        00000000000'; // Issuer data
    p[62] = fld62; // Postal code

    // SAFE FIELD 63 HANDLING
    // p[63] handled outside this case

    // Only add field 90 for reversals (0420, 0220, 0230), NOT for charge transactions (0200)
    if(fld90 && (msg_type === '0420' || msg_type === '0220' || msg_type === '0230')) {
        p[90] = fld90; // Original data
    }
    p[100] = '00000000000'; // Receiving institution
    p[120] = fld120; // Terminal address
    p[121] = '000000000000000000  '; // File/table info
    p[125] = fld125; // Statement data
    p[126] = '00000000000000000000000000000000000000'; // Additional data

  // Authorization response (0220)
  } else if (msg_type == '0220') {
    p[0] = msg_type;
    p[3] = fld03;
    p[4] = fld04;
    p[7] = fld07;
    p[11] = helpers.randomString(6, 1);
    p[12] = now.format('HHmmss');
    p[13] = now.format('MMDD');
    p[17] = now.format('MMDD');
    p[18] = fld18;
    p[22] = fld22;
    p[32] = fld32;
    if (fld35) p[35] = fld35;
    p[37] = fld37;
    p[38] = fld38; // Authorization number
    p[39] = '00'; // Response code (approved)
    p[41] = fld41;
//    p[42] = `000000000${this.commerce_id}`;
    p[43] = fld43;
    p[48] = fld48;
    p[49] = 484;
    p[60] = fld60;
    p[61] = '        00000000000';
//    p[62] = fld62;

    // SAFE FIELD 63 HANDLING

    // p[63] handled outside this case

    p[90] = (fld90) ? fld90 : '';
    p[100] = '00000000000'; // Receiving institution
    p[120] = fld120;
    p[121] = '000000000000000000  ';
//    p[123] = '                    ';
    p[125] = fld125;
    p[126] = '00000000000000000000000000000000000000';

  // Reversal message (0420) - FIXED!
  } else if (msg_type == '0420') {
    p[0] = msg_type;
    p[3] = fld03;
    p[4] = fld04;
    p[7] = fld07;
    p[11] = helpers.randomString(6, 1);
    p[12] = now.format('HHmmss');
    p[13] = now.format('MMDD');

    // 🔴 CRITICAL FIX: Use safeDate() to prevent "ined"
    // Field 17: Capture Date - Original transaction date (MMDD format)
    // Using safeDate() to ensure valid date format and prevent 'ined' errors
    p[17] = safeDate(this.revereseCptDate);

    // Field 18: Merchant Type / Merchant Category Code (MCC)
    // Identifies the type of business or service provided by the merchant
    p[18] = fld18;

    // Field 22: Point of Service (POS) Entry Mode
    // Defines how the card data was captured (e.g., magstripe, chip, contactless)
    p[22] = fld22;

    // Field 32: Acquiring Institution Identification Code
    // Identifies the financial institution that acquired the transaction
    p[32] = fld32;

    // Field 35: Track 2 Data
    // Contains the card's track 2 data from the magnetic stripe (if available)
    if (fld35) p[35] = fld35;

    // Field 37: Retrieval Reference Number (RRN)
    // Unique identifier for the transaction assigned by the acquirer
    p[37] = fld37;

    // Field 38: Authorization Identification Response
    // Authorization code received from the issuer (if transaction was approved)
    p[38] = fld38;

    // Field 39: Response Code
    // Indicates the status of the transaction (e.g., '00' = approved, '68' = timeout)
    // Changed from 'R9' to '68' to match ISO 8583 standard response codes
    // '68' specifically indicates a response received too late (timeout)
    p[39] = this.reverseCode || '68';

    // Field 41: Card Acceptor Terminal Identification
    // Identifies the terminal where the transaction originated
    p[41] = fld41;

    // Field 42: Card Acceptor Identification Code
    // Merchant ID, prefixed with zeros to meet length requirements
    p[42] = `000000000${this.commerce_id}`;

    // Field 43: Card Acceptor Name/Location
    // Name and location of the merchant
    p[43] = fld43;

    // Field 48: Additional Data - Private
    // Contains additional transaction-specific data in a private format
    p[48] = fld48;

    // Field 49: Currency Code, Transaction
    // '484' is the numeric code for Mexican Peso (MXN)
    p[49] = 484;

    // Field 60: Reserved (Private Use)
    // Can be used for merchant-specific data or future expansion
    p[60] = fld60;

    // Field 61: Point of Service Data
    // Contains terminal-related information (padded with spaces and zeros)
    p[61] = '        00000000000';

    // Field 62: Card Issuer Data
    // Contains additional data from the card issuer
    p[62] = fld62;

    // p[63] handled outside this case
    p[90] = (fld90) ? fld90 : '';
    p[100] = '00000000000'; // Receiving institution
    p[120] = fld120;
    p[121] = '000000000000000000  ';
    p[123] = '                    ';
    p[125] = fld125;
    p[126] = '00000000000000000000000000000000000000';
  }

  // ──────────────────────────────────────────────
  // FIELD 63 - FINAL SAFE HANDLING (RUNS LAST)
  // ──────────────────────────────────────────────
  // Goal: Ensure field 63 ALWAYS has correct LLL prefix if content exists
  //       Never overwrite a already-prefixed value
  //       Prevent truncation / overflow into S-090/S-100

  // ──────────────────────────────────────────────
  // FIELD 63 - FINAL FORCED LENGTH INDICATOR FIX
  // ──────────────────────────────────────────────

  // Add field 63 if it exists
  if (fld63 && fld63.trim() !== '') {
    // Line 1054 should be:
    p[63] = typeof fld63 === 'object' ? fld63.fullValue() : fld63;
  }

  return new iso8583Packet(p);
};
// ========================================================================
// SECTION 18: UTILITY AND HELPER METHODS
// ========================================================================

/**
 * Right-pads a string to specified length
 * @param {string} num - String to pad
 * @param {number} size - Target length
 * @param {string} padWith - Padding character
 * @returns {string} Padded string
 */
packTranBzpay.prototype.padRight = function (num, size, padWith) {
  let s = `${num}`;
  while (s.length < size) s = s + padWith;
  return s;
};

/**
 * Gets payment facilitator token based on card brand
 * @param {string} cardBrand - Card brand (VISA, MASTERCARD, AMEX)
 * @returns {string} Formatted facilitator token
 */
packTranBzpay.prototype.getFacilitatorToken = function(cardBrand) {
  let token;
  switch(cardBrand){
    case 'VISA':
      token = this.padRight( this.merchant.visa_pymnt_facilitator || 0 ,11 ,' ');
      break;
    case 'AMEX':
      token = this.padRight( this.merchant.amex_pymnt_facilitator || 0 ,11 ,' ');
      break;
    case 'MASTERCARD':
    default:
      token = this.padLeft( this.merchant.mc_pymnt_facilitator || 0 ,11 ,'0');
  };
  return token;
};

/**
 * Gets independent sales organization token based on card brand
 * @param {string} cardBrand - Card brand (VISA, MASTERCARD, AMEX)
 * @returns {string} Formatted sales organization token
 */
packTranBzpay.prototype.getSaleOrganizarionToken = function(cardBrand) {
  let token;
  switch(cardBrand){
    case 'VISA':
    case 'AMEX':
      token = this.padRight( this.merchant.visa_indpnt_sales_org || 0 ,11 ,' ');
      break;
    case 'MASTERCARD':
    default:
      token = this.padLeft( this.merchant.mc_indpnt_sales_org || 0 ,11 ,'0');
  };
  return token;
};

/**
 * Left-pads a string to specified length
 * @param {string} num - String to pad
 * @param {number} size - Target length
 * @param {string} padWith - Padding character
 * @returns {string} Padded string
 */
packTranBzpay.prototype.padLeft = function (num, size, padWith) {
  let s = `${num}`;
  while (s.length < size) s = padWith + s;
  return s;
};

/**
 * Constructs token C4 - Terminal capabilities and configuration
 * @param {string} tknQ2 - Token Q2 type
 * @param {string} cvm_rslts - Card verification results
 * @param {boolean} initKey - RSA initialization flag
 * @param {boolean} isPeriodic - Recurring transaction flag
 * @returns {string} Token C4 value
 */
packTranBzpay.prototype.getTokenC4 = function (tknQ2, cvm_rslts, initKey, isPeriodic) {
  try {
    // Determine identification method from CVM results
    let identificationMethod = (cvm_rslts.substring(0, 2) == '01' || cvm_rslts.substring(0, 2) == '44') ? '2' : '1';
    if(this.isQPS) identificationMethod = '5'; // Quick Payment Service override

    const statusIndicator = this.dftCpt == '0' ? '4' : '0'; // Deferred capture status
    const onlineTerminalCapabilitiesId = '3'; // Terminal capability ID (contactless capable)
    const routingIndicator =  this.entry_mode?.includes('chip') || this.entry_mode?.includes('contactless') ? '1' : '3'; // Chip/contactless routing
    const cardOwnerActivation = isPeriodic ? '0': '6'; // Recurring transaction indicator

    // Return different C4 structures based on context
    if (initKey) return '000000023080'; // RSA initialization pattern
    if (tknQ2 == '03') return `000000${statusIndicator}2${routingIndicator}0${onlineTerminalCapabilitiesId}${identificationMethod}`; // Token type 03
    if (tknQ2 == '09') return `102${isPeriodic ? '4': '5'}10${statusIndicator}2${routingIndicator}${cardOwnerActivation}60`; // Token type 09
    if (tknQ2 == '08') return `103${isPeriodic ? '4': '3'}10${statusIndicator}0${routingIndicator}${cardOwnerActivation}64`; // Token type 08

  } catch (error) {
    console.error(error);
    return ''; // Return empty on error
  }
}

/**
 * Constructs token CZ - Contactless transaction data
 * @param {string} cardBrand - Card brand
 * @returns {string|null} Token CZ value or null if not applicable
 */
packTranBzpay.prototype.getTokenCZ = function (cardBrand) {
  let token = this.atc; // Start with Application Transaction Counter

  switch(cardBrand){
    case 'VISA':
    case 'AMEX':
        // Visa/Amex: ATC + device type indicator (padded)
        token += this.deviceTypeIndicator || this.padRight('3030', 8, '0');
    break;
    case 'MASTERCARD':
    default:
      // MasterCard: Validate device type indicator based on MTIP strict mode
      const deviceTypeIndicatorValidated = this.mtipStrict ?
                                          (this.deviceTypeIndicator && this.deviceTypeIndicator.length == 64) :
                                          !!this.deviceTypeIndicator;
      if(deviceTypeIndicatorValidated){
        // Use specific bytes from device indicator
        token += this.padRight(this.deviceTypeIndicator.slice(8,12), 8, '0');
      }else{
        return null; // Invalid device data
      }
  };

  // Append contactless indicators
  const atcValidIndicator = '0'; // ATC validation indicator
  const cardAuthIndicator = '0'; // Card authentication indicator
  const paymentInitChannel = this.paymentChannel; // Payment channel (00, 01, 02)
  const cardHolderIndentifierByDevice = '01'; // Device identification method
  const additionalCardHolderData = '00'; // Additional holder data

  token += `${atcValidIndicator}${cardAuthIndicator}${paymentInitChannel}${cardHolderIndentifierByDevice}${additionalCardHolderData}`;
  token = this.padRight(token, 40, '0'); // Pad to 40 characters

  return token;
}

/**
 * Builds a formatted token string
 * @param {string} tknName - Token name (B2, C0, etc.)
 * @param {string} tknValue - Token value
 * @returns {string} Formatted token string
 */
packTranBzpay.prototype.buildTkn = function (tknName, tknValue) {
  if (tknValue.length !== 0) {
    var s = `! ${tknName}${packTranBzpay.prototype.padLeft(tknValue.length, 5, '0')} ${tknValue}`;
  } else {
    s = ''; // Empty token
  }
  return s;
};

/**
 * Gets terminal entry capability code
 * @returns {string} Entry capability code
 */
packTranBzpay.prototype.getTerminalEntryCap = function() {
  switch(this.entry_mode){
    case 'chip':
    case 'contactless':
      return '5'; // ICC capable
    case 'magnetic_stripe':
    case 'contactless_magnetic':
      return '2'; // Mag stripe capable
    default:
      return '0' // No capability
  }
}

/**
 * Determines if merchant uses AGP (Aggregator) scheme
 * @returns {boolean} True if AGP scheme
 */
packTranBzpay.prototype.isAGP = function (){
  const esquemaTransaccinal = this.merchant.id_esquema;
  dd(`+++++ esquemaTransaccinal: [${esquemaTransaccinal}]`)
  return ( Number(esquemaTransaccinal) === 3) // Scheme 3 is AGP
}

module.exports = packTranBzpay;


/*
* This is a comprehensive ISO 8583 message packing class for payment transactions in the BzPay system. Let me break down its functionality in detail:

## Overview
The `packTranBzpay` class constructs ISO 8583 financial transaction messages for various payment scenarios including purchases, reversals, authorizations, and 3D Secure transactions.

## Core Functionality

### Constructor Parameters
- **Transaction Data**: `data` - Main transaction information
- **Commerce Identification**: `commerce_id`, `commerce_name`
- **Financial Institution**: `system_fiid` - Acquiring bank FIID
- **Merchant Category**: `mcc` - Merchant category code
- **Message Type**: `msgType` - ISO 8583 message type (0200, 0220, 0420, 0800)
- **Transaction Type**: `typeTran` - Processing code transaction type
- **Card Data**: `binData` - BIN information, `fld35` - Track 2 data
- **Reversal Data**: `checkOutData` - Original transaction data for reversals
- **Token Handling**: `tknQ2`, `dftCpt` - Tokenization and capture flags

## Key Processing Sections

### 1. Initialization & Data Preparation
\`\`\`javascript
// Handles different merchant schemes (Esquema 3 uses sub-affiliation)
this.commerce_id = esquema === 3 ? this.merchant.subafiliation_number : commerce_id;

// Amount formatting for ISO 8583
this.amount = entero.toString() + decimal.toString();
this.amount = this.padLeft(this.amount, 12, '0');
\`\`\`

### 2. 3D Secure Processing
**MasterCard (UCAF)**:
- Token CE with authentication value
- ECI mapping (2→5, 1→6, 0→7)
- 3DS version tracking in token RJ

**Visa**:
- Token C6 with base64-decoded authentication value
- Auth method mapping (01→D, 02→A, default→B)

### 3. Token Construction System
The class builds multiple proprietary tokens:

#### Token C0 - E-commerce & Security
\`\`\`javascript
// Contains CVV2, transmission status, retry counter, e-commerce indicators
token_C0._5 = eciValue == 2 ? 5 : eciValue == 1 ? 6 : eciValue == 0 ? 7 : eciValue;
\`\`\`

#### Token FA - Facilitator Data
\`\`\`javascript
// Payment facilitator and sales organization data
token_FA = {
  _1: this.getFacilitatorToken(cardBrand),  // Payment facilitator ID
  _2: this.getSaleOrganizarionToken(cardBrand), // Sales organization ID
  _3: this.merchant.id_merchant,  // Sub-merchant ID
  _4: 'F  ',  // Retailer indicator
  _5: this.isoAddress.countryNumericCode, // Country code
  _6: '       '  // User field
};
\`\`\`

#### Token C4 - Terminal Capabilities
\`\`\`javascript
// Varies by Q2 token type and transaction context
getTokenC4(tknQ2, cvm_rslts, initKey, isPeriodic)
\`\`\`

### 4. ISO 8583 Field Mapping

#### Critical Fields:
- **Field 3**: Processing code (`typeTran + accTypeOrg + "00"`)
- **Field 4**: Transaction amount (12 digits, zero-padded)
- **Field 22**: POS Entry Mode
  - `051` - Chip
  - `901` - Magnetic stripe  
  - `010` - Manual entry
  - `911` - Contactless magnetic
  - `801` - Fallback
  - `810` - E-commerce
  - `071` - Contactless chip
- **Field 35**: Track 2 data or card number + expiration
- **Field 43**: Merchant name and location (normalized)
- **Field 63**: Complex private data containing all tokens

## Transaction Type Handling

### Purchase (0200)
Standard financial transaction with full field set including:
- Merchant data
- Card information  
- Token data
- 3D Secure data when applicable

### Authorization Response (0220) 
Used for online authorization responses, includes:
- Authorization code (field 38)
- Response code (field 39)
- Original transaction data

### Reversal (0420)
Transaction reversal/cancellation:
- References original transaction data
- Uses reversal-specific processing
- Maintains original token data

### Echo (0800)
Network management message for connection testing.

## Special Cases and Scenarios

### 1. 3D Secure Transactions
\`\`\`javascript
if(!!this._3dsData) {
  // Brand-specific 3DS processing
  if(cardBrand === "MASTERCARD") { } //  UCAF handling
if(cardBrand === "VISA") {  } // AVS handling
}
\`\`\`

### 2. Tokenized Transactions
\`\`\`javascript
if (this.tknQ2 == '03' && data.tk2 && this.entry_mode != 'manual') {
    fld35 = data.tk2.trim(); // Use token instead of card data
}
\`\`\`

### 3. Contactless Payments
\`\`\`javascript
tknCZ: this.entry_mode?.includes('contactless') && this.getTokenCZ(cardBrand)
    \`\`\`

### 4. Periodic/Recurring Charges
\`\`\`javascript
tknR4: this.contract ? this.buildTkn('R4', this.padRight(this.contract,20, ' ')) : ''
    \`\`\`

### 5. Merchant Scheme Handling
\`\`\`javascript
// Different affiliation handling based on transactional scheme
if (this.merchant.esquema_transaccional.esquema == 'Esquema 3') {
    afiliation = this.merchant.subafiliation_number;
} else if (this.merchant.esquema_transaccional.esquema == 'Esquema 4' || ...) {
    afiliation = this.merchant.afiliation_number;
}
\`\`\`

## Security & Validation

### Entry Mode Validation
- Validates appropriate data presence based on entry method
- Ensures token usage rules are followed

### Data Formatting
- Strict padding and formatting per ISO 8583 specifications
- Character normalization for merchant data
- Base64 decoding for 3DS authentication values

## Brand-Specific Processing

### MasterCard
- UCAF authentication values
- Specific token formats
- 3DS version tracking

### Visa 
- Different authentication value handling
- Alternative token structures
- Distinct 3DS processing

### American Express
- Similar to Visa with brand-specific identifiers

## Error Handling & Edge Cases

- **Missing Data**: Default values for optional fields
- **Invalid Payment Channels**: Defaults to "00"
- **EMV Data Parsing**: Handles missing EMV tags gracefully
- **Reversal Data**: Maintains original transaction context

This class serves as the core message construction engine for the payment gateway, handling complex business rules, multiple card schemes, and various transaction types while maintaining ISO 8583 compliance.
* 
* */
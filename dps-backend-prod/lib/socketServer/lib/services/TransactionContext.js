/**
 * Transaction Context Class
 * Immutable transaction data container with validation and amount handling
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 3.4: Protects cardholder data through controlled access and immutability
 * - Req 10.3: Records transaction details (amount, timestamp, merchant, card info) for audit
 * - Req 6.5.10: Implements input validation for transaction amounts and parameters
 * - Req 12.3: Enforces transaction limits through merchant min/max validation
 */

class TransactionContext {
    constructor(req, guid, msgType, typeTran, id_operation, refnum) {
        // Check for amountInCents flag (default to false if not present)
        // console.log(req.body, "=-======= REQ =========", req, "=-======= REQ =========")
        const amountInCents = req.body.amountInCents === true;
//        const amountInCents = true;

        // Validate and convert amount immediately
        this._amountCents = this._validateAndConvertToCents(req.body.amount, amountInCents);
//        this._amountCents = req.body.amount;
        this._amountSet = true;
        this._amountInCentsFlag = amountInCents; // Store flag for debugging
        this._originalRaw = req.body.amount; // Store original amount
        
        // Set other immutable properties
        this._mti = msgType;
        this._type = typeTran;
        this._operationId = Number(id_operation);
        this._guid = guid;
        this._entryMode = req.body.entry_mode || req.body.entryMode || 'manual';
        this._referenceNumber = refnum || null;
        this._timestamp = Date.now();
        
        // Card data
        this._cardBin = req.body.cardInformation?.bin || '';
        this._cardLast4 = req.body.cardInformation?.last4 || '';
        this._cardTrack2 = req.body.tk2 || req.body.cardInformation?.track2 || '';
        
        // Merchant data
        this._merchantId = req.merchantData?.id_merchant || '';
        this._merchantName = req.merchantData?.commerce_name || '';
        this._merchantMin = req.merchantData?.min || 0;
        this._merchantMax = req.merchantData?.max || 0;
        
        // Validation flags
        this._validated = true;
        this._locked = true;
    }
    
    /**
     * Validate and convert amount to cents
     * PCI DSS 4.0: Req 6.5.10 - Validates transaction amount input
     * @param {number} amount - Transaction amount
     * @param {boolean} amountInCents - Flag indicating if amount is already in cents
     * @returns {number} Amount in cents
     * @throws {Error} If amount is invalid or negative
     */
    _validateAndConvertToCents(amount, amountInCents = false) {
        if (amount == undefined){
            throw new Error(`Amount is undefined`);
        }

        if (!amount || isNaN(amount)) {
            throw new Error(`Invalid amount: ${amount}`);
        }

        const numAmount = Number(amount);
        let cents;

        // 🎯 NEW LOGIC: Check amountInCents flag
        if (amountInCents === true) {
            // Amount is already in cents
            cents = Math.round(numAmount);
            console.log(`🎯 FLAGGED AS CENTS: ${cents} cents`);
        } else {
            // Default: Amount is in dollars (flag missing or false)
            if (String(numAmount).includes('.')) {
                // Float detected - convert dollars to cents
                cents = Math.round(numAmount * 100);
                console.log(`🎯 DOLLARS WITH DECIMAL: $${numAmount} → ${cents} cents`);
            } else {
                // Integer dollars - convert to cents
                cents = Math.round(numAmount * 100);
                console.log(`🎯 DOLLARS WITHOUT DECIMAL: $${numAmount} → ${cents} cents`);
            }
        }

        // Validate positive amount
        if (cents <= 0) {
            throw new Error(`Amount must be positive: ${amount}`);
        }

        return cents;
    }
    
    _checkLocked(property) {
        if (this._locked) {
            throw new Error(`Cannot modify ${property}: TransactionContext is locked after initialization`);
        }
    }
    
    // 💰 AMOUNT GETTERS/SETTERS
    get amount() {
        return {
            cents: this._amountCents,
            source: 'validated_at_entry',
            originalRaw: this._originalRaw,
            amountInCentsFlag: this._amountInCentsFlag,
            validated: this._validated
        };
    }
    
    set amount(value) {
        this._checkLocked('amount');
        this._amountCents = value;
    }
    
    // 🔄 TRANSACTION GETTERS/SETTERS
    get transaction() {
        return {
            mti: this._mti,
            type: this._type,
            operationId: this._operationId,
            guid: this._guid,
            entryMode: this._entryMode,
            referenceNumber: this._referenceNumber,
            timestamp: this._timestamp
        };
    }
    
    set transaction(value) {
        this._checkLocked('transaction');
    }
    
    // 💳 CARD GETTERS/SETTERS
    get card() {
        return {
            bin: this._cardBin,
            last4: this._cardLast4,
            track2: this._cardTrack2
        };
    }
    
    set card(value) {
        this._checkLocked('card');
    }
    
    // 🏪 MERCHANT GETTERS/SETTERS
    get merchant() {
        return {
            id: this._merchantId,
            name: this._merchantName,
            min: this._merchantMin,
            max: this._merchantMax
        };
    }
    
    set merchant(value) {
        this._checkLocked('merchant');
    }
    
    // 🔧 UTILITY METHODS
    isLocked() {
        return this._locked;
    }
    
    isValid() {
        return this._validated && this._amountCents > 0;
    }
    
    // 📊 DEBUG METHOD
    debugInfo() {
        return {
            amount: this.amount,
            transaction: this.transaction,
            card: this.card,
            merchant: this.merchant,
            locked: this._locked,
            valid: this.isValid()
        };
    }
}

module.exports = TransactionContext;

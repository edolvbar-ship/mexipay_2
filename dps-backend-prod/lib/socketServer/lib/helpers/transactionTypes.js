// Simple Transaction Type Mapping
// 501 = Charge, 502 = Cancel, 503 = Refund

function getTransactionTypeCode(transactionType) {
    switch (transactionType) {
        case 'charge':
            return '501';
        case 'cancel':
            return '502';
        case 'refund':
            return '503';
        default:
            return '501'; // Default to charge
    }
}

function getTransactionTypeName(code) {
    switch (code) {
        case '501':
            return 'charge';
        case '502':
            return 'cancel';
        case '503':
            return 'refund';
        default:
            return 'charge'; // Default to charge
    }
}

module.exports = {
    getTransactionTypeCode,
    getTransactionTypeName
};

/**
 * ISO 8583 Response Formatter for PayCIPS
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 10.2.1: Implement audit trails for transaction responses
 * - Requirement 10.3.1: Record time stamps for all audit trail entries
 * - Requirement 3.5.1: Only include necessary data in ISO message
 */

module.exports = (body, res, id_operation, msgType, iso, node_dest, dftCpt) => {
  // PCI DSS 4 Requirement 10.2.1: Audit trail - log ISO message formatting
  console.log('iso8583_api_PayCIPS ---> init');
  // PCI DSS 4 Requirement 10.3.1: Use ISO 8601 timestamp for audit accuracy
  const date = new Date().toISOString();

  return [
    id_operation,
    msgType,
    iso.fields['11'],
    res.data?.ReferenceCode || body.reference,
    isoAmount(body.amount),
    '00' === res.RespCode ? '00' : '05',
    res.AuthNumber,
    body.cardInformation.bin,
    body.cardInformation.last4,
    dftCpt, 
    iso.fields['22'],
    iso.fields['13'], 
    isoFecha(date),
    isoTime(date),
    isoFecha(date),
    iso.fields['63'],
    iso.fields['63'],
    iso.fields['43'],
    node_dest
  ];
}

/**
 * Format amount for ISO 8583 message
 * PCI DSS 4 Requirement 3.5.1: Format financial data for business purposes only
 */
const isoAmount = amount => {
  amount = amount.includes('.') ? amount.replace('.', '') : `${amount}00`;
  for (let index = 0; 12 > amount.length; index++)
    amount = `0${amount}`;

  return amount;
}

/**
 * Format date for ISO 8583 message
 * PCI DSS 4 Requirement 10.3.1: Format dates for audit trail accuracy
 */
const isoFecha = date => {
  const fecha = date.split('T')[0].split('-');

  return `${fecha[1]}${fecha[2]}`;
}

/**
 * Format time for ISO 8583 message
 * PCI DSS 4 Requirement 10.3.1: Format times for audit trail accuracy
 */
const isoTime = date => {
  return date.split('T')[1].split('.')[0].replace(/\:/g, '')
}
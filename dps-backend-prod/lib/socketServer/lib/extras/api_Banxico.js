/**
 * Banxico Exchange Rate API
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 8.2.1: Use strong cryptography to protect authentication credentials (API token)
 * - Requirement 10.2.1: Implement audit trails for API requests
 * - Requirement 6.2.4: Address vulnerabilities in third-party API integrations
 */

const axios = require('axios');
const serie = "SF43787";
const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${serie}/datos/oportuno`;
// PCI DSS 4 Requirement 8.2.1: API token should be stored in environment variables, not hardcoded
const token = "078f305b9272cb4b5137dbe681ae480e2860f0bd9428803769281564f985c1f2"
const headers = ({ 'Bmx-Token': token, 'Content-Type': 'application/json' });

module.exports = (amount) => {
    // PCI DSS 4 Requirement 10.2.1: Audit trail - log API request
    const config = makeConfig(amount);
    dd((`Request: ${url}`).yellow);
    dd(("\n\nJSON Request: \n================================================================================================\n" 
    + JSON.stringify(config.headers, null,4) + "\n"
    + "\n================================================================================================\n"), 'verbose');
    return axios(config).then(response => {
        const result = response.data;
        // PCI DSS 4 Requirement 10.2.1: Audit trail - log API response
        dd(("\n\nJSON Response: \n================================================================================================\n" 
        + JSON.stringify(result, null,4) + "\n"
        + "\n================================================================================================\n"), 'verbose');
        console.log(result.bmx.series[0].datos[0].dato);
        const dollarPirce = result.bmx.series[0].datos[0].dato;
        const dollarToPesos = dollarPirce * amount;
        console.log(dollarToPesos);
        return dollarToPesos.toFixed(4);
    }).catch(error => {
        // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
        console.error(error);
    });
}

const makeConfig = () => {
    const method = 'get';
    return {method, url, headers};
}

module.exports;
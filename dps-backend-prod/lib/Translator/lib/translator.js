/**
 * Tipo de retorno estandar para la trasformación desde el ISO
 * @typedef {Object} HTTPFromISOResponse
 * @property {string} url - Url destino de petición
 * @property {'POST' | 'GET' | 'PUT' | 'DELETE'} method - Metodo de la petición
 * @property {Headers} headers - Headers de la petición
 * @property {string | undefined} body - Cuerpo de la petición, puede no estar definido.
 */

class HTTPTranslatorInterface{

    domain = '';

    constructor(domain){
        this.domain = domain;
    }

    /**
     * 
     * @param {import("express").Request} requestHttp 
     * @param {Iso8583Packet} iso8583 
     * @returns {Promise<HTTPFromISOResponse>}
     */
    async fromIso(requestHttp, iso8583){
        throw new Error('Funcionalidad no implementada.');
    }

    /**
     * 
     * @param {Object} serviceResponse 
     * @param {import("express").Request} serviceRequest
     * @param {Iso8583Packet} iso8583Req 
     * @param {import("express").Request} requestHttp
     * @returns {Promise<Iso8583Packet>}
     */
    async toIso(serviceResponse, serviceRequest, iso8583Req, requestHttp){
        throw new Error('Funcionalidad no implementada.');
    };

     /**
     * 
     * @param {Object} data
     * @returns {string}
     */
    logFields(data){
        throw new Error('Funcionalidad no implementada.');
    }

    /**
     * @param {Response} response
     * @returns {Promise<{responseHttp: Response, response: any}>}
     */
    async extractResponse(response){
        throw new Error('Funcionalidad no implementada.');
    }

    /**
     * @returns {Object}
     */
    getUnavailableError(){
        throw new Error('Funcionalidad no implementada.');
    }


    /**
     * 
     * @param {import("express").Request} requestHttp
     * @param {Object} translatorResponse
     * @returns {Promise<Object | null>}
     */
    async getDirectResponse(requestHttp, translatorResponse) {
        throw new Error('Funcionalidad no implementada.');
    }

}

module.exports = HTTPTranslatorInterface;
const HTTPTranslatorInterface = require("./translator");
const bcrypt = require('bcryptjs');
const bitwise = require('bitwise');
const Translator = require("../../Translator/index.js");
const { safeLog } = require("../../helpers");
const iso8583Packet = require("../../../lib/iso8583-packet");
const Iso8583Packet = require("../../iso8583-packet/lib/iso8583Packet");
const db = require("../../socketServer/lib/sequelize/init");

class WhitelabelTranslator extends HTTPTranslatorInterface {

    constructor(domain) {
        super(domain);
    }

    /**
     * 
     * @param {import("express").Request} requestHttp 
     * @param {Iso8583Packet} iso8583 
     * @returns {Promise<import("./translator").HTTPFromISOResponse>}
     */
    async fromIso(requestHttp, iso8583){

        const url = `${this.domain}${requestHttp.originalUrl.replace('/gateway/', '/streampay/')}`.split('/');
        let tranTypeIndex = url.length - 1;
        let withOutReference = true;

        if(!isNaN(parseInt(url[tranTypeIndex]))) {
            tranTypeIndex --;
            withOutReference = false;
        }


       if(iso8583.getField(0) == '0420') {
            url[tranTypeIndex] = 'reverse';
            if(withOutReference){
                url.push(iso8583.getField(37));
            }

       }

        const whitelableInfo = requestHttp.merchantData.processor_info.whitelabel_broxel;
        const headers = await this.getHeaders(whitelableInfo.merchant, whitelableInfo.tkr, requestHttp.merchantData.afiliation_number);



        return {
            url: url.join('/'),
            method: requestHttp.method,
            headers,
            body: JSON.stringify(requestHttp.originalBody)
        };
        
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

        const packTranFields = new iso8583Packet((new Translator.interfaceResponseToIso(serviceResponse, serviceRequest, iso8583Req.getFields())).destPacket).getFields();
    

        packTranFields[39] = serviceResponse.resp_code;
        if(serviceResponse.resp_code == "00"){
            packTranFields[37] = serviceResponse.id;
            packTranFields[38] = serviceResponse.authorization;
        }else{
            await db.tresds.update({transStatus: 'U', eci: serviceResponse.error_code},{ where: { referencia_tx: requestHttp.body.reference } });
        }

        return new iso8583Packet(packTranFields);
    };

     /**
     * 
     * @param {Object} data
     * @returns {string}
     */
    logFields(data){
        return JSON.stringify(safeLog(data), null, 3);
    }

    /**
     * @param {Response} response
     * @returns {Promise<Object>}
     */
    async extractResponse(response){
        response = await response.json();
        if(response.mensaje) {
            return this.getUnavailableError(response.mensaje);
        }

        return response;
    }

    /**
     * @returns {Object}
     */
    getUnavailableError(description = 'Gateway timeout'){
        return {
            "request_status": false,
            "http_code": 404,
            "resp_code": "91",
            "description": "DECLINADA",
            "emv_tags": "",
            "emvResponseCode": "",
            "response": description
        };
    }


    /**
     * 
     * @param {import("express").Request} requestHttp
     * @param {Object} translatorResponse
     * @returns {Promise<Object | null>}
     */
    async getDirectResponse(requestHttp, translatorResponse) {
        if(!!translatorResponse.url){
            requestHttp.originalBody.checkStatus = true;
            await db.tresds.create({
                referencia_tx: requestHttp.body.reference,
                sessionToken: '',
                url: translatorResponse.url.substring(0,150),
                transactionID: requestHttp.body.reference,
                body: requestHttp.originalBody,
                'commerce-name': requestHttp.headers['commerce-name'],
                'system-fiid': requestHttp.headers['system-fiid'],
                mcc: requestHttp.headers.mcc,
                'commerce-id': requestHttp.headers['commerce-id'],
                'X-Time': requestHttp.headers['x-time'],
                'X-Auth': requestHttp.headers['x-auth'],
            });
            return translatorResponse;
        }
        return null;
    }

    async getHeaders(merchant, tkr, affiliation){
       

        if(!merchant){
            throw new Error('Missing Whitelabel data...');
        }

        const timestamp = new Buffer.from(`${new Date().getTime()}`);
        tkr = new Buffer.from(tkr);
        affiliation = new Buffer.from(affiliation);
        
        const cad1 = await bitwise.buffer.or(tkr, timestamp);
        let cad2 = await bitwise.buffer.xor(cad1,affiliation);
        cad2 = cad2.toString('base64');
        
        const tka = await bcrypt.hash(cad2,12);

        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('commerce-id', affiliation.toString());
        headers.append('commerce-name', merchant);
        headers.append('X-Auth', tka);
        headers.append('X-Time', timestamp.toString());

        return headers;
    }




}

module.exports = WhitelabelTranslator;

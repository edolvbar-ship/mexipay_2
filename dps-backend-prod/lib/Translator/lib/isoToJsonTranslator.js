var helpers = require("../../helpers");

class unpackTranIso {
  constructor(data, aplicacion, binData, datosRespCode, guid) {
    this.request_id = guid;
    this.request_date = "";
    this.request_status = true;
    this.ksn = "";
    this.key = "";
    this.key_crc32 = "";
    this.key_check_value = "";
    this.http_code = 0;
    this.id = "";
    this.trace_id = "";
    this.authorization = "";
    this.renew_key = false;
    const aux = datosRespCode.find((respCode) => respCode.iso_code === data[39]);
    this.description = (aux)?aux.device_description: null;
    this.error_code = data[39];
    this.rpJson = {};
    this.emv_tags = "";
    this.emvResponseCode = "";
    this.request_date = helpers.fecha();
    this.id = data[37];
    this.arrayTokens = (data[63]) ? unPackDE63(data[63]) : '';

    this.binInformation = binData ? binData : {};

    this.http_code = 0;
    this.trace_id = data[11];
    this.authorization = data[38];

    for (var i = 0; i < this.arrayTokens.length; i++) {
      if (this.arrayTokens[i].tknName == "! EX") {
        this.key = this.arrayTokens[i].tknValue.substring(0, 32);
        this.ksn = this.arrayTokens[i].tknValue.substring(32, 52);
        this.key_check_value = this.arrayTokens[i].tknValue.substring(52, 58);
        this.request_status = this.arrayTokens[i].tknValue.substring(58, 60) == "00";
        this.key_crc32 = this.arrayTokens[i].tknValue.substring(60, 68);
      }
      if (this.arrayTokens[i].tknName == "! ER")
        this.renew_key = !(this.arrayTokens[i].tknValue.substring(0, 1) == "0");

      if (this.arrayTokens[i].tknName == "! B4") {
        this.emv_tags = this.emv_tags +
          "5F2A" + "01" + this.arrayTokens[i].tknValue.substring(6, 8) +
          "9F34" + "03" + this.arrayTokens[i].tknValue.substring(9, 15);
      }
      
      if (this.arrayTokens[i].tknName == "! B5") {
        this.emv_tags = this.emv_tags +
          "91" + "0A" + this.arrayTokens[i].tknValue.substring(4, 24);
        this.emvResponseCode = this.arrayTokens[i].tknValue.substring(20, 24);
      }
      if (this.arrayTokens[i].tknName == "! B6") {
        var nameTag = this.arrayTokens[i].tknValue.substring(4, 6);
        var lengthTagHex = this.arrayTokens[i].tknValue.substring(6, 8);
        var lengthTagDec = parseInt(lengthTagHex, 16) * 2;
        var valTag = this.arrayTokens[i].tknValue.substring(8, 8 + lengthTagDec);
        this.emv_tags = this.emv_tags + nameTag + lengthTagHex + valTag;
       if (this.arrayTokens[i].tknValue.substring(8 + lengthTagDec, 8 + lengthTagDec + 2) == "71" || this.arrayTokens[i].tknValue.substring(8 + lengthTagDec, 8 + lengthTagDec + 2) == "72") {
          var nameTag = this.arrayTokens[i].tknValue.substring( 8 + lengthTagDec, 8 + lengthTagDec + 2 );
          var lengthTagHex = this.arrayTokens[i].tknValue.substring(10 + lengthTagDec, 10 + lengthTagDec + 2);
          var lengthTagDec = parseInt(lengthTagHex, 16) * 2;
          var valTag = this.arrayTokens[i].tknValue.substring(12 + valTag.length, 12 + valTag.length + lengthTagDec);
          this.emv_tags = this.emv_tags + nameTag + lengthTagHex + valTag;
        }
      }
    }

    if (data[39] == "00") {
      this.http_code = 200;
      this.request_status = true;

    } else {
      this.request_status = false;
      this.http_code = 200;
    }

    if (aplicacion.indexOf("initKeys") >= 0 && this.error_code == "00") {
      this.rpJson = {
        request_id: this.request_id,
        request_date: this.request_date,
        request_status: this.request_status,
        http_code: this.http_code,
        resp_code: this.error_code,
        description: this.description,
        authorization: this.authorization,
        ksn: this.ksn,
        key: this.key,
        key_crc32: this.key_crc32,
        key_check_value: this.key_check_value,
      };
    }
    else if (aplicacion.indexOf("initKeys") >= 0 && this.error_code != "00") {
      this.rpJson = {
        request_id: this.request_id,
        request_date: this.request_date,
        request_status: this.request_status,
        http_code: this.http_code,
        resp_code: this.error_code,
        description: this.description,
      };
    }
    else if (aplicacion.indexOf("ecommerce") >= 0 && this.error_code == "00") {
      this.rpJson = {
        request_id: this.request_id,
        request_date: this.request_date,
        request_status: this.request_status,
        http_code: this.http_code,
        resp_code: this.error_code,
        description: this.description,
        authorization: this.authorization,
        id: this.id,
        trace_id: this.trace_id,
        binInformation: this.binInformation,
      };
    }
    else if (this.error_code != "00") {
      this.rpJson = {
        request_id: this.request_id,
        request_status: this.request_status,
        http_code: this.http_code,
        resp_code: this.error_code,
        description: this.description,
        id: this.id,
        binInformation: this.binInformation,
        emv_tags: this.emv_tags,
        emvResponseCode: this.emvResponseCode,
      };
    }
    else {
      this.rpJson = {
        request_id: this.request_id,
        request_date: this.request_date,
        request_status: this.request_status,
        http_code: this.http_code,
        resp_code: this.error_code,
        description: this.description,
        id: this.id,
        trace_id: this.trace_id,
        authorization: this.authorization,
        renew_key: this.renew_key,
        binInformation: this.binInformation,
        emv_tags: this.emv_tags,
        emvResponseCode: this.emvResponseCode,
      };
    }

    function padLeft(num, size, padWith) {
      var s = "" + num;
      while (s.length < size) s = padWith + s;
      return s;
    }

    function unPackDE63(data) {
      var tokens = [];
      var s = "";
      var countToken = 0;
      var nombreToken = "";
      var longToken = "";
      var valToken = "";
      var objTkn = {};
      var restData = data;

      while (s.length < data.length) {
        if (restData.substring(0, 2) == "& ") {
          nombreToken = restData.substring(0, 2);
          longToken = "";
          valToken = restData.substring(2, 12);
          s += nombreToken + longToken + valToken;
        } else if (restData.substring(0, 2) == "! ") {
          nombreToken = restData.substring(0, 4);
          longToken = restData.substring(4, 9);
          valToken = restData.substring(10, 10 + Math.floor(longToken));
          s += nombreToken + longToken + " " + valToken;
        } else {
          return tokens;
        }
        objTkn = {
          tknName: nombreToken,
          tknLength: longToken,
          tknValue: valToken,
        };
        restData = data.substring(s.length, data.length);
        tokens[countToken] = objTkn;
        countToken = countToken + 1;
      }

      return tokens;
    }
  }

  getJsonDestTran(id) {

    if('000000000000' === this.rpJson.id)
      this.rpJson.id = id;

    return this.rpJson;
  }
}

module.exports = unpackTranIso;
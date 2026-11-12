const CryptoJS = require('crypto-js');

const makeConfig = iv => {
    return {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: CryptoJS.enc.Hex.parse(iv)
    }   
}

module.exports.encrypt = (key, msg, iv) => {
    const config = makeConfig(iv);
    key = CryptoJS.enc.Hex.parse(key);

    const crypted = CryptoJS.AES.encrypt(msg, key, config).toString();

    return Buffer.from(crypted).toString('hex');
}
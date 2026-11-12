import * as CryptoJS from 'crypto-js'

export function getSHA256(data: string): string {
    // Genera el hash SHA-256 del dato (como WordArray)
    const sha256 = CryptoJS.SHA256(data);

    // Convierte el WordArray a una cadena Base64 directamente
    //const base64 = CryptoJS.enc.Base64.stringify(sha256);

    return sha256.toString();
}
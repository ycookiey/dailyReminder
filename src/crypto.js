const CryptoJS = require('crypto-js');

class CryptoUtil {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  encrypt(plaintext) {
    try {
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(plaintext), this.secretKey).toString();
      return encrypted;
    } catch (error) {
      throw new Error(`暗号化に失敗しました: ${error.message}`);
    }
  }

  decrypt(ciphertext) {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.secretKey);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedData) {
        throw new Error('復号化に失敗しました。キーが正しくない可能性があります。');
      }
      
      return JSON.parse(decryptedData);
    } catch (error) {
      throw new Error(`復号化に失敗しました: ${error.message}`);
    }
  }

  static generateKey(length = 32) {
    return CryptoJS.lib.WordArray.random(length).toString();
  }
}

module.exports = { CryptoUtil };
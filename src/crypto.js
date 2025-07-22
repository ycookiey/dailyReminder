const { webcrypto } = require('node:crypto');

class CryptoUtil {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  async encrypt(plaintext) {
    try {
      console.log('🔐 Web Crypto API形式で暗号化開始');
      const keyBuffer = new TextEncoder().encode(this.secretKey.padEnd(32, '0').slice(0, 32));
      
      const key = await webcrypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const dataBuffer = new TextEncoder().encode(JSON.stringify(plaintext));
      
      const encryptedBuffer = await webcrypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
      );
      
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);
      
      const result = Buffer.from(combined).toString('base64');
      console.log('✓ Web Crypto API暗号化完了');
      return result;
    } catch (error) {
      throw new Error(`暗号化に失敗しました: ${error.message}`);
    }
  }

  async decrypt(ciphertext) {
    try {
      console.log('🔓 Web Crypto API形式で復号化開始');
      const keyBuffer = new TextEncoder().encode(this.secretKey.padEnd(32, '0').slice(0, 32));
      
      const key = await webcrypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const encryptedBuffer = new Uint8Array(Buffer.from(ciphertext, 'base64'));
      const iv = encryptedBuffer.slice(0, 12);
      const data = encryptedBuffer.slice(12);
      
      const decryptedBuffer = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      console.log('✓ Web Crypto API復号化完了');
      return JSON.parse(decryptedText);
    } catch (error) {
      throw new Error(`復号化に失敗しました: ${error.message}`);
    }
  }

  static generateKey(length = 32) {
    const array = new Uint8Array(length);
    webcrypto.getRandomValues(array);
    return Buffer.from(array).toString('hex');
  }
}

module.exports = { CryptoUtil };
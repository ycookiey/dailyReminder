#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { CryptoUtil } = require('../src/crypto.js');

class ConfigEncryptor {
  constructor() {
    this.configPath = path.join(process.cwd(), 'reminders.json');
    this.outputPath = path.join(process.cwd(), 'encrypted-reminders.json');
  }

  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('reminders.jsonファイルが見つかりません。');
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`reminders.jsonの読み込みに失敗しました: ${error.message}`);
    }
  }

  encrypt() {
    try {
      console.log('🔐 設定ファイルの暗号化を開始します...\n');

      const secretKey = process.env.ENCRYPTION_SECRET_KEY;
      if (!secretKey) {
        console.log('ENCRYPTION_SECRET_KEY環境変数が設定されていません。');
        console.log('新しい暗号化キーを生成します...');
        
        const newKey = CryptoUtil.generateKey();
        console.log('\n生成された暗号化キー:');
        console.log(newKey);
        console.log('\nこのキーを.envファイルのENCRYPTION_SECRET_KEYに設定してください。');
        process.exit(1);
      }

      console.log('1. 設定ファイルを読み込み中...');
      const config = this.loadConfig();
      console.log('✓ 設定ファイルの読み込みが完了しました。');

      console.log('\n2. 設定ファイルを暗号化中...');
      const crypto = new CryptoUtil(secretKey);
      const encrypted = crypto.encrypt(config);
      console.log('✓ 暗号化が完了しました。');

      console.log('\n3. 暗号化ファイルを保存中...');
      const output = {
        encrypted: encrypted,
        lastUpdated: new Date().toISOString(),
        note: "この暗号化されたファイルはGitHubにプッシュされます"
      };

      fs.writeFileSync(this.outputPath, JSON.stringify(output, null, 2), 'utf8');
      console.log('✓ 暗号化されたファイルを保存しました:', this.outputPath);

      console.log('\n🎉 暗号化が正常に完了しました！');

    } catch (error) {
      console.error('\n❌ 暗号化中にエラーが発生しました:');
      console.error(error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const encryptor = new ConfigEncryptor();
  encryptor.encrypt();
}

module.exports = { ConfigEncryptor };
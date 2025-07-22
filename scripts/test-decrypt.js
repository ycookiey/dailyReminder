#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { CryptoUtil } = require('../src/crypto.js');

// 環境変数を手動で読み込み
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^"/, '').replace(/"$/, '');
    }
  });
}

class DecryptTester {
  constructor() {
    this.encryptedPath = path.join(process.cwd(), 'encrypted-reminders.json');
  }

  async testDecrypt() {
    try {
      console.log('🔓 復号化テストを開始します...\n');

      const secretKey = process.env.ENCRYPTION_SECRET_KEY;
      if (!secretKey) {
        throw new Error('ENCRYPTION_SECRET_KEY環境変数が設定されていません。');
      }

      console.log('1. 暗号化ファイルを読み込み中...');
      if (!fs.existsSync(this.encryptedPath)) {
        throw new Error('encrypted-reminders.jsonファイルが見つかりません。');
      }

      const encryptedData = JSON.parse(fs.readFileSync(this.encryptedPath, 'utf8'));
      console.log('✓ 暗号化ファイルの読み込みが完了しました。');
      console.log('  - 最終更新:', encryptedData.lastUpdated);

      console.log('\n2. 復号化を実行中...');
      const crypto = new CryptoUtil(secretKey);
      const decrypted = crypto.decrypt(encryptedData.encrypted);
      console.log('✓ 復号化が完了しました。');

      console.log('\n3. 復号化結果を表示中...');
      console.log('復号化されたデータ:');
      console.log(JSON.stringify(decrypted, null, 2));

      console.log('\n🎉 復号化テストが正常に完了しました！');

    } catch (error) {
      console.error('\n❌ 復号化テスト中にエラーが発生しました:');
      console.error(error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const tester = new DecryptTester();
  tester.testDecrypt();
}

module.exports = { DecryptTester };
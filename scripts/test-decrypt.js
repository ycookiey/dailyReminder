#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { CryptoUtil } = require('../src/crypto.js');

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
      console.log('🔍 暗号化データの詳細:');
      console.log('- 暗号化データ長:', encryptedData.encrypted.length);
      console.log('- 暗号化データの最初の100文字:', encryptedData.encrypted.substring(0, 100));
      console.log('- 秘密鍵長:', secretKey.length);
      console.log('- 秘密鍵の最初の20文字:', secretKey.substring(0, 20));
      
      const crypto = new CryptoUtil(secretKey);
      const decrypted = await crypto.decrypt(encryptedData.encrypted);
      console.log('✓ 復号化が完了しました。');

      console.log('\n3. 復号化結果を表示中...');
      console.log('🔍 復号化結果の詳細:');
      console.log('- 復号化結果の型:', typeof decrypted);
      console.log('- 復号化結果がオブジェクトか:', typeof decrypted === 'object');
      console.log('- キーの数:', Object.keys(decrypted || {}).length);
      if (decrypted && typeof decrypted === 'object') {
        console.log('- countdowns:', decrypted.countdowns?.length || 0, '件');
        console.log('- yearlyTasks:', decrypted.yearlyTasks?.length || 0, '件');
        console.log('- monthlyTasks:', decrypted.monthlyTasks?.length || 0, '件');
        console.log('- weeklyTasks:', decrypted.weeklyTasks?.length || 0, '件');
      }
      
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
  tester.testDecrypt().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

module.exports = { DecryptTester };
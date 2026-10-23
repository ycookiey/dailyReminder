#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Cloudflare Workers Secretsを強制的に更新するスクリプト
 * 既存のシークレットを削除してから新しい値で再作成することで、
 * 確実に最新の値が反映されるようにする
 */

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      });
      console.log('✓ .envファイルから環境変数を読み込みました');
    } catch (error) {
      console.log('⚠️ .envファイルの読み込みに失敗しました:', error.message);
    }
  } else {
    console.log('ℹ️ .envファイルが見つかりません');
  }
}

function execWrangler(command, description) {
  try {
    console.log(`🔧 ${description}...`);
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe' 
    });
    console.log(`✓ ${description}完了`);
    return { success: true, output: result };
  } catch (error) {
    console.log(`❌ ${description}失敗:`, error.message);
    return { success: false, error: error.message, output: error.stdout };
  }
}

function deleteSecret(secretName) {
  const result = execWrangler(
    `wrangler secret delete ${secretName}`,
    `${secretName}シークレット削除`
  );
  
  // 削除は存在しない場合もエラーになるが、それは問題ない
  if (!result.success && !result.error.includes('not found') && !result.error.includes('does not exist')) {
    throw new Error(`${secretName}の削除でエラー: ${result.error}`);
  }
  
  return result;
}

function createSecret(secretName, value) {
  const tempFile = path.join(__dirname, `.temp_${secretName}_${Date.now()}.txt`);
  
  try {
    fs.writeFileSync(tempFile, value, 'utf8');
    
    const result = execWrangler(
      `wrangler secret put ${secretName} < "${tempFile}"`,
      `${secretName}シークレット作成`
    );
    
    if (!result.success) {
      throw new Error(`${secretName}の作成でエラー: ${result.error}`);
    }
    
    return result;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function forceUpdateSecret(secretName, value, description) {
  console.log(`\n🔄 ${description}を強制更新中...`);
  console.log(`   シークレット名: ${secretName}`);
  console.log(`   値の長さ: ${value.length}文字`);
  console.log(`   値の最初の50文字: ${value.substring(0, 50)}...`);
  
  deleteSecret(secretName);
  
  createSecret(secretName, value);
  
  console.log(`✅ ${description}の強制更新完了`);
}

async function main() {
  try {
    console.log('🚀 Cloudflare Workers Secrets 強制更新を開始します...\n');
    
    loadEnvFile();
    
    const requiredEnvVars = [
      'DISCORD_WEBHOOK_URL',
      'MANUAL_TRIGGER_SECRET_KEY',
      'ENCRYPTION_SECRET_KEY'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`必須環境変数 ${envVar} が設定されていません`);
      }
    }
    
    const encryptedFilePath = path.join(process.cwd(), 'encrypted-reminders.json');
    if (!fs.existsSync(encryptedFilePath)) {
      throw new Error('encrypted-reminders.json が見つかりません。先に暗号化を実行してください。');
    }
    
    const encryptedData = JSON.parse(fs.readFileSync(encryptedFilePath, 'utf8'));
    const encryptedReminders = encryptedData.encrypted;
    
    console.log('📋 更新対象のシークレット:');
    console.log(`- DISCORD_WEBHOOK_URL (${process.env.DISCORD_WEBHOOK_URL.length}文字)`);
    console.log(`- MANUAL_TRIGGER_SECRET_KEY (${process.env.MANUAL_TRIGGER_SECRET_KEY.length}文字)`);
    console.log(`- ENCRYPTION_SECRET_KEY (${process.env.ENCRYPTION_SECRET_KEY.length}文字)`);
    console.log(`- ENCRYPTED_REMINDERS_CONFIG (${encryptedReminders.length}文字)`);
    
    forceUpdateSecret('DISCORD_WEBHOOK_URL', process.env.DISCORD_WEBHOOK_URL, 'Discord Webhook URL');
    forceUpdateSecret('MANUAL_TRIGGER_SECRET_KEY', process.env.MANUAL_TRIGGER_SECRET_KEY, '手動実行シークレットキー');
    forceUpdateSecret('ENCRYPTION_SECRET_KEY', process.env.ENCRYPTION_SECRET_KEY, '暗号化シークレットキー');
    forceUpdateSecret('ENCRYPTED_REMINDERS_CONFIG', encryptedReminders, '暗号化リマインダー設定');
    
    console.log('\n🎉 すべてのシークレットの強制更新が完了しました！');
    console.log('\n⚠️  Cloudflare Workers は数秒から数分で新しい設定を反映します。');
    console.log('    すぐにテストを実行する場合は、1-2分待ってから実行することをお勧めします。');
    
  } catch (error) {
    console.error('\n❌ シークレット更新中にエラーが発生しました:');
    console.error(error.message);
    
    console.log('\n🔧 トラブルシューティング:');
    console.log('- .envファイルが正しく設定されているか確認');
    console.log('- wranglerがインストールされ、認証されているか確認');
    console.log('- encrypted-reminders.json が最新の状態か確認');
    console.log('- Cloudflareのアカウント権限を確認');
    
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Cloudflare Workers Secrets 強制更新スクリプト\n');
    console.log('使用方法:');
    console.log('  npm run force-update-secrets     # 全シークレットを強制更新');
    console.log('  node scripts/force-update-secrets.js');
    console.log('');
    console.log('このスクリプトは:');
    console.log('1. 既存のシークレットを削除');
    console.log('2. 新しい値でシークレットを再作成');
    console.log('3. 確実に最新の値が反映されることを保証');
    console.log('');
    console.log('必要なファイル:');
    console.log('- .env (環境変数)');
    console.log('- encrypted-reminders.json (暗号化済み設定)');
    process.exit(0);
  }
  
  return {};
}

if (require.main === module) {
  const options = parseArgs();
  main();
}

module.exports = { forceUpdateSecret, loadEnvFile };
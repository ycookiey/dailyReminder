#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

loadEnvFile();

class ProductionTester {
  constructor() {
    this.workerUrl = null;
    this.secretKey = process.env.MANUAL_TRIGGER_SECRET_KEY;
  }

  async getWorkerUrl() {
    // 環境変数から取得を試行
    if (process.env.WORKER_URL) {
      return process.env.WORKER_URL;
    }

    // GitHub Secretsから取得を試行
    try {
      const { execSync } = require('child_process');
      const result = execSync('gh secret get WORKER_URL', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      if (result && result.trim()) {
        return result.trim();
      }
    } catch (error) {
      // GitHub CLI が使用できない、またはSecretが設定されていない
    }

    // Cloudflare Workers のデフォルトURL形式を試行
    const workerName = 'daily-reminder';
    console.log(`\n⚠️ Worker URLが設定されていません。`);
    console.log(`一般的なCloudflare Workers URLは以下の形式です:`);
    console.log(`https://${workerName}.[your-subdomain].workers.dev`);
    console.log(`\n正確なURLを入力してください（Enterでスキップ）:`);
    
    // Node.jsでの標準入力は複雑なので、エラーメッセージで案内
    throw new Error('Worker URLを.envファイルのWORKER_URL、またはGitHub SecretsのWORKER_URLに設定してください。');
  }

  async testWorkerHealth(workerUrl, maxRetries = 3) {
    console.log('\n🧪 Worker ヘルスチェック実行中...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`試行 ${attempt}/${maxRetries} - 5秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const response = await fetch(`${workerUrl}/health`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Worker ヘルスチェック成功 (試行: ${attempt})`);
          console.log(`📊 ステータス: ${data.status}`);
          console.log(`⏰ タイムスタンプ: ${data.timestamp}`);
          
          // バージョン情報の確認
          if (data.version) {
            console.log(`🔖 バージョン: ${data.version}`);
            console.log('✅ 最新バージョンが反映されています');
            return true;
          } else {
            console.log('⚠️  バージョン情報がありません - 古いバージョンの可能性');
            if (attempt === maxRetries) {
              console.log('❌ 最終試行でもバージョンが確認できませんでした');
              return false;
            }
          }
        } else {
          console.log(`❌ ヘルスチェック失敗: HTTP ${response.status}`);
          if (attempt === maxRetries) {
            console.log('❌ 最終試行でも失敗しました');
            return false;
          } else {
            console.log('⚠️  再試行中...');
          }
        }
      } catch (error) {
        console.log(`❌ ヘルスチェック失敗: ${error.message}`);
        if (attempt === maxRetries) {
          console.log('❌ 最終試行でも失敗しました');
          return false;
        } else {
          console.log('⚠️  再試行中...');
        }
      }
    }
    
    return false;
  }

  async triggerReminder(workerUrl, secretKey) {
    console.log('\n🚀 本番リマインダー手動実行中...');
    
    if (!secretKey) {
      throw new Error('MANUAL_TRIGGER_SECRET_KEY環境変数が設定されていません。');
    }

    try {
      const response = await fetch(`${workerUrl}/manual-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ リマインダー実行成功！');
        console.log(`📅 処理日: ${result.date}`);
        console.log(`📝 リマインダー数: ${result.reminderCount}件`);
        console.log(`📨 送信メッセージ数: ${result.messageCount}件`);
        console.log(`⏰ 実行時刻: ${result.timestamp}`);
        
        if (result.reminderCount === 0) {
          console.log('\n📭 今日は通知すべきリマインダーがありません');
          console.log('💡 Discordには「本日のリマインド事項はありません」メッセージが送信されます');
        }
        
        return result;
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      throw new Error(`リマインダー実行に失敗しました: ${error.message}`);
    }
  }

  async run(options = {}) {
    try {
      console.log('🎯 Daily Reminder 本番環境テストを開始します...\n');

      // Worker URL取得
      console.log('1. Worker URL取得中...');
      const workerUrl = await this.getWorkerUrl();
      console.log(`✓ Worker URL: ${workerUrl}`);

      // ヘルスチェック
      if (!options.skipHealthCheck) {
        const healthOk = await this.testWorkerHealth(workerUrl);
        if (!healthOk && !options.force) {
          throw new Error('ヘルスチェックに失敗しました。--force オプションで強制実行できます。');
        }
      }

      // リマインダー実行
      const result = await this.triggerReminder(workerUrl, this.secretKey);

      console.log('\n🎉 本番環境テストが正常に完了しました！');
      console.log('\n📱 Discordチャンネルで通知を確認してください。');
      
      return {
        success: true,
        workerUrl,
        result
      };

    } catch (error) {
      console.error('\n❌ 本番環境テスト中にエラーが発生しました:');
      console.error(error.message);
      
      console.log('\n🔧 トラブルシューティング:');
      console.log('- Worker URLが正しく設定されているか確認');
      console.log('- MANUAL_TRIGGER_SECRET_KEY が正しく設定されているか確認');
      console.log('- Cloudflare Workers が正常にデプロイされているか確認');
      console.log('- https://dash.cloudflare.com/workers/ でWorkerの状態を確認');
      
      process.exit(1);
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    skipHealthCheck: false,
    force: false
  };

  if (args.includes('--skip-health') || args.includes('-s')) {
    options.skipHealthCheck = true;
    console.log('⚡ ヘルスチェックをスキップします');
  }

  if (args.includes('--force') || args.includes('-f')) {
    options.force = true;
    console.log('💪 強制実行モードが有効です');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Daily Reminder 本番環境テストスクリプト\n');
    console.log('使用方法:');
    console.log('  npm run test-production              # フル本番テスト実行');
    console.log('  npm run test-production -- --skip-health # ヘルスチェックスキップ');
    console.log('  npm run test-production -- -s           # 同上（短縮形）');
    console.log('  npm run test-production -- --force      # ヘルスチェック失敗でも強制実行');
    console.log('  npm run test-production -- --help       # このヘルプを表示');
    console.log('');
    console.log('オプション:');
    console.log('  --skip-health, -s  ヘルスチェックをスキップ');
    console.log('  --force, -f        ヘルスチェック失敗時も強制実行');
    console.log('  --help, -h         ヘルプを表示');
    console.log('');
    console.log('必要な環境変数:');
    console.log('  MANUAL_TRIGGER_SECRET_KEY  手動実行用のシークレットキー');
    console.log('  WORKER_URL                 CloudflareワーカーのURL（オプション）');
    process.exit(0);
  }

  return options;
}

if (require.main === module) {
  const options = parseArgs();
  const tester = new ProductionTester();
  tester.run(options);
}

module.exports = { ProductionTester };
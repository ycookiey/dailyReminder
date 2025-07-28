#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CryptoUtil } = require('../src/crypto.js');

class DeploymentManager {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
    this.configPath = path.join(process.cwd(), 'reminders.json');
    this.encryptedConfigPath = path.join(process.cwd(), 'encrypted-reminders.json');
  }

  loadEnvFile() {
    if (!fs.existsSync(this.envPath)) {
      throw new Error('.envファイルが見つかりません。.env.exampleを参考に.envファイルを作成してください。');
    }

    const envContent = fs.readFileSync(this.envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
        }
      }
    });

    const requiredVars = [
      'DISCORD_WEBHOOK_URL',
      'MANUAL_TRIGGER_SECRET_KEY',
      'ENCRYPTION_SECRET_KEY'
    ];

    for (const varName of requiredVars) {
      if (!envVars[varName]) {
        throw new Error(`必須の環境変数 ${varName} が.envファイルに設定されていません。`);
      }
    }

    return envVars;
  }

  loadReminderConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('reminders.jsonファイルが見つかりません。');
    }

    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      console.log('📄 reminders.jsonの文字数:', configContent.length);
      console.log('📄 reminders.jsonの最初の100文字:', configContent.substring(0, 100));
      
      const parsed = JSON.parse(configContent);
      console.log('📊 読み込み後の設定詳細:');
      console.log('- countdowns:', parsed?.countdowns?.length || 0, '件');
      console.log('- yearlyTasks:', parsed?.yearlyTasks?.length || 0, '件');
      console.log('- monthlyTasks:', parsed?.monthlyTasks?.length || 0, '件');
      console.log('- weeklyTasks:', parsed?.weeklyTasks?.length || 0, '件');
      console.log('- specificWeekTasks:', parsed?.specificWeekTasks?.length || 0, '件');
      console.log('- lastWeekTasks:', parsed?.lastWeekTasks?.length || 0, '件');
      
      return parsed;
    } catch (error) {
      throw new Error(`reminders.jsonの読み込みに失敗しました: ${error.message}`);
    }
  }

  async encryptConfig(config, secretKey) {
    try {
      console.log('🔍 暗号化前の設定内容を確認:');
      console.log('- countdowns:', config?.countdowns?.length || 0, '件');
      console.log('- yearlyTasks:', config?.yearlyTasks?.length || 0, '件');
      console.log('- monthlyTasks:', config?.monthlyTasks?.length || 0, '件');
      console.log('- weeklyTasks:', config?.weeklyTasks?.length || 0, '件');
      console.log('- specificWeekTasks:', config?.specificWeekTasks?.length || 0, '件');
      console.log('- lastWeekTasks:', config?.lastWeekTasks?.length || 0, '件');
      
      if (!config || Object.keys(config).length === 0) {
        throw new Error('設定ファイルが空またはundefinedです。reminders.jsonの内容を確認してください。');
      }
      
      // 暗号化前の設定を保存（検証用）
      const originalConfig = JSON.parse(JSON.stringify(config));
      
      console.log('\n🔐 設定を暗号化中...');
      const crypto = new CryptoUtil(secretKey);
      const encryptedData = await crypto.encrypt(config);
      console.log('✓ 暗号化完了');
      
      console.log('\n🔍 暗号化結果を検証中...');
      console.log('- 暗号化データ長:', encryptedData.length);
      console.log('- 暗号化データの最初の100文字:', encryptedData.substring(0, 100));
      
      // 暗号化→復号化のラウンドトリップテスト
      console.log('🔄 復号化テスト実行中...');
      const decryptedConfig = await crypto.decrypt(encryptedData);
      console.log('✓ 復号化テスト完了');
      
      // 設定内容の一致を検証
      console.log('📊 設定内容の一致を検証中...');
      const isValid = await this.validateConfigConsistency(originalConfig, decryptedConfig);
      
      if (!isValid) {
        console.error('❌ 暗号化前後で設定内容が一致しません！');
        console.error('元の設定:', JSON.stringify(originalConfig, null, 2));
        console.error('復号化後の設定:', JSON.stringify(decryptedConfig, null, 2));
        throw new Error('暗号化前後の設定内容が一致しません。暗号化処理に問題があります。');
      }
      
      console.log('✅ 設定内容の一致を確認しました');
      return encryptedData;
      
    } catch (error) {
      throw new Error(`設定ファイルの暗号化に失敗しました: ${error.message}`);
    }
  }

  async validateConfigConsistency(originalConfig, decryptedConfig) {
    try {
      // 基本的なフィールドの存在確認
      const requiredFields = ['countdowns', 'yearlyTasks', 'monthlyTasks', 'weeklyTasks', 'specificWeekTasks', 'lastWeekTasks'];
      
      for (const field of requiredFields) {
        if (!decryptedConfig.hasOwnProperty(field)) {
          console.error(`❌ 必須フィールド '${field}' が復号化後に存在しません`);
          return false;
        }
      }
      
      // 配列の長さを比較
      const fieldsToCompare = [
        { name: 'countdowns', original: originalConfig.countdowns?.length || 0, decrypted: decryptedConfig.countdowns?.length || 0 },
        { name: 'yearlyTasks', original: originalConfig.yearlyTasks?.length || 0, decrypted: decryptedConfig.yearlyTasks?.length || 0 },
        { name: 'monthlyTasks', original: originalConfig.monthlyTasks?.length || 0, decrypted: decryptedConfig.monthlyTasks?.length || 0 },
        { name: 'weeklyTasks', original: originalConfig.weeklyTasks?.length || 0, decrypted: decryptedConfig.weeklyTasks?.length || 0 },
        { name: 'specificWeekTasks', original: originalConfig.specificWeekTasks?.length || 0, decrypted: decryptedConfig.specificWeekTasks?.length || 0 },
        { name: 'lastWeekTasks', original: originalConfig.lastWeekTasks?.length || 0, decrypted: decryptedConfig.lastWeekTasks?.length || 0 }
      ];
      
      console.log('📋 各フィールドの比較:');
      for (const field of fieldsToCompare) {
        console.log(`- ${field.name}: 元=${field.original}件, 復号化後=${field.decrypted}件`);
        if (field.original !== field.decrypted) {
          console.error(`❌ ${field.name}の件数が一致しません！（元: ${field.original}, 復号化後: ${field.decrypted}）`);
          return false;
        }
      }
      
      // カウントダウンの詳細比較（重要）
      if (originalConfig.countdowns && originalConfig.countdowns.length > 0) {
        console.log('🔍 カウントダウンの詳細比較:');
        for (let i = 0; i < originalConfig.countdowns.length; i++) {
          const original = originalConfig.countdowns[i];
          const decrypted = decryptedConfig.countdowns[i];
          
          console.log(`  ${i + 1}. 元: "${original.name}" -> 復号化後: "${decrypted.name}"`);
          
          if (original.name !== decrypted.name || 
              original.targetDate !== decrypted.targetDate || 
              original.enabled !== decrypted.enabled) {
            console.error(`❌ カウントダウン ${i + 1} の内容が一致しません！`);
            console.error('  元:', original);
            console.error('  復号化後:', decrypted);
            return false;
          }
        }
      }
      
      console.log('✅ すべてのフィールドが一致しています');
      return true;
      
    } catch (error) {
      console.error('❌ 設定検証中にエラーが発生しました:', error.message);
      return false;
    }
  }

  async updateCloudflareSecrets(envVars, encryptedConfig, forceUpdate = false) {
    console.log(forceUpdate ? 'Cloudflare Workers Secretsを強制更新中...' : 'Cloudflare Workers Secretsを更新中...');

    const secrets = {
      DISCORD_WEBHOOK_URL: envVars.DISCORD_WEBHOOK_URL,
      MANUAL_TRIGGER_SECRET_KEY: envVars.MANUAL_TRIGGER_SECRET_KEY,
      ENCRYPTION_SECRET_KEY: envVars.ENCRYPTION_SECRET_KEY,
      ENCRYPTED_REMINDERS_CONFIG: encryptedConfig
    };

    try {
      for (const [key, value] of Object.entries(secrets)) {
        console.log(`  ${key}を${forceUpdate ? '強制' : ''}更新中...`);
        if (key === 'ENCRYPTED_REMINDERS_CONFIG') {
          console.log(`  🔍 ${key}の値の最初の50文字: ${value.substring(0, 50)}`);
          console.log(`  🔍 ${key}の値の長さ: ${value.length}`);
        }
        
        if (forceUpdate) {
          // 強制更新: 既存のシークレットを削除してから再作成
          try {
            console.log(`    🗑️ 既存の${key}を削除中...`);
            execSync(`npx wrangler secret delete ${key}`, {
              stdio: ['pipe', 'pipe', 'pipe']
            });
            console.log(`    ✓ ${key}を削除しました`);
          } catch (deleteError) {
            // 削除に失敗（シークレットが存在しない場合など）は無視
            console.log(`    ⚠️ ${key}の削除をスキップ（存在しない可能性）`);
          }
          
          // 少し待機してから再作成
          console.log(`    ⏳ 1秒待機中...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // シークレットを作成/更新
        console.log(`    📝 ${key}を作成中...`);
        execSync(`npx wrangler secret put ${key}`, {
          input: value,
          stdio: ['pipe', 'inherit', 'inherit']
        });
        console.log(`    ✅ ${key}を${forceUpdate ? '強制' : ''}更新完了`);
      }
      console.log(`✓ すべてのSecretsが正常に${forceUpdate ? '強制' : ''}更新されました。`);
    } catch (error) {
      throw new Error(`Secrets更新中にエラーが発生しました: ${error.message}`);
    }
  }

  saveEncryptedConfig(encryptedConfig) {
    fs.writeFileSync(this.encryptedConfigPath, JSON.stringify({
      encrypted: encryptedConfig,
      lastUpdated: new Date().toISOString(),
      note: "この暗号化されたファイルはGitHubにプッシュされます"
    }, null, 2), 'utf8');
    
    console.log('✓ 暗号化された設定ファイルを保存しました:', this.encryptedConfigPath);
  }

  commitAndPush() {
    try {
      console.log('Gitリポジトリの状態を確認中...');
      
      try {
        execSync('git status', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('このディレクトリはGitリポジトリではありません。git init を実行してください。');
      }

      console.log('変更をコミットしています...');
      execSync('git add encrypted-reminders.json src/', { stdio: 'inherit' });
      
      try {
        execSync('git diff --staged --quiet');
        console.log('コミットすべき変更がありません。');
        return;
      } catch (error) {
      }

      const commitMessage = `Update encrypted reminders config - ${new Date().toISOString()}`;
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      
      console.log('リモートリポジトリにプッシュしています...');
      execSync('git push origin main', { stdio: 'inherit' });
      
      console.log('✓ GitHubへのプッシュが完了しました。');
    } catch (error) {
      throw new Error(`Git操作中にエラーが発生しました: ${error.message}`);
    }
  }

  async deploy(options = {}) {
    try {
      const forceUpdate = options.force || false;
      console.log(`🚀 Daily Reminder デプロイメントを開始します${forceUpdate ? '（強制更新モード）' : ''}...\n`);

      console.log('1. 環境変数を読み込み中...');
      const envVars = this.loadEnvFile();
      console.log('✓ 環境変数の読み込みが完了しました。');

      console.log('\n2. リマインダー設定を読み込み中...');
      const config = this.loadReminderConfig();
      console.log('✓ リマインダー設定の読み込みが完了しました。');

      console.log('\n3. 設定ファイルを暗号化中...');
      const encryptedConfig = await this.encryptConfig(config, envVars.ENCRYPTION_SECRET_KEY);
      console.log('✓ 設定ファイルの暗号化が完了しました。');

      console.log('\n4. 暗号化された設定ファイルを保存中...');
      this.saveEncryptedConfig(encryptedConfig);

      console.log(`\n5. Cloudflare Workers Secretsを${forceUpdate ? '強制' : ''}更新中...`);
      await this.updateCloudflareSecrets(envVars, encryptedConfig, forceUpdate);

      console.log('\n6. GitHubにプッシュ中...');
      this.commitAndPush();

      console.log(`\n🎉 デプロイメントが正常に完了しました${forceUpdate ? '（強制更新）' : ''}！`);
      console.log('GitHub Actionsが自動的にCloudflare Workersにデプロイを実行します。');
      console.log('\nデプロイ状況はGitHubのActionsタブで確認できます。');
      
      if (forceUpdate) {
        console.log('\n⚠️  強制更新により、Cloudflareでの反映に1-2分かかる場合があります。');
      }

    } catch (error) {
      console.error('\n❌ デプロイメント中にエラーが発生しました:');
      console.error(error.message);
      process.exit(1);
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    force: false
  };

  if (args.includes('--force') || args.includes('-f')) {
    options.force = true;
    console.log('💪 強制更新モードが有効です');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Daily Reminder デプロイスクリプト\n');
    console.log('使用方法:');
    console.log('  npm run deploy              # 通常のデプロイ');
    console.log('  npm run deploy -- --force   # 強制更新デプロイ');
    console.log('  npm run deploy -- -f        # 同上（短縮形）');
    console.log('');
    console.log('オプション:');
    console.log('  --force, -f    シークレットを削除してから再作成（確実に更新）');
    console.log('  --help, -h     ヘルプを表示');
    console.log('');
    console.log('強制更新モード:');
    console.log('- 既存のCloudflare Secretsを削除');
    console.log('- 新しい値でシークレットを再作成');
    console.log('- キャッシュ問題を回避して確実に最新設定を反映');
    process.exit(0);
  }

  return options;
}

if (require.main === module) {
  const options = parseArgs();
  const manager = new DeploymentManager();
  manager.deploy(options).catch(error => {
    console.error('予期しないデプロイエラー:', error);
    process.exit(1);
  });
}

module.exports = { DeploymentManager };
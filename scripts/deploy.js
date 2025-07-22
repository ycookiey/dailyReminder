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
      return JSON.parse(configContent);
    } catch (error) {
      throw new Error(`reminders.jsonの読み込みに失敗しました: ${error.message}`);
    }
  }

  async encryptConfig(config, secretKey) {
    try {
      const crypto = new CryptoUtil(secretKey);
      return await crypto.encrypt(config);
    } catch (error) {
      throw new Error(`設定ファイルの暗号化に失敗しました: ${error.message}`);
    }
  }

  updateCloudflareSecrets(envVars, encryptedConfig) {
    console.log('Cloudflare Workers Secretsを更新中...');

    const secrets = {
      DISCORD_WEBHOOK_URL: envVars.DISCORD_WEBHOOK_URL,
      MANUAL_TRIGGER_SECRET_KEY: envVars.MANUAL_TRIGGER_SECRET_KEY,
      ENCRYPTION_SECRET_KEY: envVars.ENCRYPTION_SECRET_KEY,
      ENCRYPTED_REMINDERS_CONFIG: encryptedConfig
    };

    try {
      for (const [key, value] of Object.entries(secrets)) {
        console.log(`  ${key}を更新中...`);
        execSync(`npx wrangler secret put ${key}`, {
          input: value,
          stdio: ['pipe', 'inherit', 'inherit']
        });
      }
      console.log('✓ すべてのSecretsが正常に更新されました。');
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

  async deploy() {
    try {
      console.log('🚀 Daily Reminder デプロイメントを開始します...\n');

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

      console.log('\n5. Cloudflare Workers Secretsを更新中...');
      this.updateCloudflareSecrets(envVars, encryptedConfig);

      console.log('\n6. GitHubにプッシュ中...');
      this.commitAndPush();

      console.log('\n🎉 デプロイメントが正常に完了しました！');
      console.log('GitHub Actionsが自動的にCloudflare Workersにデプロイを実行します。');
      console.log('\nデプロイ状況はGitHubのActionsタブで確認できます。');

    } catch (error) {
      console.error('\n❌ デプロイメント中にエラーが発生しました:');
      console.error(error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const manager = new DeploymentManager();
  manager.deploy().catch(error => {
    console.error('予期しないデプロイエラー:', error);
    process.exit(1);
  });
}

module.exports = { DeploymentManager };
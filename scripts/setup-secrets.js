#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = {};
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            envVars[key] = value;
          }
        }
      });
      return envVars;
    } catch (error) {
      throw new Error(`⚠️ .envファイルの読み込みに失敗しました: ${error.message}`);
    }
  } else {
    throw new Error('.envファイルが見つかりません。先に.envファイルを作成してください。');
  }
}

loadEnvFile();

class SecretsManager {
  constructor() {
    this.requiredSecrets = [
      'DISCORD_WEBHOOK_URL',
      'MANUAL_TRIGGER_SECRET_KEY', 
      'ENCRYPTION_SECRET_KEY'
    ];
    
    this.optionalSecrets = [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'WORKER_URL'
    ];
  }

  checkGHCLI() {
    try {
      execSync('gh --version', { stdio: 'pipe' });
      console.log('✓ GitHub CLI (gh) が利用可能です');
    } catch (error) {
      throw new Error('GitHub CLI (gh) がインストールされていません。https://cli.github.com/ からインストールしてください。');
    }
  }

  checkGHAuth() {
    try {
      const result = execSync('gh auth status', { stdio: 'pipe', encoding: 'utf8' });
      console.log('✓ GitHub CLI にログイン済みです');
      return true;
    } catch (error) {
      throw new Error('GitHub CLI にログインしていません。"gh auth login" を実行してください。');
    }
  }

  getRepoInfo() {
    try {
      const result = execSync('gh repo view --json owner,name', { stdio: 'pipe', encoding: 'utf8' });
      const repoInfo = JSON.parse(result);
      console.log(`✓ リポジトリを確認: ${repoInfo.owner.login}/${repoInfo.name}`);
      return `${repoInfo.owner.login}/${repoInfo.name}`;
    } catch (error) {
      throw new Error('GitHubリポジトリの情報を取得できません。このディレクトリがGitリポジトリで、GitHubにプッシュされているか確認してください。');
    }
  }

  async setSecret(key, value) {
    try {
      execSync(`gh secret set ${key}`, {
        input: value,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      console.log(`✓ ${key} を設定しました`);
    } catch (error) {
      throw new Error(`${key} の設定に失敗しました: ${error.message}`);
    }
  }

  async promptForOptionalSecrets() {
    console.log('\n🔧 オプショナルなSecretsの設定:');
    console.log('以下の値は後で手動で設定することもできます:');
    
    for (const secretKey of this.optionalSecrets) {
      console.log(`\n${secretKey}:`);
      switch (secretKey) {
        case 'CLOUDFLARE_API_TOKEN':
          console.log('  - Cloudflareダッシュボード > My Profile > API Tokens で作成');
          console.log('  - 権限: Zone:Zone:Read, Zone:Zone Settings:Edit, Account:Cloudflare Workers:Edit');
          break;
        case 'CLOUDFLARE_ACCOUNT_ID':
          console.log('  - Cloudflareダッシュボード右側のAccount IDをコピー');
          break;
        case 'WORKER_URL':
          console.log('  - デプロイ後のWorker URL (例: https://daily-reminder.your-subdomain.workers.dev)');
          break;
      }
      
      console.log(`  設定しますか？ [y/N]`);
      console.log('  (Enterキーでスキップ、値を入力して設定)');
      
      // Node.jsでは標準入力からの読み込みが複雑なため、
      // ここでは手動設定の案内のみ表示
      console.log(`  手動設定コマンド: echo "your-${secretKey.toLowerCase().replace(/_/g, '-')}" | gh secret set ${secretKey}`);
    }
  }

  async setupSecrets() {
    try {
      console.log('🔐 GitHub Secrets自動設定スクリプトを開始します...\n');

      console.log('1. 前提条件をチェック中...');
      this.checkGHCLI();
      this.checkGHAuth();
      const repoName = this.getRepoInfo();

      console.log('\n2. .envファイルから環境変数を読み込み中...');
      const envVars = loadEnvFile();
      console.log('✓ 環境変数の読み込みが完了しました');

      console.log('\n3. 必須のSecretsを設定中...');
      let missingSecrets = [];

      for (const secretKey of this.requiredSecrets) {
        if (envVars[secretKey]) {
          await this.setSecret(secretKey, envVars[secretKey]);
        } else {
          missingSecrets.push(secretKey);
        }
      }

      if (missingSecrets.length > 0) {
        console.log(`\n⚠️ 以下のSecretが.envファイルに見つかりません:`);
        missingSecrets.forEach(key => console.log(`  - ${key}`));
        console.log('.envファイルを確認して、不足している値を追加してください。');
      }

      // 暗号化された設定ファイルがあれば、それもSecretsに追加
      const encryptedConfigPath = path.join(process.cwd(), 'encrypted-reminders.json');
      if (fs.existsSync(encryptedConfigPath)) {
        console.log('\n4. 暗号化された設定ファイルをSecretsに追加中...');
        try {
          const encryptedConfig = fs.readFileSync(encryptedConfigPath, 'utf8');
          const parsed = JSON.parse(encryptedConfig);
          await this.setSecret('ENCRYPTED_REMINDERS_CONFIG', parsed.encrypted);
        } catch (error) {
          console.log(`⚠️ 暗号化設定ファイルの追加に失敗: ${error.message}`);
        }
      }

      await this.promptForOptionalSecrets();

      console.log('\n🎉 必須Secretsの設定が完了しました！');
      console.log('\n次の手順:');
      console.log('1. Cloudflare関連のSecretsを手動で設定');
      console.log('2. GitHub Actionsワークフローをテストするため、コードをプッシュ');
      console.log('\n設定されたSecretsを確認:');
      console.log('  gh secret list');

    } catch (error) {
      console.error('\n❌ Secrets設定中にエラーが発生しました:');
      console.error(error.message);
      
      console.log('\n手動設定の方法:');
      console.log('1. GitHubリポジトリ > Settings > Secrets and variables > Actions');
      console.log('2. "New repository secret" をクリック');
      console.log('3. 以下の値を個別に設定:');
      
      try {
        const envVars = loadEnvFile();
        this.requiredSecrets.forEach(key => {
          if (envVars[key]) {
            console.log(`   ${key}: ${envVars[key]}`);
          }
        });
      } catch (envError) {
        console.log('   (.envファイルから値を読み込めませんでした)');
      }
      
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const manager = new SecretsManager();
  manager.setupSecrets();
}

module.exports = { SecretsManager };
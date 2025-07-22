#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { CryptoUtil } = require('../src/crypto.js');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnvFile();

class ConfigValidator {
  constructor() {
    this.schemaPath = path.join(process.cwd(), 'schemas', 'reminders.schema.json');
    this.encryptedConfigPath = path.join(process.cwd(), 'encrypted-reminders.json');
    this.plainConfigPath = path.join(process.cwd(), 'reminders.json');
  }

  loadSchema() {
    if (!fs.existsSync(this.schemaPath)) {
      throw new Error('スキーマファイルが見つかりません: ' + this.schemaPath);
    }

    try {
      const schemaContent = fs.readFileSync(this.schemaPath, 'utf8');
      return JSON.parse(schemaContent);
    } catch (error) {
      throw new Error(`スキーマファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  loadEncryptedConfig() {
    if (!fs.existsSync(this.encryptedConfigPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.encryptedConfigPath, 'utf8');
      const parsed = JSON.parse(content);
      return parsed.encrypted;
    } catch (error) {
      throw new Error(`暗号化設定ファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  loadPlainConfig() {
    if (!fs.existsSync(this.plainConfigPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.plainConfigPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`平文設定ファイルの読み込みに失敗しました: ${error.message}`);
    }
  }

  decryptConfig(encryptedData, secretKey) {
    try {
      const crypto = new CryptoUtil(secretKey);
      return crypto.decrypt(encryptedData);
    } catch (error) {
      throw new Error(`設定ファイルの復号化に失敗しました: ${error.message}`);
    }
  }

  validateConfig(config, schema) {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    
    const valid = validate(config);
    
    if (!valid) {
      const errors = validate.errors.map(error => {
        const path = error.instancePath || 'root';
        return `${path}: ${error.message}`;
      }).join('\n');
      
      throw new Error(`設定ファイルのバリデーションに失敗しました:\n${errors}`);
    }
  }

  async validate() {
    try {
      console.log('📋 設定ファイルのバリデーションを開始します...\n');

      console.log('1. スキーマを読み込み中...');
      const schema = this.loadSchema();
      console.log('✓ スキーマの読み込みが完了しました。');

      const secretKey = process.env.ENCRYPTION_SECRET_KEY;
      if (!secretKey) {
        throw new Error('ENCRYPTION_SECRET_KEY環境変数が設定されていません。');
      }

      let config;
      let configSource;

      console.log('\n2. 設定ファイルを読み込み中...');
      
      const encryptedConfig = this.loadEncryptedConfig();
      const plainConfig = this.loadPlainConfig();

      if (encryptedConfig) {
        console.log('暗号化された設定ファイルを復号化中...');
        config = this.decryptConfig(encryptedConfig, secretKey);
        configSource = '暗号化ファイル';
      } else if (plainConfig) {
        console.log('平文の設定ファイルを使用します...');
        config = plainConfig;
        configSource = '平文ファイル';
      } else {
        throw new Error('設定ファイル（encrypted-reminders.json または reminders.json）が見つかりません。');
      }

      console.log(`✓ 設定ファイルの読み込みが完了しました（ソース: ${configSource}）。`);

      console.log('\n3. 設定内容を検証中...');
      this.validateConfig(config, schema);
      console.log('✓ 設定ファイルの検証が完了しました。');

      console.log('\n4. 設定サマリー:');
      console.log(`  - カウントダウン: ${config.countdowns?.length || 0} 件`);
      console.log(`  - 年次タスク: ${config.yearlyTasks?.length || 0} 件`);
      console.log(`  - 月次タスク: ${config.monthlyTasks?.length || 0} 件`);
      console.log(`  - 週次タスク: ${config.weeklyTasks?.length || 0} 件`);
      console.log(`  - 特定週タスク: ${config.specificWeekTasks?.length || 0} 件`);
      console.log(`  - 最終週タスク: ${config.lastWeekTasks?.length || 0} 件`);

      console.log('\n🎉 すべての検証が正常に完了しました！');

    } catch (error) {
      console.error('\n❌ バリデーション中にエラーが発生しました:');
      console.error(error.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const validator = new ConfigValidator();
  validator.validate();
}

module.exports = { ConfigValidator };
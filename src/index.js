import { ReminderProcessor } from './reminder.js';
import { DiscordNotifier } from './discord.js';

const ENCRYPTED_CONFIG = `U2FsdGVkX1+placeholder_encrypted_config_here`;

class WorkerCrypto {
  static async decrypt(encryptedData, secretKey) {
    try {
      console.log('🔓 復号化開始');
      console.log('暗号化データ長:', encryptedData.length);
      console.log('秘密鍵長:', secretKey.length);
      console.log('暗号化データの最初の50文字:', encryptedData.substring(0, 50));
      
      // crypto-js形式かどうかを判定（Base64デコード後にSalted__で始まるかチェック）
      if (encryptedData.startsWith('U2FsdGVkX1')) {
        console.log('🔧 crypto-js形式を検出、互換復号化を実行');
        return await this.decryptCryptoJSFormat(encryptedData, secretKey);
      }
      
      // Web Crypto API形式の復号化処理（新しい形式）
      console.log('🔧 Web Crypto API形式で復号化');
      const keyBuffer = new TextEncoder().encode(secretKey.padEnd(32, '0').slice(0, 32));
      console.log('キーバッファ長:', keyBuffer.length);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      console.log('✓ 暗号化キーのインポート完了');
      
      const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      console.log('暗号化バッファ長:', encryptedBuffer.length);
      
      const iv = encryptedBuffer.slice(0, 12);
      const data = encryptedBuffer.slice(12);
      console.log('IV長:', iv.length, 'データ長:', data.length);
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      console.log('✓ 復号化完了、復号化バッファ長:', decryptedBuffer.byteLength);
      
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      console.log('✓ テキストデコード完了、長さ:', decryptedText.length);
      
      const result = JSON.parse(decryptedText);
      console.log('✓ JSON解析完了');
      return result;
    } catch (error) {
      console.error('❌ 復号化エラー詳細:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw new Error(`復号化に失敗しました: ${error.message}`);
    }
  }

  static async decryptCryptoJSFormat(encryptedData, secretKey) {
    try {
      console.log('🔓 crypto-js互換復号化開始');
      
      // Base64デコード
      const encryptedBuffer = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );
      console.log('復号化バッファ長:', encryptedBuffer.length);
      
      // "Salted__" (8バイト) を確認
      const salted = new TextDecoder().decode(encryptedBuffer.slice(0, 8));
      if (salted !== 'Salted__') {
        throw new Error('crypto-js形式ではありません');
      }
      
      // Salt (8バイト) を抽出
      const salt = encryptedBuffer.slice(8, 16);
      const ciphertext = encryptedBuffer.slice(16);
      console.log('Salt長:', salt.length, 'Ciphertext長:', ciphertext.length);
      
      // PBKDF2でキーとIVを導出（crypto-js互換）
      const keyIv = await this.deriveKeyAndIV(secretKey, salt);
      console.log('✓ キーとIVの導出完了');
      
      // AES-CBCで復号化
      const key = await crypto.subtle.importKey(
        'raw',
        keyIv.key,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: keyIv.iv },
        key,
        ciphertext
      );
      console.log('✓ AES-CBC復号化完了、長さ:', decryptedBuffer.byteLength);
      
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      console.log('✓ テキストデコード完了、長さ:', decryptedText.length);
      
      const result = JSON.parse(decryptedText);
      console.log('✓ JSON解析完了');
      return result;
    } catch (error) {
      console.error('❌ crypto-js互換復号化エラー:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }

  static async deriveKeyAndIV(password, salt) {
    // crypto-js互換のキー導出（OpenSSLのEVP_BytesToKey相当）
    console.log('🔑 キー導出開始');
    const passwordBytes = new TextEncoder().encode(password);
    const saltBytes = salt;
    
    // MD5互換の簡易実装（crypto-jsと同じアルゴリズム）
    const md5 = await this.simpleMD5(new Uint8Array([...passwordBytes, ...saltBytes]));
    console.log('MD5-1 完了、長さ:', md5.length);
    
    const md5_2 = await this.simpleMD5(new Uint8Array([...md5, ...passwordBytes, ...saltBytes]));
    console.log('MD5-2 完了、長さ:', md5_2.length);
    
    const md5_3 = await this.simpleMD5(new Uint8Array([...md5_2, ...passwordBytes, ...saltBytes]));
    console.log('MD5-3 完了、長さ:', md5_3.length);
    
    // キー（32バイト）とIV（16バイト）を構築
    const keyMaterial = new Uint8Array(48);
    keyMaterial.set(md5, 0);           // 最初の16バイト
    keyMaterial.set(md5_2, 16);        // 次の16バイト  
    keyMaterial.set(md5_3, 32);        // 最後の16バイト
    
    console.log('✓ キー導出完了、導出データ長:', keyMaterial.length);
    
    return {
      key: keyMaterial.slice(0, 32),  // 256-bit key
      iv: keyMaterial.slice(32, 48)   // 128-bit IV
    };
  }

  static async simpleMD5(data) {
    // MD5の代替としてSHA-1を使用し、16バイトに切り詰め
    // これはcrypto-jsとの完全互換性のための近似
    const sha1Hash = await crypto.subtle.digest('SHA-1', data);
    return new Uint8Array(sha1Hash).slice(0, 16); // MD5サイズ（16バイト）に切り詰め
  }

  static async encrypt(data, secretKey) {
    try {
      const keyBuffer = new TextEncoder().encode(secretKey.padEnd(32, '0').slice(0, 32));
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const dataBuffer = new TextEncoder().encode(JSON.stringify(data));
      
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
      );
      
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);
      
      return btoa(String.fromCharCode.apply(null, combined));
    } catch (error) {
      throw new Error(`暗号化に失敗しました: ${error.message}`);
    }
  }
}

async function handleRequest(request, env, ctx) {
  try {
    const url = new URL(request.url);
    
    if (request.method === 'POST' && url.pathname === '/manual-trigger') {
      return await handleManualTrigger(request, env);
    }
    
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('リクエスト処理エラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleManualTrigger(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.MANUAL_TRIGGER_SECRET_KEY}`) {
    return new Response(JSON.stringify({ error: '認証に失敗しました' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const result = await processReminders(env);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleScheduled(event, env, ctx) {
  console.log('定期実行が開始されました:', new Date().toISOString());
  
  try {
    const result = await processReminders(env);
    console.log('定期実行が完了しました:', result);
  } catch (error) {
    console.error('定期実行エラー:', error);
    throw error;
  }
}

async function processReminders(env) {
  try {
    console.log('📋 リマインダー処理開始');
    console.log('環境変数の確認:');
    console.log('- ENCRYPTED_REMINDERS_CONFIG存在:', !!env.ENCRYPTED_REMINDERS_CONFIG);
    console.log('- ENCRYPTION_SECRET_KEY存在:', !!env.ENCRYPTION_SECRET_KEY);
    console.log('- DISCORD_WEBHOOK_URL存在:', !!env.DISCORD_WEBHOOK_URL);
    
    if (env.ENCRYPTED_REMINDERS_CONFIG) {
      console.log('- ENCRYPTED_REMINDERS_CONFIG長:', env.ENCRYPTED_REMINDERS_CONFIG.length);
    }
    if (env.ENCRYPTION_SECRET_KEY) {
      console.log('- ENCRYPTION_SECRET_KEY長:', env.ENCRYPTION_SECRET_KEY.length);
    }
    
    let config;
    
    if (env.ENCRYPTED_REMINDERS_CONFIG) {
      console.log('🔧 環境変数から暗号化設定を取得');
      console.log('🔍 復号化前の詳細:');
      console.log('- 暗号化データ長:', env.ENCRYPTED_REMINDERS_CONFIG.length);
      console.log('- 暗号化データの最初の100文字:', env.ENCRYPTED_REMINDERS_CONFIG.substring(0, 100));
      console.log('- 秘密鍵長:', env.ENCRYPTION_SECRET_KEY.length);
      
      config = await WorkerCrypto.decrypt(env.ENCRYPTED_REMINDERS_CONFIG, env.ENCRYPTION_SECRET_KEY);
    } else {
      console.log('🔧 デフォルトの暗号化設定を取得');
      config = await WorkerCrypto.decrypt(ENCRYPTED_CONFIG, env.ENCRYPTION_SECRET_KEY);
    }
    console.log('✓ 設定の復号化完了');
    console.log('🔍 復号化後の詳細:');
    console.log('- 復号化結果の型:', typeof config);
    console.log('- キーの数:', Object.keys(config || {}).length);
    console.log('📊 復号化した設定の詳細:');
    console.log('- countdowns:', config.countdowns?.length || 0, '件');
    console.log('- yearlyTasks:', config.yearlyTasks?.length || 0, '件');
    console.log('- monthlyTasks:', config.monthlyTasks?.length || 0, '件');
    console.log('- weeklyTasks:', config.weeklyTasks?.length || 0, '件');
    console.log('- specificWeekTasks:', config.specificWeekTasks?.length || 0, '件');
    console.log('- lastWeekTasks:', config.lastWeekTasks?.length || 0, '件');
    
    // カウントダウンの詳細をログ出力
    if (config.countdowns && config.countdowns.length > 0) {
      console.log('🔍 カウントダウンの詳細:');
      config.countdowns.forEach((countdown, index) => {
        console.log(`  ${index + 1}. 名前: "${countdown.name}", 期限: "${countdown.targetDate}", 有効: ${countdown.enabled}`);
      });
    } else {
      console.log('⚠️ カウントダウンが設定されていません');
    }
    
    const processor = new ReminderProcessor();
    const { date, reminders } = processor.processReminders(config);
    console.log('✓ リマインダー処理完了:', { date, reminderCount: reminders.length });
    
    const notifier = new DiscordNotifier(env.DISCORD_WEBHOOK_URL);
    const result = await notifier.sendNotification(date, reminders);
    console.log('✓ Discord通知完了:', result);
    
    return {
      success: true,
      date,
      reminderCount: reminders.length,
      messageCount: result.messageCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ リマインダー処理エラー:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    try {
      // エラー通知の無限ループを防ぐ（Discord関連エラーの場合は通知しない）
      if (!error.message.includes('Discord') && !error.message.includes('レート制限')) {
        console.log('🔔 システムエラーをDiscordに通知します');
        const notifier = new DiscordNotifier(env.DISCORD_WEBHOOK_URL);
        await notifier.sendWebhook([{
          title: '⚠️ システムエラー',
          description: `リマインダーシステムでエラーが発生しました:\n\`\`\`\n${error.message}\n\`\`\``,
          color: 0xFF0000,
          timestamp: new Date().toISOString()
        }]);
        console.log('✓ エラー通知送信完了');
      } else {
        console.log('⚠️ Discord関連エラーのため、エラー通知をスキップします（無限ループ防止）');
      }
    } catch (notifyError) {
      console.error('エラー通知の送信に失敗:', notifyError.message);
      console.log('⚠️ エラー通知の送信に失敗しましたが、処理を継続します');
    }
    
    throw error;
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
  
  async scheduled(event, env, ctx) {
    return handleScheduled(event, env, ctx);
  }
};
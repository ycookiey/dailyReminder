import { ReminderProcessor } from './reminder.js';
import { DiscordNotifier } from './discord.js';

const ENCRYPTED_CONFIG = `U2FsdGVkX1+placeholder_encrypted_config_here`;

class WorkerCrypto {
  static async decrypt(encryptedData, secretKey) {
    try {
      const keyBuffer = new TextEncoder().encode(secretKey.padEnd(32, '0').slice(0, 32));
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const encryptedBuffer = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );
      
      const iv = encryptedBuffer.slice(0, 12);
      const data = encryptedBuffer.slice(12);
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedText);
    } catch (error) {
      throw new Error(`復号化に失敗しました: ${error.message}`);
    }
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
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
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
    let config;
    
    if (env.ENCRYPTED_REMINDERS_CONFIG) {
      config = await WorkerCrypto.decrypt(env.ENCRYPTED_REMINDERS_CONFIG, env.ENCRYPTION_SECRET_KEY);
    } else {
      config = await WorkerCrypto.decrypt(ENCRYPTED_CONFIG, env.ENCRYPTION_SECRET_KEY);
    }
    
    const processor = new ReminderProcessor();
    const { date, reminders } = processor.processReminders(config);
    
    const notifier = new DiscordNotifier(env.DISCORD_WEBHOOK_URL);
    const result = await notifier.sendNotification(date, reminders);
    
    return {
      success: true,
      date,
      reminderCount: reminders.length,
      messageCount: result.messageCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('リマインダー処理エラー:', error);
    
    try {
      const notifier = new DiscordNotifier(env.DISCORD_WEBHOOK_URL);
      await notifier.sendWebhook([{
        title: '⚠️ システムエラー',
        description: `リマインダーシステムでエラーが発生しました:\n\`\`\`\n${error.message}\n\`\`\``,
        color: 0xFF0000,
        timestamp: new Date().toISOString()
      }]);
    } catch (notifyError) {
      console.error('エラー通知の送信に失敗:', notifyError);
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
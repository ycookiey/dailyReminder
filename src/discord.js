class DiscordNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.maxFieldsPerEmbed = 20;
  }

  createEmbed(date, reminders, isNoReminders = false) {
    const embed = {
      title: `🗓️ 本日のリマインダー (${date})`,
      color: isNoReminders ? 0x808080 : 0x5865F2,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Daily Reminder System'
      }
    };

    if (isNoReminders) {
      embed.description = '本日のリマインド事項はありません';
    } else {
      embed.fields = reminders.map((reminder, index) => ({
        name: `${index + 1}. リマインダー`,
        value: reminder,
        inline: false
      }));
    }

    return embed;
  }

  splitReminders(reminders) {
    const chunks = [];
    for (let i = 0; i < reminders.length; i += this.maxFieldsPerEmbed) {
      chunks.push(reminders.slice(i, i + this.maxFieldsPerEmbed));
    }
    return chunks;
  }

  async sendNotification(date, reminders) {
    try {
      if (!reminders || reminders.length === 0) {
        const embed = this.createEmbed(date, [], true);
        await this.sendWebhook([embed]);
        return { success: true, messageCount: 1 };
      }

      const reminderChunks = this.splitReminders(reminders);
      let messageCount = 0;

      for (let i = 0; i < reminderChunks.length; i++) {
        const chunk = reminderChunks[i];
        const embed = this.createEmbed(date, chunk);
        
        if (reminderChunks.length > 1) {
          embed.title += ` (${i + 1}/${reminderChunks.length})`;
        }

        await this.sendWebhook([embed]);
        messageCount++;

        if (i < reminderChunks.length - 1) {
          console.log(`⏳ 次のメッセージ送信まで2秒待機 (${i + 1}/${reminderChunks.length}完了)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return { success: true, messageCount };
    } catch (error) {
      console.error('Discord通知送信エラー:', error);
      throw new Error(`Discord通知の送信に失敗しました: ${error.message}`);
    }
  }

  async sendWebhook(embeds, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000;

    const payload = {
      embeds: embeds,
      username: 'Daily Reminder Bot'
    };

    try {
      console.log(`Discord API リクエスト送信中 (試行回数: ${retryCount + 1}/${maxRetries + 1})`);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Daily-Reminder-Bot/1.0'
        },
        body: JSON.stringify(payload)
      });

      console.log(`Discord API レスポンス: status=${response.status}, statusText="${response.statusText}"`);

      if (response.ok) {
        console.log('✓ Discord通知送信成功');
        return response;
      }

      let errorDetails;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          errorDetails = await response.json();
          console.log('Discord APIエラー詳細 (JSON):', JSON.stringify(errorDetails, null, 2));
        } catch (jsonError) {
          console.log('JSONパースエラー:', jsonError.message);
          errorDetails = await response.text();
          console.log('Discord APIエラー詳細 (テキスト):', errorDetails);
        }
      } else {
        errorDetails = await response.text();
        console.log('Discord APIエラー詳細 (テキスト):', errorDetails);
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retryAfterMs = response.headers.get('X-RateLimit-Reset-After');
        const resetTimestamp = response.headers.get('X-RateLimit-Reset');
        
        console.log(`⚠️ レート制限に達しました:`);
        console.log(`  - Retry-After: ${retryAfter}秒`);
        console.log(`  - X-RateLimit-Reset-After: ${retryAfterMs}秒`);
        console.log(`  - X-RateLimit-Reset: ${resetTimestamp}`);
        console.log(`  - 現在時刻: ${new Date().toISOString()}`);

        if (retryCount < maxRetries) {
          const waitTimeMs = retryAfter ? 
            (parseInt(retryAfter) * 1000) : 
            baseDelay * Math.pow(2, retryCount);
          
          console.log(`⏳ ${waitTimeMs}ms後に再試行します (${retryCount + 1}回目の再試行)`);
          await new Promise(resolve => setTimeout(resolve, waitTimeMs));
          
          return this.sendWebhook(embeds, retryCount + 1);
        } else {
          throw new Error(`レート制限エラー - 最大再試行回数に達しました: error code: ${errorDetails?.code || 'unknown'}`);
        }
      }

      if (response.status >= 500 && retryCount < maxRetries) {
        const waitTimeMs = baseDelay * Math.pow(2, retryCount);
        console.log(`⚠️ サーバーエラー (${response.status}): ${waitTimeMs}ms後に再試行します`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        return this.sendWebhook(embeds, retryCount + 1);
      }

      throw new Error(`Discord API エラー (${response.status}): error code: ${errorDetails?.code || 'unknown'}`);

    } catch (error) {
      if (error.message.includes('Discord API エラー') || error.message.includes('レート制限エラー')) {
        throw error; // 上で作ったエラーを、外側のエラーの文で二重に包まない
      }
      
      console.error('Discord通知送信中に予期しないエラー:', error);
      throw new Error(`Discord通知の送信に失敗しました: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const testEmbed = this.createEmbed(
        new Date().toLocaleDateString('ja-JP'),
        [],
        true
      );
      testEmbed.title = '🧪 接続テスト';
      testEmbed.description = 'Discord Webhook接続テストが成功しました';
      testEmbed.color = 0x00FF00;

      await this.sendWebhook([testEmbed]);
      return { success: true };
    } catch (error) {
      throw new Error(`接続テストに失敗しました: ${error.message}`);
    }
  }
}

module.exports = { DiscordNotifier };
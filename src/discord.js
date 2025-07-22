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
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return { success: true, messageCount };
    } catch (error) {
      console.error('Discord通知送信エラー:', error);
      throw new Error(`Discord通知の送信に失敗しました: ${error.message}`);
    }
  }

  async sendWebhook(embeds) {
    const payload = {
      embeds: embeds,
      username: 'Daily Reminder Bot'
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API エラー (${response.status}): ${errorText}`);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`レート制限に達しました。${retryAfter}秒後に再試行してください。`);
    }

    return response;
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
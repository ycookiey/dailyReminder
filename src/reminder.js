class ReminderProcessor {
  constructor() {
    this.JST_OFFSET = 9 * 60 * 60 * 1000;
  }

  getJSTDate() {
    const now = new Date();
    return new Date(now.getTime() + this.JST_OFFSET);
  }

  formatJSTDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  processCountdowns(countdowns, today) {
    const reminders = [];
    console.log('🔍 カウントダウン処理開始 - 入力データ数:', countdowns?.length || 0);
    
    for (const countdown of countdowns || []) {
      console.log('⚙️ 処理中のカウントダウン:', countdown.name, '有効:', countdown.enabled);
      if (!countdown.enabled && countdown.enabled !== undefined) {
        console.log('⏩ 無効のためスキップ:', countdown.name);
        continue;
      }
      
      const targetDate = new Date(countdown.targetDate + 'T00:00:00+09:00');
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      
      console.log('📅 日付計算:', {
        today: this.formatJSTDate(todayStart),
        target: this.formatJSTDate(targetStart),
        targetDateString: countdown.targetDate
      });
      
      const diffTime = targetStart - todayStart;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log('⏰ 差分計算:', {
        diffTime: diffTime,
        diffDays: diffDays,
        isValid: diffDays >= 0
      });
      
      if (diffDays >= 0) {
        let message;
        if (countdown.message) {
          message = countdown.message.replace(/{days}/g, diffDays);
          console.log('✨ カスタムメッセージ適用:', message);
        } else if (diffDays === 0) {
          message = `本日が${countdown.name}です！`;
          console.log('📢 当日メッセージ:', message);
        } else {
          message = `${countdown.name}まであと${diffDays}日です`;
          console.log('📅 デフォルトメッセージ:', message);
        }
        reminders.push(message);
        console.log('✅ リマインダーに追加:', countdown.name);
      } else {
        console.log('⏩ 期限切れのためスキップ:', countdown.name, 'diffDays:', diffDays);
      }
    }
    
    console.log('🔢 カウントダウン処理完了 - 結果数:', reminders.length);
    return reminders;
  }

  processYearlyTasks(yearlyTasks, today) {
    const reminders = [];
    
    for (const task of yearlyTasks || []) {
      if (!task.enabled && task.enabled !== undefined) continue;
      
      if (today.getMonth() + 1 === task.month && today.getDate() === task.day) {
        const message = task.message || `今日は${task.name}です`;
        reminders.push(message);
      }
    }
    
    return reminders;
  }

  processMonthlyTasks(monthlyTasks, today) {
    const reminders = [];
    
    for (const task of monthlyTasks || []) {
      if (!task.enabled && task.enabled !== undefined) continue;
      
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(task.day, lastDayOfMonth);
      
      if (today.getDate() === targetDay) {
        const message = task.message || `今日は${task.name}の日です`;
        reminders.push(message);
      }
    }
    
    return reminders;
  }

  processWeeklyTasks(weeklyTasks, today) {
    const reminders = [];
    
    for (const task of weeklyTasks || []) {
      if (!task.enabled && task.enabled !== undefined) continue;
      
      if (task.dayOfWeek.includes(today.getDay())) {
        const message = task.message || `今日は${task.name}の日です`;
        reminders.push(message);
      }
    }
    
    return reminders;
  }

  processSpecificWeekTasks(specificWeekTasks, today) {
    const reminders = [];
    
    for (const task of specificWeekTasks || []) {
      if (!task.enabled && task.enabled !== undefined) continue;
      
      if (today.getDay() !== task.dayOfWeek) continue;
      
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstTargetDay = new Date(firstDayOfMonth);
      
      while (firstTargetDay.getDay() !== task.dayOfWeek) {
        firstTargetDay.setDate(firstTargetDay.getDate() + 1);
      }
      
      const targetDate = new Date(firstTargetDay);
      targetDate.setDate(firstTargetDay.getDate() + (task.week - 1) * 7);
      
      if (targetDate.getMonth() !== today.getMonth()) {
        const lastTargetDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        while (lastTargetDay.getDay() !== task.dayOfWeek) {
          lastTargetDay.setDate(lastTargetDay.getDate() - 1);
        }
        targetDate.setTime(lastTargetDay.getTime());
      }
      
      if (today.getDate() === targetDate.getDate()) {
        const message = task.message || `今日は${task.name}の日です`;
        reminders.push(message);
      }
    }
    
    return reminders;
  }

  processLastWeekTasks(lastWeekTasks, today) {
    const reminders = [];
    
    for (const task of lastWeekTasks || []) {
      if (!task.enabled && task.enabled !== undefined) continue;
      
      if (today.getDay() !== task.dayOfWeek) continue;
      
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      while (lastDayOfMonth.getDay() !== task.dayOfWeek) {
        lastDayOfMonth.setDate(lastDayOfMonth.getDate() - 1);
      }
      
      if (today.getDate() === lastDayOfMonth.getDate()) {
        const message = task.message || `今日は${task.name}の日です`;
        reminders.push(message);
      }
    }
    
    return reminders;
  }

  processReminders(config) {
    const today = this.getJSTDate();
    console.log('📅 処理日時 (JST):', this.formatJSTDate(today));
    const reminders = [];
    
    const countdownResults = this.processCountdowns(config.countdowns, today);
    console.log('🔢 カウントダウン処理結果:', countdownResults.length, '件');
    reminders.push(...countdownResults);
    
    const yearlyResults = this.processYearlyTasks(config.yearlyTasks, today);
    console.log('📅 年次タスク処理結果:', yearlyResults.length, '件');
    reminders.push(...yearlyResults);
    
    const monthlyResults = this.processMonthlyTasks(config.monthlyTasks, today);
    console.log('📆 月次タスク処理結果:', monthlyResults.length, '件');
    reminders.push(...monthlyResults);
    
    const weeklyResults = this.processWeeklyTasks(config.weeklyTasks, today);
    console.log('🗓️ 週次タスク処理結果:', weeklyResults.length, '件');
    reminders.push(...weeklyResults);
    
    const specificWeekResults = this.processSpecificWeekTasks(config.specificWeekTasks, today);
    console.log('📋 特定週タスク処理結果:', specificWeekResults.length, '件');
    reminders.push(...specificWeekResults);
    
    const lastWeekResults = this.processLastWeekTasks(config.lastWeekTasks, today);
    console.log('📋 最終週タスク処理結果:', lastWeekResults.length, '件');
    reminders.push(...lastWeekResults);
    
    console.log('📝 全リマインダー:', reminders.length, '件');
    if (reminders.length > 0) {
      console.log('リマインダー内容:', reminders);
    }
    
    return {
      date: this.formatJSTDate(today),
      reminders
    };
  }
}

module.exports = { ReminderProcessor };
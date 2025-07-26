class ReminderProcessor {
  constructor() {
    this.JST_OFFSET = 9 * 60 * 60 * 1000; // JST is UTC+9
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
    
    for (const countdown of countdowns || []) {
      if (!countdown.enabled && countdown.enabled !== undefined) continue;
      
      const targetDate = new Date(countdown.targetDate + 'T00:00:00+09:00');
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      
      const diffTime = targetStart - todayStart;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0) {
        let message;
        if (countdown.message) {
          message = countdown.message.replace(/{days}/g, diffDays);
        } else if (diffDays === 0) {
          message = `本日が${countdown.name}です！`;
        } else {
          message = `${countdown.name}まであと${diffDays}日です`;
        }
        reminders.push(message);
      }
    }
    
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
    const reminders = [];
    
    reminders.push(...this.processCountdowns(config.countdowns, today));
    reminders.push(...this.processYearlyTasks(config.yearlyTasks, today));
    reminders.push(...this.processMonthlyTasks(config.monthlyTasks, today));
    reminders.push(...this.processWeeklyTasks(config.weeklyTasks, today));
    reminders.push(...this.processSpecificWeekTasks(config.specificWeekTasks, today));
    reminders.push(...this.processLastWeekTasks(config.lastWeekTasks, today));
    
    return {
      date: this.formatJSTDate(today),
      reminders
    };
  }
}

module.exports = { ReminderProcessor };
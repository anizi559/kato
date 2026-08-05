export async function notifyAlert(alert, settings = {}) {
  const jobs = [];
  if (settings.alertWebhookUrl) {
    jobs.push(sendWebhook(settings.alertWebhookUrl, alert));
  }
  if (settings.telegramBotToken && settings.telegramChatId) {
    jobs.push(sendTelegram(settings.telegramBotToken, settings.telegramChatId, alert));
  }
  await Promise.allSettled(jobs);
}

async function sendWebhook(url, alert) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        resourceType: alert.resourceType,
        resourceId: alert.resourceId,
        createdAt: alert.createdAt
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`webhook HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(botToken, chatId, alert) {
  const text = [
    `<b>${escapeHtml(alert.title)}</b>`,
    escapeHtml(alert.message || ""),
    `级别：${alert.severity}`,
    `时间：${alert.createdAt}`
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`telegram HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

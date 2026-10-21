require("dotenv").config();

const { Telegraf } = require("telegraf");
const OpenAI = require("openai");

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;

if (!telegramToken || !openaiKey || !model) {
  throw new Error(
    "Missing TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, or OPENAI_MODEL in .env"
  );
}

const bot = new Telegraf(telegramToken);
const ai = new OpenAI({ apiKey: openaiKey });

// Keeps recent conversation context in memory.
// Restarting the bot clears this history.
const conversations = new Map();
const MAX_HISTORY_MESSAGES = 12;

bot.start(async (ctx) => {
  await ctx.reply(
    "আসসালামু আলাইকুম! 👋\nআমি তোমার AI Assistant Bot।\nআমাকে যেকোনো প্রশ্ন করতে পারো।"
  );
});

bot.command("reset", async (ctx) => {
  conversations.delete(ctx.chat.id);
  await ctx.reply("আগের কথোপকথনের context মুছে ফেলা হয়েছে।");
});

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;

  if (userMessage.startsWith("/")) return;

  // Prevent Telegram's typing indicator from being stuck.
  await ctx.sendChatAction("typing").catch(() => {});

  const history = conversations.get(chatId) || [];

  try {
    const response = await ai.responses.create({
      model,
      instructions:
        "You are a helpful, friendly AI assistant. " +
        "Reply in Bengali when the user writes in Bengali. " +
        "Give clear, accurate and useful answers.",
      input: [
        ...history,
        { role: "user", content: userMessage }
      ],
      max_output_tokens: 700
    });

    const answer =
      response.output_text?.trim() ||
      "দুঃখিত, এবার উত্তর তৈরি করতে পারিনি। আবার চেষ্টা করো।";

    // Save only successful exchanges.
    if (response.output_text?.trim()) {
      const updatedHistory = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: answer }
      ].slice(-MAX_HISTORY_MESSAGES);

      conversations.set(chatId, updatedHistory);
    }

    // Telegram messages have a length limit.
    for (let i = 0; i < answer.length; i += 4000) {
      await ctx.reply(answer.slice(i, i + 4000));
    }
  } catch (error) {
    console.error("AI request failed:", error.message);
    await ctx.reply(
      "দুঃখিত, AI উত্তর দিতে সমস্যা হয়েছে। API key, model ও billing পরীক্ষা করে আবার চেষ্টা করো।"
    );
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error.message);
});

bot.launch()
  .then(() => console.log("AI Telegram Bot is running!"))
  .catch((error) => {
    console.error("Could not start bot:", error.message);
    process.exitCode = 1;
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
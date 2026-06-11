import { bot } from "./bot";

bot.start(async (context) => {
  const name = context.from?.first_name || context.from?.username || "there";
  await context.reply(
    `Welcome to Classroom Companion.\n\n` +
    "Choose your role:\n/register_teacher\n/register_student"
  );
});
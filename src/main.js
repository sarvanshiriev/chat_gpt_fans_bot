import { Telegraf, session } from 'telegraf';
import { message } from 'telegraf/filters';
import { code } from 'telegraf/format';
import config from 'config';
import { ogg } from './ogg.js';
import { openai } from './openai.js';

const INITIAL_SESSION = {
    messages: [],
};

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'));

bot.use(session());

bot.command('new', async (context) => {
    context.session = INITIAL_SESSION;
    await context.reply('Жду вашего голосового или текстового сообщения...');
});

bot.command('start', async (context) => {
    context.session = INITIAL_SESSION;
    await context.reply('Жду вашего голосового или текстового сообщения...');
});

bot.on(message('voice'), async (context) => {
    context.session ??= INITIAL_SESSION;
    try {
        await context.reply(code('Разбор голосового сообщения...'));
        const link = await context.telegram.getFileLink(context.message.voice.file_id);
        const userId = String(context.message.from.id);
        const oggPath = await ogg.create(link.href, userId);
        const mp3Path = await ogg.toMp3(oggPath, userId);

        const text = await openai.transcription(mp3Path);
        await context.reply(code(`Ваш запрос: "${text}"`));
        await context.reply(code('Обработка сообщения...'));

        context.session.messages.push({ role: openai.roles.USER, content: text });

        const response = await openai.chat(context.session.messages);

        context.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

        await context.reply(response.content);
    } catch (e) {
        console.log('Error while voice message', e.message);
    }
});

bot.on(message('text'), async (context) => {
    context.session ??= INITIAL_SESSION;
    try {
        await context.reply(code('Обработка сообщения...'));
        context.session.messages.push({ role: openai.roles.USER, content: context.message.text });

        const response = await openai.chat(context.session.messages);

        context.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

        await context.reply(response.content);
    } catch (e) {
        console.log('Error while voice message', e.message);
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
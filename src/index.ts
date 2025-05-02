import {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    TextChannel,
    Message,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    Partials,
    SlashCommandBuilder,
    ChannelType
} from 'discord.js';
import { config as dotenvConfig } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { findImageMessage, extractImageUrl } from './utils/findImageMessage';

dotenvConfig();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

const configPath = path.join(__dirname, '..', 'config.json');

function loadConfig() {
    try {
        const data = readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[LOG] Failed to load config:', err);
        return {};
    }
}

function saveConfig(configData: any) {
    writeFileSync(configPath, JSON.stringify(configData, null, 2));
    console.log('[LOG] Config saved successfully.');
}

let configData = loadConfig();

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);

    if (!client.application?.commands) return;

    await client.application.commands.create(
        new SlashCommandBuilder()
            .setName('setchannel')
            .setDescription('Set the target channel by ID')
            .addStringOption(option =>
                option
                    .setName('channelid')
                    .setDescription('The channel ID to send alerts to')
                    .setRequired(true)
            )
            .toJSON()
    );

    console.log('✅ Slash command registered.');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'setchannel') {
        const channelId = interaction.options.getString('channelid', true);
        const guildId = interaction.guildId;

        console.log(`[LOG] Slash command used in guild: ${guildId}, channel ID set to: ${channelId}`);

        if (!guildId) {
            await interaction.reply('❌ This command must be used inside a server.');
            return;
        }

        const channel = await client.channels.fetch(channelId).catch((err) => {
            console.error('[LOG] Failed to fetch channel:', err);
            return null;
        });

        if (channel && channel.isTextBased() && channel.type === ChannelType.GuildText) {
            if (!configData[guildId]) configData[guildId] = {};
            configData[guildId].targetChannelId = channelId;
            saveConfig(configData);

            await interaction.reply(`✅ Target channel set to <#${channelId}> for this server.`);
        } else {
            await interaction.reply('❌ Invalid channel ID');
        }
    }
});

client.on('messageCreate', async (message: Message) => {
    console.log(`[LOG] Received message from ${message.author.tag} (${message.author.id})`);

    if (message.author.id !== '742070928111960155') return;

    const guildId = message.guildId;
    if (!guildId) {
        console.log('[LOG] Message not from a guild.');
        return;
    }

    if (
        message.content.includes('<:noriclock:') &&
        (message.content.includes('You can now **grab**!') || message.content.includes('You can now **drop**!'))
    ) {
        console.log('[LOG] Skipped special status message.');
        return;
    }

    const guildConfig = configData[guildId];
    if (!guildConfig || !guildConfig.targetChannelId) {
        console.log('[LOG] No config or target channel set for this guild.');
        return;
    }

    const lines = message.content.split('\n');
    console.log('[LOG] Message lines:', lines);

    if (lines.some(line => line.trim().startsWith('0]'))) {
        console.log('[LOG] Skipping due to 0] line');
        return;
    }

    for (const line of lines) {
        if (!/^[123]\]/.test(line.trim())) continue;

        console.log('[LOG] Processing line:', line);

        const heartMatch = line.match(/:heart:\s+`(\d+)\s*`/);
        const gidMatch = line.match(/`ɢ(\d+)\s*`/);

        const hearts = heartMatch ? parseInt(heartMatch[1]) : 0;
        const gid = gidMatch ? parseInt(gidMatch[1]) : null;

        console.log(`[LOG] Parsed hearts: ${hearts}, gid: ${gid}`);

        if (hearts > 99) {
            console.log('[LOG] Triggered by hearts > 99');
            await handlePog(message, guildConfig.targetChannelId);
            return;
        }

        if (gid !== null && gid < 100) {
            console.log('[LOG] Triggered by gid < 100');
            await handlePog(message, guildConfig.targetChannelId);
            return;
        }
    }

    console.log('[LOG] No triggering line found.');
});

async function handlePog(message: Message, targetChannelId: string) {
    console.log('[LOG] handlePog triggered');

    if (message.channel.isTextBased() && message.channel.type === ChannelType.GuildText) {
        await (message.channel as TextChannel).send(`🎉 ${message.author} Check it out in <#${targetChannelId}>`);
        console.log('[LOG] Notification sent in original channel.');
    }

    const fetched = await message.channel.messages.fetch({ limit: 10, before: message.id });
    const imageMsg = await findImageMessage(fetched);

    if (!imageMsg) {
        console.log('[LOG] No image message found.');
        return;
    }

    const imageUrl = extractImageUrl(imageMsg);
    const mentionedUser = imageMsg.mentions.users.first();

    const triggeredByMention = mentionedUser ? `<@${mentionedUser.id}>` : 'Unknown';
    const triggeredByTag = mentionedUser ? mentionedUser.tag : 'Unknown#0000';

    const embed = new EmbedBuilder()
        .setTitle('<a:AnimeGirljumping:1365978464435441675>𝑷𝑶𝑮𝑮𝑬𝑹𝑺<a:brown_jump:1365979505977458708>')
        .setDescription(`${triggeredByMention} 𝑻𝒓𝒊𝒈𝒈𝒆𝒓𝒆𝒅 𝒂 𝑷𝑶𝑮!\n\n${message.content}`)
        .setColor(0x87CEEB)
        .setImage(imageUrl)
        .setFooter({ text: `dropped by: ${triggeredByTag}` });

    const button = new ButtonBuilder()
        .setLabel('Jump to Message')
        .setStyle(ButtonStyle.Link)
        .setURL(imageMsg.url);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const target = await message.client.channels.fetch(targetChannelId);
    if (target && target.isTextBased()) {
        await (target as TextChannel).send({ embeds: [embed], components: [row] });
        console.log('[LOG] Embed sent to target channel.');
    } else {
        console.log('[LOG] Failed to fetch or send to target channel.');
    }
}

client.login(process.env.TOKEN);




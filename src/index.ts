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
        return {};
    }
}

function saveConfig(configData: any) {
    writeFileSync(configPath, JSON.stringify(configData, null, 2));
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

        if (!guildId) {
            await interaction.reply('❌ This command must be used inside a server.');
            return;
        }

        const channel = await client.channels.fetch(channelId).catch(() => null);
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
    if (message.author.id !== '742070928111960155') return; // Only Nori messages
    const guildId = message.guildId;
    if (!guildId) return;

    if (
        message.content.includes('<:noriclock:') &&
        (message.content.includes('You can now **grab**!') || message.content.includes('You can now **drop**!'))
    ) {
        return; // Ignore these special status messages
    }

    const guildConfig = configData[guildId];
    if (!guildConfig || !guildConfig.targetChannelId) return;

    // Split message into lines
    const lines = message.content.split('\n');

    // Skip processing if the first line starts with '0]'
    if (lines[0]?.trim().startsWith('0]')) return; // This skips the message entirely

    let containsGID = false;

    for (const line of lines) {
        const heartMatch = line.match(/:heart:\s+`(\d+)\s+`/);
        const gidMatch = line.match(/`ɢ(\d+)`/);

        const hearts = heartMatch ? parseInt(heartMatch[1]) : 0;

        if (gidMatch) containsGID = true;
        const gid = gidMatch ? parseInt(gidMatch[1]) : null;

        // Separate checks for hearts and GID
        if (hearts > 99) {
            await handlePog(message, guildConfig.targetChannelId);
            return;
        }

        if (gid !== null && gid < 100) {
            await handlePog(message, guildConfig.targetChannelId);
            return;
        }
    }

    if (!containsGID) return;
});

async function handlePog(message: Message, targetChannelId: string) {
    if (message.channel.isTextBased() && message.channel.type === ChannelType.GuildText) {
        await (message.channel as TextChannel).send(`🎉 ${message.author} Check it out in <#${targetChannelId}>`);
    }

    const fetched = await message.channel.messages.fetch({ limit: 10, before: message.id });
    const imageMsg = await findImageMessage(fetched);

    if (!imageMsg) return;

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
    }
}

client.login(process.env.TOKEN);

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
import { findImageMessage, extractImageUrl } from './utils/findImageMessage'; // ✅ Helper import

dotenvConfig();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

// ✅ Path to config.json
const configPath = path.join(__dirname, '..', 'config.json');

// ✅ Load config.json
function loadConfig() {
    try {
        const data = readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {}; // if file is empty or error
    }
}

// ✅ Save config.json
function saveConfig(configData: any) {
    writeFileSync(configPath, JSON.stringify(configData, null, 2));
}

// ✅ configData format: { [guildId]: { targetChannelId: string } }
let configData = loadConfig();

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);

    // Register slash command globally
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

// ✅ Handle slash command
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
            await interaction.reply('❌ Invalid channel ID or channel is not text-based.');
        }
    }
});

// ✅ Listen for Nori bot messages
client.on('messageCreate', async (message: Message) => {
    if (message.author.id !== '742070928111960155') return; // Only Nori messages

    const guildId = message.guildId;
    if (!guildId) return;

    const guildConfig = configData[guildId];
    if (!guildConfig || !guildConfig.targetChannelId) return; // no channel set for this guild

    const lines = message.content.split('\n');

    for (const line of lines) {
        const heartMatch = line.match(/:heart:\s+`(\d+)\s+`/);
        const gidMatch = line.match(/`ɢ(\d+)`/);

        const hearts = heartMatch ? parseInt(heartMatch[1]) : 0;
        const gid = gidMatch ? parseInt(gidMatch[1]) : 999999;

        if (hearts >= 100 || gid < 100) {
            // ✨ First send "You pogged!" message
            if (message.channel.isTextBased() && message.channel.type === ChannelType.GuildText) {
                await (message.channel as TextChannel).send(`🎉 You pogged! Check it out in <#${guildConfig.targetChannelId}>`);
            }
        
            // (continue normal pog work)
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
                .setFooter({ text: `dropped by: ${triggeredByTag}` }); // 🛠 Removed date from footer as you asked earlier
        
            const button = new ButtonBuilder()
                .setLabel('Jump to Message')
                .setStyle(ButtonStyle.Link)
                .setURL(imageMsg.url);
        
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        
            const target = await client.channels.fetch(guildConfig.targetChannelId);
            if (target && target.isTextBased()) {
                await (target as TextChannel).send({ embeds: [embed], components: [row] });
            }
        
            break; // Stop after finding 1 matching
        }
        
    }
});

client.login(process.env.TOKEN); 
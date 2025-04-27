import { Message, Collection } from 'discord.js';

/**
 * Finds the first message that contains either:
 * - an attachment (file image)
 * - or an embed image
 */
export async function findImageMessage(messages: Collection<string, Message>): Promise<Message | null> {
    return messages.find(msg =>
        msg.attachments.size > 0 ||
        (msg.embeds.length > 0 && msg.embeds[0].image?.url)
    ) || null;
}

/**
 * Extracts the image URL from a message:
 * - Prefers attachment first
 * - Falls back to embed image if no attachment
 */
export function extractImageUrl(message: Message): string {
    return (
        message.attachments.first()?.url || 
        message.embeds[0]?.image?.url || 
        ''
    );
}

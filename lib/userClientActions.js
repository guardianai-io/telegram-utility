// lib/userClientActions.js
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import fs from "fs/promises"; // For file system operations
import { createObjectCsvWriter as createCsvWriter } from "csv-writer"; // For CSV writing

// Helper function to display messages consistently
async function displayMessages(client, messages, chatTitle = "Chat") {
    if (!messages || messages.length === 0) {
        console.log(`  ℹ️ No messages found in ${chatTitle}.`);
        return;
    }
    console.log(`\n📩 Messages in "${chatTitle}":`);
    for (const message of messages.reverse()) { // Show oldest first from the batch
        let senderName = "Unknown Sender";
        if (message.sender) {
            senderName = message.sender.firstName || "";
            if (message.sender.lastName) {
                senderName += ` ${message.sender.lastName}`;
            }
            if (message.sender.username) {
                senderName += ` (@${message.sender.username})`;
            }
            if (!senderName.trim()) senderName = `User ID ${message.senderId}`;
        } else if (message.senderId) {
            // Try to get sender info if only senderId is available (e.g. for some channel posts)
            try {
                const senderEntity = await client.getEntity(message.senderId);
                senderName = senderEntity.firstName || "";
                if (senderEntity.lastName) {
                    senderName += ` ${senderEntity.lastName}`;
                }
                if (senderEntity.username) {
                    senderName += ` (@${senderEntity.username})`;
                }
                if (!senderName.trim()) {
                    senderName = `User ID ${message.senderId}`;
                }
            } catch (e) {
                senderName =
                    `User ID ${message.senderId} (details unavailable)`;
            }
        }

        const date = new Date(message.date * 1000).toLocaleString();
        let content = message.text || "";
        if (message.media && !content) {
            content = `[Media: ${message.media.className}]`;
        } else if (message.media) {
            content += ` [Media: ${message.media.className}]`;
        }
        if (!content) {
            content = "[Empty Message]";
        }
        console.log(
            `  [${date}] ${senderName}: ${content.substring(0, 200)}${
                content.length > 200 ? "..." : ""
            } (ID: ${message.id})`,
        );
    }
}

export async function loginUserClient(apiId, apiHash, sessionString) {
    const session = new StringSession(sessionString || "");
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    });

    try {
        await client.start({
            phoneNumber: async () => await input.text("► Your phone number: "),
            phoneCode: async () =>
                await input.text("► Code Telegram just sent: "),
            password: async () =>
                await input.text("► 2-step password (if any): "),
            onError: (err) => {
                console.error("Login Error:", err.message);
                // throw err; // Propagate error to stop login process if critical
            },
        });

        if (client.connected) {
            console.log(
                "✓ Logged in as",
                (await client.getMe()).username || "you",
            );
            const newSessionString = client.session.save();
            return { client, sessionString: newSessionString };
        } else {
            console.error(
                "Could not connect Telegram client after login attempt.",
            );
            return { client: null, sessionString }; // Return original session if failed
        }
    } catch (error) {
        console.error("Critical login error:", error.message);
        // Ensure client is not returned in a partially connected or error state
        // await client.disconnect(); // Attempt to clean up, though may not be necessary if start failed badly
        return { client: null, sessionString };
    }
}

async function resolveChannelEntity(client, identifier) {
    let entity;
    identifier = identifier.toString().trim(); // Ensure it's a string and trimmed

    try {
        if (/^@/.test(identifier)) { // If it's a username like @channelname
            console.log(
                `ℹ️ Identifier "${identifier}" looks like a username. Resolving...`,
            );
            entity = await client.getEntity(identifier);
        } else if (/^-100\d+$/.test(identifier)) { // If it's a -100xxxx (channel peer ID)
            console.log(
                `ℹ️ Identifier "${identifier}" looks like a prefixed channel ID. Resolving...`,
            );
            entity = await client.getEntity(BigInt(identifier));
        } else if (/^-\d+$/.test(identifier)) { // If it's a -xxxx (legacy chat ID)
            console.log(
                `ℹ️ Identifier "${identifier}" looks like a legacy chat ID. Resolving...`,
            );
            entity = await client.getEntity(BigInt(identifier));
        } else if (/^\d+$/.test(identifier)) { // If it's a positive number string
            const numericId = BigInt(identifier);
            console.log(
                `ℹ️ Positive ID "${identifier}" provided. Attempting to resolve as is (could be User/Bot/Channel)...`,
            );
            try {
                entity = await client.getEntity(numericId);
            } catch (initialError) {
                console.log(
                    `   Initial getEntity for "${identifier}" failed: ${initialError.message}.`,
                );
                const channelPeerIdStr = "-100" + identifier;
                console.log(
                    `ℹ️ Retrying as channel peer ID (e.g. for private channel by ID): ${channelPeerIdStr}`,
                );
                try {
                    entity = await client.getEntity(BigInt(channelPeerIdStr));
                } catch (prefixedError) {
                    console.error(
                        `   Retry with prefix ${channelPeerIdStr} also failed: ${prefixedError.message}`,
                    );
                    throw initialError; // Re-throw original error if prefix attempt also fails
                }
            }
        } else {
            // For other formats (e.g., full t.me links, or unexpected formats)
            console.log(
                `ℹ️ Identifier "${identifier}" is not a direct username or numeric ID. Attempting getEntity directly...`,
            );
            entity = await client.getEntity(identifier);
        }
    } catch (error) {
        console.error(
            `❌ Failed to resolve identifier "${identifier}": ${error.message}`,
        );
        return null; // Return null on failure to resolve
    }

    // After successful resolution, check if it's a channel or chat for functions that specifically need those.
    if (
        entity &&
        (entity.className === "Channel" || entity.className === "Chat")
    ) {
        console.log(
            `   Resolved to ${entity.className}: "${
                entity.title || entity.username || entity.id
            }"`,
        );
        return entity;
    }
    // If it resolved to something else (e.g., User for a channel-specific function),
    // the calling function will need to handle this appropriately based on its needs.
    if (entity) {
        console.log(
            `   Resolved "${identifier}" to a ${entity.className} (ID: ${entity.id}). This may not be a channel/group.`,
        );
    }
    return entity; // Return whatever was resolved, or null if nothing
}

export async function getChannelAdmins(client, channelIdent) {
    console.log(`\n⏳ Action: Get Admins for channel: ${channelIdent}`);
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const channel = await resolveChannelEntity(client, channelIdent);
        if (!channel) {
            console.error(
                `❌ Could not resolve "${channelIdent}" to a usable entity.`,
            );
            return;
        }
        if (channel.className !== "Channel" && channel.className !== "Chat") {
            console.error(
                `Error: "${channelIdent}" (resolved as ${
                    channel.className || "Unknown Type"
                } ID: ${channel.id}) is not a Channel or Chat group.` +
                    ` This function is for channels or supergroups.`,
            );
            return;
        }
        const result = await client.invoke(
            new Api.channels.GetParticipants({
                channel: channel,
                filter: new Api.ChannelParticipantsAdmins(),
                offset: 0,
                limit: 200,
                hash: 0,
            }),
        );
        if (result && result.participants && result.participants.length > 0) {
            console.log(`\n📋 Admins of ${channel.title || channelIdent}:`);
            for (const part of result.participants) {
                const u = result.users.find((x) => x.id.equals(part.userId));
                if (u) {
                    console.log(
                        `${u.id}  ${u.firstName ?? ""} ${u.lastName ?? ""}  ` +
                            (u.username ? `@${u.username}` : ""),
                    );
                }
            }
        } else {
            console.log(
                `No admins found or channel "${
                    channel.title || channelIdent
                }" has no participants with admin rights accessible to you.`,
            );
        }
    } catch (error) {
        console.error(
            `Error in getChannelAdmins for "${channelIdent}": ${error.message}`,
        );
        if (error.message && error.message.includes("CHAT_ADMIN_REQUIRED")) {
            console.error(
                "   You might need to be an admin in the channel with rights to view other admins, or the channel settings might restrict access.",
            );
        }
    }
}

export async function getTelegramBotInfo(client, botIdent) {
    // This function expects a bot ID or username, getEntity handles it well directly.
    console.log(`\n⏳ Action: Get Public Info for bot: ${botIdent}`);
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const botEntity = await client.getEntity(botIdent);
        if (botEntity && botEntity.bot) {
            console.log("\n🤖 Bot Information (Public):");
            console.log(`  ID: ${botEntity.id}`);
            console.log(`  First Name: ${botEntity.firstName || "N/A"}`);
            console.log(`  Last Name: ${botEntity.lastName || "N/A"}`);
            console.log(
                `  Username: ${
                    botEntity.username ? "@" + botEntity.username : "N/A"
                }`,
            );
            console.log(`  Is Bot: ${botEntity.bot}`);
            if (botEntity.botChatHistory !== undefined) {
                console.log(
                    `  Can read all group messages (privacy mode): ${!botEntity
                        .botChatHistory}`,
                );
            }
            if (botEntity.botInlinePlaceholder !== undefined) {
                console.log(
                    `  Inline Query Placeholder: ${
                        botEntity.botInlinePlaceholder || "N/A"
                    }`,
                );
            }
        } else if (botEntity) {
            console.error(
                `\n❌ The entity "${botIdent}" was found, but it does not appear to be a bot. It is a ${botEntity.className}.`,
            );
        } else {
            console.error(
                `\n❌ Could not find any entity matching "${botIdent}". Please check the ID or username.`,
            );
        }
    } catch (error) {
        console.error(
            `\nAn error occurred while fetching bot information for "${botIdent}": ${error.message}`,
        );
        if (
            error.message &&
            error.message.includes("Cannot find any entity corresponding to")
        ) {
            console.error(
                "Please ensure the bot ID or username is correct and that the bot is accessible (e.g., not deleted).",
            );
        }
    }
}

export async function getBotInviter(client, channelIdent, botIdent) {
    console.log(
        `\n⏳ Action: Get Bot Inviter in channel ${channelIdent} for bot ${botIdent}`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const channelEntity = await resolveChannelEntity(client, channelIdent);
        if (!channelEntity) {
            console.error(`❌ Could not resolve channel: "${channelIdent}"`);
            return;
        }
        if (
            channelEntity.className !== "Channel" &&
            channelEntity.className !== "Chat"
        ) {
            console.error(
                `❌ Error: The identifier "${channelIdent}" (resolved as ${channelEntity.className}) is not a valid channel or group.`,
            );
            return;
        }
        console.log(
            `ℹ️  Operating in ${channelEntity.className}: "${
                channelEntity.title || channelEntity.username ||
                channelEntity.id
            }" (ID: ${channelEntity.id})`,
        );
        const botUserEntity = await client.getEntity(botIdent);
        if (!botUserEntity || !botUserEntity.bot) {
            console.error(
                `❌ "${botIdent}" is not a valid bot or could not be found.`,
            );
            return;
        }
        console.log(
            `ℹ️  Looking for bot: "${
                botUserEntity.username || botUserEntity.firstName
            }" (ID: ${botUserEntity.id})`,
        );
        console.log(
            `⏳ Fetching participants for "${
                channelEntity.title || channelIdent
            }"... (this may take a moment)`,
        );
        let botParticipant = null;
        let allUsersFromChannel = [];
        const limit = 200;
        let offset = 0;
        let allParticipantsFetched = false;
        let currentParticipantsResultUsers = [];
        while (!allParticipantsFetched && !botParticipant) {
            const participantsResult = await client.invoke(
                new Api.channels.GetParticipants({
                    channel: channelEntity,
                    filter: new Api.ChannelParticipantsRecent(),
                    offset: offset,
                    limit: limit,
                    hash: 0,
                }),
            );
            if (
                !participantsResult || !participantsResult.participants ||
                participantsResult.participants.length === 0
            ) {
                allParticipantsFetched = true;
                break;
            }
            if (
                participantsResult.users && participantsResult.users.length > 0
            ) {
                allUsersFromChannel.push(...participantsResult.users);
            }
            for (const part of participantsResult.participants) {
                if (part.userId && part.userId.equals(botUserEntity.id)) {
                    botParticipant = part;
                    currentParticipantsResultUsers = participantsResult.users ||
                        [];
                    break;
                }
            }
            if (participantsResult.participants.length < limit) {
                allParticipantsFetched = true;
            } else {
                offset += participantsResult.participants.length;
            }
        }
        if (botParticipant) {
            console.log(`
✅ Bot "${
                botUserEntity.username || botUserEntity.firstName
            }" found in channel "${channelEntity.title || channelIdent}".`);
            if (botParticipant.inviterId) {
                let inviter = currentParticipantsResultUsers.find((u) =>
                    u.id.equals(botParticipant.inviterId)
                );
                if (!inviter) {
                    inviter = allUsersFromChannel.find((u) =>
                        u.id.equals(botParticipant.inviterId)
                    );
                }
                console.log(
                    `🙋‍♂️ Bot was added to this channel by User ID: ${botParticipant.inviterId}`,
                );
                if (inviter) {
                    console.log(
                        `   Known details for inviter: ${
                            inviter.firstName || ""
                        } ${inviter.lastName || ""} ${
                            inviter.username
                                ? "(@" + inviter.username + ")"
                                : ""
                        }`,
                    );
                } else {
                    console.log(
                        "   (Inviter's full details might not be in the currently loaded participant batches or they may have left the channel).",
                    );
                }
            } else if (
                botParticipant.className === "ChannelParticipantCreator" &&
                botParticipant.userId.equals(botUserEntity.id)
            ) {
                console.log("ℹ️ This bot is the creator of the channel.");
            } else if (
                botParticipant.className === "ChannelParticipantCreator"
            ) {
                console.log(
                    `ℹ️ The channel creator is User ID: ${botParticipant.userId}. The bot was likely added by an admin or through other means.`,
                );
            } else {
                console.log(
                    "ℹ️ No specific inviter ID found for the bot in this channel's participant list.",
                );
            }
        } else {
            console.log(
                `\n❌ Bot "${
                    botUserEntity.username || botUserEntity.firstName
                }" was NOT found in channel "${
                    channelEntity.title || channelIdent
                }".`,
            );
        }
    } catch (error) {
        console.error(
            `\n🔴 An error occurred in getBotInviter: ${error.message}`,
        );
        if (error.className === "ChatAdminRequiredError") {
            console.error(
                "   You might need to be an admin in the channel, or settings might restrict participant list access.",
            );
        } else if (
            error.message &&
            error.message.includes("Cannot find any entity corresponding to")
        ) {
            console.error(
                "   Please ensure the channel/bot ID or username is correct and accessible.",
            );
        }
    }
}

export async function getExtendedChannelInfo(client, channelIdent) {
    console.log(
        `\n⏳ Action: Get Extended Info for Channel/Group: ${channelIdent}`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const entity = await resolveChannelEntity(client, channelIdent);
        if (!entity) {
            console.error(
                `❌ Could not resolve "${channelIdent}" to a usable entity.`,
            );
            return;
        }

        console.log(
            `\n⭐ Extended Information for "${
                entity.title || entity.username || entity.id
            }" (Type: ${entity.className}):`,
        );

        if (entity.className === "Channel") {
            // Pass the resolved entity directly. The library should handle converting it.
            const fullChannel = await client.invoke(
                new Api.channels.GetFullChannel({ channel: entity }),
            );
            const chatFull = fullChannel.fullChat;
            const basicChannelInfo = fullChannel.chats.find((c) =>
                c.id.equals(entity.id)
            ) || entity;

            console.log(`  Title: ${basicChannelInfo.title}`);
            console.log(`  ID: ${entity.id}`);
            console.log(`  Username: ${
                basicChannelInfo.username
                    ? "@" + basicChannelInfo.username
                    : "N/A"
            }`);
            console.log(`  Participants Count: ${chatFull.participantsCount}`);
            console.log(`  Admins Count: ${chatFull.adminsCount || "N/A"}`);
            console.log(`  Kicked Count: ${chatFull.kickedCount || "N/A"}`);
            console.log(`  Banned Count: ${chatFull.bannedCount || "N/A"}`);
            console.log(`  About: ${chatFull.about || "N/A"}`);
            console.log(
                `  Can View Participants: ${
                    chatFull.canViewParticipants === undefined
                        ? "N/A"
                        : chatFull.canViewParticipants
                }`,
            );
            console.log(
                `  Linked Chat ID (for discussion): ${
                    chatFull.linkedChatId?.toString() || "N/A"
                }`,
            );
            console.log(
                `  Slow Mode Enabled: ${
                    chatFull.slowmodeEnabled ? "Yes" : "No"
                }`,
            );
            if (chatFull.slowmodeSeconds) {
                console.log(`  Slow Mode Seconds: ${chatFull.slowmodeSeconds}`);
            }
            console.log(
                `  Is Supergroup: ${basicChannelInfo.megagroup ? "Yes" : "No"}`,
            );
            console.log(
                `  Is Broadcast Channel: ${
                    basicChannelInfo.broadcast ? "Yes" : "No"
                }`,
            );
        } else if (entity.className === "Chat") {
            const inputChat = entity.id; // For legacy chats, ID is usually enough for GetFullChat
            const fullChatResult = await client.invoke(
                new Api.messages.GetFullChat({ chatId: inputChat }),
            );
            const chatFull = fullChatResult.fullChat;
            const basicChatInfo = fullChatResult.chats.find((c) =>
                c.id.equals(entity.id)
            ) || entity;

            console.log(`  Title: ${basicChatInfo.title}`);
            console.log(`  ID: ${entity.id}`);
            console.log(
                `  Participants Count: ${
                    chatFull.participants?.participants.length ||
                    basicChatInfo.participantsCount || "N/A"
                }`,
            );
            console.log(`  About: ${chatFull.about || "N/A"}`);
        } else {
            console.error(
                `❌ "${channelIdent}" (resolved as ${
                    entity.className || "Unknown"
                } ID: ${entity.id}) is not a Channel or Chat. Cannot get full info.`,
            );
        }
    } catch (error) {
        console.error(
            `Error in getExtendedChannelInfo for "${channelIdent}": ${error.message}`,
        );
        if (
            error.message && error.message.includes("CHANNEL_INVALID") &&
            /^\d+$/.test(channelIdent)
        ) {
            console.error(
                "   If you provided a positive ID for a channel, it might be missing the -100 prefix (e.g., -100xxxxxxxxxx).",
            );
        }
    }
}

export async function getUserPublicInfo(client, userIdent) {
    console.log(`\n⏳ Action: Get Public Info for User: ${userIdent}`);
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const user = await client.getEntity(userIdent);
        if (!user) {
            console.error(
                `❌ Could not resolve "${userIdent}" to any user or bot.`,
            );
            return;
        }

        // A bot can sometimes be returned as className Channel by getEntity if it's a channel's bot.
        // But for user info, we primarily expect className User or a bot.
        if (
            user.className !== "User" &&
            !(user.className === "Channel" && user.bot)
        ) {
            console.error(
                `❌ "${userIdent}" resolved to a ${user.className}, not a User or Bot. Please provide a user/bot identifier.`,
            );
            return;
        }

        console.log(
            `\n👤 Public Information for "${
                user.username ? "@" + user.username : (user.firstName || "User")
            }":`,
        );
        console.log(`  ID: ${user.id}`);
        console.log(`  First Name: ${user.firstName || "N/A"}`);
        console.log(`  Last Name: ${user.lastName || "N/A"}`);
        console.log(
            `  Username: ${user.username ? "@" + user.username : "N/A"}`,
        );
        console.log(`  Is Bot: ${user.bot ? "Yes" : "No"}`);
        if (user.bot) {
            if (user.botChatHistory !== undefined) {
                console.log(
                    `  Bot Can Read All Group Messages (privacy mode): ${!user
                        .botChatHistory}`,
                );
            }
            if (user.botInlinePlaceholder !== undefined) {
                console.log(
                    `  Bot Inline Query Placeholder: ${
                        user.botInlinePlaceholder || "N/A"
                    }`,
                );
            }
        }
        console.log(`  Is Verified: ${user.verified ? "Yes" : "No"}`);
        console.log(`  Is Scam: ${user.scam ? "Yes" : "No"}`);
        console.log(`  Is Support: ${user.support ? "Yes" : "No"}`);
        if (user.phone) {
            console.log(`  Phone: ${user.phone}`);
        }
    } catch (error) {
        console.error(
            `Error in getUserPublicInfo for "${userIdent}": ${error.message}`,
        );
        if (
            error.message &&
            error.message.includes("Cannot find any entity corresponding to")
        ) {
            console.error(
                "   Please ensure the user/bot ID or username is correct.",
            );
        }
    }
}

export async function listJoinedDialogs(client) {
    console.log("\n⏳ Action: List My Joined Channels/Groups");
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const dialogLimitOption = await input.text(
            "► Enter max number of dialogs to fetch (e.g., 20, or leave blank for default/all available): ",
        );
        let limit = dialogLimitOption
            ? parseInt(dialogLimitOption, 10)
            : undefined;
        if (dialogLimitOption && isNaN(limit)) {
            console.warn(
                "Invalid number for limit. Fetching with default behavior (usually around 100).",
            );
            limit = undefined;
        }

        console.log(
            `Fetching dialogs${limit ? " (limit: " + limit + ")" : ""}...`,
        );
        const dialogs = await client.getDialogs({ limit: limit });

        console.log("\n📜 Your Joined Channels and Groups:");
        let count = 0;
        for (const dialog of dialogs) {
            if (dialog.isChannel || dialog.isGroup) {
                count++;
                let type = "Unknown";
                if (dialog.isChannel) {
                    type = dialog.entity?.broadcast
                        ? "Channel (Broadcast)"
                        : (dialog.entity?.megagroup ? "Supergroup" : "Channel");
                } else if (dialog.isGroup) {
                    type = "Group (Basic)";
                }

                let details = `${dialog.title} (ID: ${
                    dialog.id?.toString() || "N/A"
                }) - Type: ${type}`;
                if (dialog.entity?.username) {
                    details += ` - @${dialog.entity.username}`;
                }
                console.log(`  - ${details}`);
            }
        }
        if (count === 0) {
            console.log(
                "  No channels or groups found in the fetched dialogs (or the first batch if no limit specified).",
            );
        }
    } catch (error) {
        console.error(`Error in listJoinedDialogs: ${error.message}`);
    }
}

export async function listRecentMessages(client, chatIdent, limitInput) {
    console.log(`\n⏳ Action: List Recent Messages in Chat: ${chatIdent}`);
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        // For messages, the entity could be user, chat, or channel.
        // The resolveChannelEntity might be too specific if we want to get messages from a User chat.
        // However, getEntity is generally robust for chat IDs/usernames.
        const entity = await client.getEntity(chatIdent);
        if (!entity) {
            console.error(
                `❌ Could not resolve "${chatIdent}" to any chat entity.`,
            );
            return;
        }

        let limit = limitInput ? parseInt(limitInput, 10) : 20;
        if (isNaN(limit) || limit <= 0) {
            console.warn("Invalid limit provided. Defaulting to 20.");
            limit = 20;
        }
        console.log(
            `Fetching last ${limit} messages from "${
                entity.title || entity.username || entity.id
            }"...`,
        );

        const messages = await client.getMessages(entity, { limit });
        await displayMessages(
            client,
            messages,
            entity.title || entity.username ||
                (entity.firstName
                    ? `${entity.firstName} ${entity.lastName || ""}`.trim()
                    : entity.id.toString()),
        );
    } catch (error) {
        console.error(
            `Error in listRecentMessages for "${chatIdent}": ${error.message}`,
        );
    }
}

export async function searchMessagesInChat(
    client,
    chatIdent,
    query,
    limitInput,
) {
    console.log(
        `\n⏳ Action: Search Messages in Chat: ${chatIdent} for "${query}"`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    if (!query || query.trim() === "") {
        console.error("❌ Search query cannot be empty.");
        return;
    }
    try {
        const entity = await client.getEntity(chatIdent);
        if (!entity) {
            console.error(
                `❌ Could not resolve "${chatIdent}" to any chat entity.`,
            );
            return;
        }

        let limit = limitInput ? parseInt(limitInput, 10) : 20;
        if (isNaN(limit) || limit <= 0) {
            console.warn("Invalid limit provided. Defaulting to 20.");
            limit = 20;
        }
        console.log(
            `Searching for "${query}" in "${
                entity.title || entity.username || entity.id
            }" (limit ${limit} messages)...`,
        );

        const messages = await client.getMessages(entity, {
            limit,
            search: query,
        });
        await displayMessages(
            client,
            messages,
            entity.title || entity.username ||
                (entity.firstName
                    ? `${entity.firstName} ${entity.lastName || ""}`.trim()
                    : entity.id.toString()),
        );
    } catch (error) {
        console.error(
            `Error in searchMessagesInChat for "${chatIdent}" with query "${query}": ${error.message}`,
        );
    }
}

export async function checkUserStatusInChannel(
    client,
    channelIdent,
    userIdent,
) {
    console.log(
        `\n⏳ Action: Check User Status of ${userIdent} in Channel ${channelIdent}`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const channelEntity = await resolveChannelEntity(client, channelIdent);
        if (
            !channelEntity ||
            (channelEntity.className !== "Channel" &&
                channelEntity.className !== "Chat")
        ) {
            console.error(
                `❌ "${channelIdent}" is not a valid channel or group identifier.`,
            );
            return;
        }

        const userEntity = await client.getEntity(userIdent);
        if (
            !userEntity ||
            (userEntity.className !== "User" &&
                !(userEntity.className === "Channel" && userEntity.bot))
        ) {
            console.error(
                `❌ "${userIdent}" is not a valid user or bot identifier.`,
            );
            return;
        }

        console.log(
            `Checking status for User/Bot ID ${userEntity.id} in Channel/Group ID ${channelEntity.id}...`,
        );

        let foundParticipant = null;
        const participantLimit = 200;
        let currentOffset = 0;
        let allParticipantsChecked = false;

        if (userEntity.username) {
            try {
                const searchResults = await client.invoke(
                    new Api.channels.GetParticipants({
                        channel: channelEntity,
                        filter: new Api.ChannelParticipantsSearch({
                            q: userEntity.username,
                        }),
                        offset: 0,
                        limit: 10,
                        hash: 0,
                    }),
                );
                if (searchResults && searchResults.participants) {
                    foundParticipant = searchResults.participants.find((p) =>
                        p.userId && p.userId.equals(userEntity.id)
                    );
                }
            } catch (searchError) {
            }
        }

        if (!foundParticipant) {
            console.log(
                "Searching for user by iterating participants (this might take a moment for large chats)...",
            );
            while (!allParticipantsChecked && !foundParticipant) {
                const participants = await client.getParticipants(
                    channelEntity,
                    {
                        limit: participantLimit,
                        offset: currentOffset,
                    },
                );

                if (!participants || participants.length === 0) {
                    allParticipantsChecked = true;
                    break;
                }

                foundParticipant = participants.find((p) =>
                    p.userId && p.userId.equals(userEntity.id)
                );

                if (participants.length < participantLimit) {
                    allParticipantsChecked = true;
                } else {
                    currentOffset += participants.length;
                }
            }
        }

        if (foundParticipant) {
            console.log(
                `\n✅ User/Bot "${
                    userEntity.username
                        ? "@" + userEntity.username
                        : (userEntity.firstName || userEntity.id)
                }" found in "${channelEntity.title || channelIdent}".`,
            );
            let status = "Member";
            let details = [];

            if (foundParticipant.className === "ChannelParticipantCreator") {
                status = "Creator";
            } else if (
                foundParticipant.className === "ChannelParticipantAdmin"
            ) {
                status = "Admin";
                if (foundParticipant.adminRights) {
                    const rights = Object.entries(foundParticipant.adminRights)
                        .filter(([, value]) => value === true)
                        .map(([key]) => key)
                        .join(", ");
                    details.push(`Admin Rights: ${rights || "None specified"}`);
                }
                if (foundParticipant.rank) {
                    details.push(
                        `Custom Title (Rank): ${foundParticipant.rank}`,
                    );
                }
            } else if (
                foundParticipant.className === "ChannelParticipantBanned"
            ) {
                status = "Banned/Restricted";
                if (foundParticipant.kickedBy) {
                    details.push(
                        `Kicked by: User ID ${foundParticipant.kickedBy}`,
                    );
                }
                if (foundParticipant.date) {
                    details.push(
                        `Date: ${
                            new Date(foundParticipant.date * 1000)
                                .toLocaleString()
                        }`,
                    );
                }
                if (foundParticipant.bannedRights) {
                    const rights = Object.entries(foundParticipant.bannedRights)
                        .filter(([, value]) => value === true)
                        .map(([key]) => key);
                    details.push(
                        `Restrictions: ${rights.join(", ") || "General Ban"}`,
                    );
                }
            } else if (
                foundParticipant.className === "ChannelParticipantLeft"
            ) {
                status = "Left";
            } else if (foundParticipant.className === "ChannelParticipant") {
                status = "Member";
            }

            console.log(`  Status: ${status}`);
            if (details.length > 0) {
                details.forEach((detail) => console.log(`    - ${detail}`));
            }
        } else {
            console.log(
                `\n❌ User/Bot "${
                    userEntity.username
                        ? "@" + userEntity.username
                        : (userEntity.firstName || userEntity.id)
                }" NOT found in "${channelEntity.title || channelIdent}".`,
            );
        }
    } catch (error) {
        console.error(`Error in checkUserStatusInChannel: ${error.message}`);
        if (error.message && error.message.includes("USER_ID_INVALID")) {
            console.error("   Make sure the user identifier is correct.");
        } else if (error.message && error.message.includes("CHANNEL_PRIVATE")) {
            console.error(
                "   Cannot access private channel/group you are not part of, or insufficient permissions.",
            );
        } else if (
            error.className === "ChatAdminRequiredError" ||
            error.message.includes("PEER_ID_INVALID")
        ) {
            console.error(
                "   Could not access channel. Ensure ID is correct and you have permissions, or it's not a restricted chat.",
            );
        }
    }
}

export async function exportChatMembersToFile(
    client,
    channelIdent,
    format,
    fileName,
) {
    console.log(
        `\n⏳ Action: Export Chat Members from ${channelIdent} to ${fileName} (Format: ${format})`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        const entity = await resolveChannelEntity(client, channelIdent);
        if (
            !entity ||
            (entity.className !== "Channel" && entity.className !== "Chat")
        ) {
            console.error(
                `❌ "${channelIdent}" (resolved as ${entity?.className}) is not a valid channel or group identifier.`,
            );
            return;
        }

        console.log(
            `Fetching all participants from "${
                entity.title || entity.id
            }". This may take a while for large chats...`,
        );
        let allParticipants = [];
        let participantCount = 0;
        const iterLimit = 200;

        for await (
            const participant of client.iterParticipants(entity, {
                limit: iterLimit,
            })
        ) {
            if (!participant) continue;
            participantCount++;
            allParticipants.push({
                id: participant.id?.toString() || "N/A",
                username: participant.username || "N/A",
                firstName: participant.firstName || "N/A",
                lastName: participant.lastName || "N/A",
                phone: participant.phone || "N/A",
                isBot: participant.bot || false,
                status: participant.participant?.className || "N/A",
            });
            if (participantCount % iterLimit === 0) {
                console.log(`  Fetched ${participantCount} participants...`);
            }
        }
        console.log(`✅ Total participants fetched: ${participantCount}`);

        if (allParticipants.length === 0) {
            console.log("No participants found to export.");
            return;
        }

        if (format === "json") {
            await fs.writeFile(
                fileName,
                JSON.stringify(allParticipants, null, 2),
            );
            console.log(
                `Successfully exported ${allParticipants.length} members to ${fileName} (JSON)`,
            );
        } else if (format === "csv") {
            const csvWriterInstance = createCsvWriter({
                path: fileName,
                header: [
                    { id: "id", title: "ID" },
                    { id: "username", title: "Username" },
                    { id: "firstName", title: "FirstName" },
                    { id: "lastName", title: "LastName" },
                    { id: "phone", title: "Phone" },
                    { id: "isBot", title: "IsBot" },
                    { id: "status", title: "ParticipantStatus" },
                ],
            });
            await csvWriterInstance.writeRecords(allParticipants);
            console.log(
                `Successfully exported ${allParticipants.length} members to ${fileName} (CSV)`,
            );
        }
    } catch (error) {
        console.error(
            `Error in exportChatMembersToFile for "${channelIdent}": ${error.message}`,
        );
        if (
            error.message.includes(
                "Cannot iterate over a broadcast channel without admin rights",
            ) ||
            error.message.includes("ChatAdminRequiredError") ||
            error.message.includes("CHANNEL_PRIVATE")
        ) {
            console.error(
                "   You might need admin rights in this chat to list all participants, or it's a private/broadcast channel where non-admins cannot list all members.",
            );
        } else if (
            error.code === 400 && error.message.includes("PARTICIPANTS_TOO_FEW")
        ) {
            console.error(
                "   The chat might be too new or have too few participants for this operation, or it's a broadcast channel.",
            );
        }
    }
}

// --- OSINT Features ---
export async function searchPublicChannels(client, keyword, limitInput) {
    console.log(
        `\n⏳ OSINT: Searching for public channels/groups with keyword: "${keyword}"`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        let limit = limitInput ? parseInt(limitInput, 10) : 10;
        if (isNaN(limit) || limit <= 0) {
            console.warn("Invalid limit provided. Defaulting to 10.");
            limit = 10;
        }

        console.log(
            `Searching for up to ${limit} public channels/groups matching "${keyword}"...`,
        );

        const result = await client.invoke(
            new Api.contacts.Search({ q: keyword, limit: limit }),
        );

        let foundCount = 0;
        if (result && result.chats && result.chats.length > 0) {
            console.log(`\n🔎 Found Public Channels/Groups for "${keyword}":`);
            for (const chat of result.chats) {
                if (chat.className === "Channel" || chat.className === "Chat") {
                    foundCount++;
                    let type = "Unknown";
                    if (chat.className === "Channel") {
                        type = chat.megagroup
                            ? "Supergroup"
                            : (chat.broadcast
                                ? "Channel (Broadcast)"
                                : "Channel");
                    } else if (chat.className === "Chat") {
                        type = "Group (Basic)";
                    }
                    console.log(
                        `  - Title: ${chat.title || "N/A"}\n` +
                            `    ID: ${chat.id?.toString() || "N/A"}\n` +
                            `    Username: ${
                                chat.username ? "@" + chat.username : "N/A"
                            }\n` +
                            `    Type: ${type}\n` +
                            `    Participants: ${
                                chat.participantsCount || "N/A (or private)"
                            }`,
                    );
                }
            }
        }

        if (foundCount === 0) {
            console.log(
                `  ℹ️ No public channels or groups found matching "${keyword}".`,
            );
        }
    } catch (error) {
        console.error(
            `Error during public channel/group search for "${keyword}": ${error.message}`,
        );
        if (error.message && error.message.includes("SEARCH_QUERY_EMPTY")) {
            console.error("   The search query cannot be empty.");
        }
    }
}

export async function analyzePublicTelegramLink(client, link) {
    console.log(`\n⏳ OSINT: Analyzing Telegram Link: "${link}"`);
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    if (!link || typeof link !== "string" || link.trim() === "") {
        console.error("❌ Invalid or empty link provided.");
        return;
    }

    try {
        link = link.trim();
        const joinChatPattern =
            /(?:https?:\/\/)?t\.me\/joinchat\/([a-zA-Z0-9_-]+)/i;
        const publicEntityPattern =
            /(?:https?:\/\/)?t\.me\/(?!joinchat\/|c\/|s\/)([a-zA-Z0-9_]{5,32})(?!\/\d+)/i;

        const joinMatch = link.match(joinChatPattern);
        const publicMatch = link.match(publicEntityPattern);

        if (joinMatch && joinMatch[1]) {
            const hash = joinMatch[1];
            console.log(`\n🔗 Invite Link Detected. Hash: ${hash}`);
            const chatInvite = await client.invoke(
                new Api.messages.CheckChatInvite({ hash }),
            );

            console.log("\n💌 Invite Details:");
            if (
                chatInvite.className === "ChatInvitePeek" ||
                chatInvite.className === "ChatInvite"
            ) {
                const chat = chatInvite.chat || chatInvite;
                console.log(`  Title: ${chat.title}`);
                let type = "Unknown";
                if (chat.className === "Channel" || chatInvite.channel) {
                    type = chat.broadcast || chatInvite.broadcast
                        ? "Channel (Broadcast)"
                        : (chat.megagroup || chatInvite.megagroup
                            ? "Supergroup"
                            : "Channel");
                } else if (chat.className === "Chat" || !chatInvite.channel) {
                    type = "Group (Basic)";
                }
                console.log(`  Type: ${type}`);
                console.log(
                    `  Participants: ${
                        chat.participantsCount || (chatInvite.participants
                            ? chatInvite.participants.length
                            : "N/A")
                    }`,
                );
                if (chat.username) console.log(`  Username: @${chat.username}`);
                if (chatInvite.requestNeeded) {
                    console.log("  Request to Join Needed: Yes");
                }
                if (chatInvite.expires) {
                    console.log(
                        `  Expires: ${
                            new Date(chatInvite.expires * 1000).toLocaleString()
                        }`,
                    );
                }
            } else if (chatInvite.className === "ChatInviteAlready") {
                console.log(`  Title: ${chatInvite.chat.title}`);
                console.log("  ℹ️ You are already a participant in this chat.");
                // Use resolveChannelEntity to ensure correct handling of the ID from chatInvite.chat.id
                const alreadyJoinedChannel = await resolveChannelEntity(
                    client,
                    chatInvite.chat.id.toString(),
                );
                if (alreadyJoinedChannel) {
                    await getExtendedChannelInfo(client, alreadyJoinedChannel); // Pass the resolved entity or its canonical ID
                } else {
                    console.error(
                        "   Could not re-resolve the already joined chat for extended info.",
                    );
                }
            } else {
                console.log(
                    "  Could not fully parse invite details, or it's an unexpected type.",
                );
                console.log(
                    "  Raw Invite Object:",
                    JSON.stringify(
                        chatInvite,
                        (k, v) => typeof v === "bigint" ? v.toString() : v,
                        2,
                    ),
                );
            }
        } else if (publicMatch && publicMatch[1]) {
            const username = publicMatch[1];
            console.log(
                `\n👤 Public Username/Channel Link Detected: @${username}`,
            );
            try {
                // For public usernames, getEntity should work directly, then pass to more specific info functions.
                const entity = await client.getEntity(username);
                if (
                    entity.className === "Channel" ||
                    entity.className === "Chat"
                ) {
                    await getExtendedChannelInfo(client, username);
                } else if (entity.className === "User") {
                    await getUserPublicInfo(client, username);
                } else {
                    console.log(
                        `  ℹ️ Resolved to an entity of type: ${entity.className}. Displaying raw details.`,
                    );
                    console.log(
                        JSON.stringify(
                            entity,
                            (key, value) =>
                                typeof value === "bigint"
                                    ? value.toString()
                                    : value,
                            2,
                        ),
                    );
                }
            } catch (e) {
                console.error(
                    `  ❌ Error resolving @${username}: ${e.message}`,
                );
            }
        } else {
            console.log(
                "❌ Link does not match known t.me/joinchat/HASH or t.me/username patterns.",
            );
            console.log(
                "   Note: Direct message links (e.g., t.me/c/channel_id/message_id or t.me/username/message_id) require different parsing and are not fully supported by this specific function yet.",
            );
        }
    } catch (error) {
        console.error(`Error analyzing link "${link}": ${error.message}`);
        if (
            error.message &&
            (error.message.includes("INVITE_HASH_EXPIRED") ||
                error.message.includes("INVITE_HASH_INVALID") ||
                error.message.includes("INVITE_REQUEST_SENT"))
        ) {
            console.error(
                "   The invite link is invalid, has expired, or a request to join has already been sent/approved.",
            );
        } else if (
            error.message &&
            (error.message.includes("USERNAME_NOT_OCCUPIED") ||
                error.message.includes("USERNAME_INVALID"))
        ) {
            console.error(
                "   The username does not exist, is invalid, or is not a public entity.",
            );
        }
    }
}

export async function getLocatedPeers(
    client,
    latitude,
    longitude,
    accuracyRadiusInput,
) {
    console.log(
        `\n⏳ OSINT: Finding users/chats near Latitude: ${latitude}, Longitude: ${longitude}`,
    );
    if (!client || !client.connected) {
        console.error("Client not connected. Please login first.");
        return;
    }
    try {
        let accuracyRadius = accuracyRadiusInput
            ? parseInt(accuracyRadiusInput, 10)
            : 500;
        if (isNaN(accuracyRadius) || accuracyRadius <= 0) {
            console.warn("Invalid accuracy radius. Defaulting to 500m.");
            accuracyRadius = 500;
        }
        if (accuracyRadius > 3000) {
            console.warn(
                `Accuracy radius ${accuracyRadius}m is too large, capping at 3000m.`,
            );
            accuracyRadius = 3000;
        }
        console.log(`   Using accuracy radius: ${accuracyRadius}m`);

        const geoPoint = new Api.InputGeoPoint({
            lat: latitude,
            long: longitude,
            accuracyRadius: accuracyRadius,
        });

        const result = await client.invoke(
            new Api.contacts.GetLocated({ geoPoint, selfExpires: undefined }),
        );

        if (!result || !result.updates || result.updates.length === 0) {
            console.log(
                "ℹ️ No location updates received. This could mean no peers found, the location is restricted, or an issue with the query.",
            );
            return;
        }

        let peersFound = 0;
        console.log(
            "\n📍 Nearby Peers Found (Users and Chats with location sharing enabled):",
        );

        for (const update of result.updates) {
            if (update.className === "UpdatePeerLocated" && update.peers) {
                for (const locatedPeer of update.peers) {
                    peersFound++;
                    let peerEntityDetails = "Fetching details...";
                    let peerType =
                        locatedPeer.peer.className?.replace("InputPeer", "") ||
                        "Unknown";
                    let peerIdToResolve = null;

                    if (locatedPeer.peer.userId) {
                        peerIdToResolve = locatedPeer.peer.userId;
                    } else if (locatedPeer.peer.chatId) {
                        peerIdToResolve = locatedPeer.peer.chatId;
                    } else if (locatedPeer.peer.channelId) {
                        peerIdToResolve = locatedPeer.peer.channelId;
                    }

                    try {
                        if (peerIdToResolve) {
                            const entity = await client.getEntity(
                                peerIdToResolve,
                            );
                            peerEntityDetails = `${
                                entity.title || (entity.firstName
                                    ? `${entity.firstName || ""} ${
                                        entity.lastName || ""
                                    }`.trim()
                                    : "N/A")
                            } ${
                                entity.username
                                    ? "(@" + entity.username + ")"
                                    : ""
                            } (ID: ${entity.id?.toString()})`;
                            peerType = entity.className;
                        } else {
                            peerEntityDetails =
                                `(Could not extract ID from ${peerType})`;
                        }
                    } catch (e) {
                        peerEntityDetails =
                            `(Error fetching entity details for ${peerType} ID ${
                                peerIdToResolve || "unknown"
                            }: ${e.message.substring(0, 50)})`;
                    }

                    console.log(`  - ${peerEntityDetails}`);
                    console.log(`    Distance: ${locatedPeer.distance} meters`);
                    if (locatedPeer.expires) {
                        console.log(
                            `    Location Sharing Expires: ${
                                new Date(locatedPeer.expires * 1000)
                                    .toLocaleString()
                            }`,
                        );
                    }
                    console.log("    ----");
                }
            }
        }

        if (peersFound === 0) {
            console.log(
                "  ℹ️ No users or GeoChats found near the specified coordinates with the current filters/visibility.",
            );
            console.log(
                "     Users must have enabled location sharing and be nearby.",
            );
            console.log(
                "     GeoChats are special groups created at a specific location.",
            );
        }
    } catch (error) {
        console.error(`Error in getLocatedPeers: ${error.message}`);
        if (error.message && error.message.includes("GEO_POINT_INVALID")) {
            console.error("   The provided geo-coordinates are invalid.");
        } else if (
            error.message &&
            error.message.includes("LOCATION_PRIVACY_EXCEPTION")
        ) {
            console.error(
                "   Your account's privacy settings for 'Who can find me by my location' might be too restrictive for this query, or the target area has restrictions.",
            );
        }
    }
}

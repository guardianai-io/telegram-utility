import TelegramBot from "node-telegram-bot-api";
import input from "input"; // If needed for further interactions

export async function inspectBotWithToken(botToken, channelIdentsInput) {
    console.log("\n⏳ Action: Inspect Bot with Token");
    if (!botToken) {
        console.error(
            "❌ Error: Bot Token is required for this action. Set TG_BOT_TOKEN or provide at prompt.",
        );
        return;
    }

    const bot = new TelegramBot(botToken);

    try {
        // 1. Get Bot's Own Information
        console.log("\n⏳ Fetching bot's own information (getMe)...");
        const me = await bot.getMe();
        console.log("🤖 Bot Information (via Bot API):");
        console.log(`  ID: ${me.id}`);
        console.log(`  Name: ${me.first_name}`);
        console.log(`  Username: @${me.username}`);
        console.log(`  Is Bot: ${me.is_bot}`);
        if (me.can_join_groups !== undefined) {
            console.log(`  Can Join Groups: ${me.can_join_groups}`);
        }
        if (me.can_read_all_group_messages !== undefined) {
            console.log(
                `  Can Read All Group Messages: ${me.can_read_all_group_messages}`,
            );
        }
        if (me.supports_inline_queries !== undefined) {
            console.log(
                `  Supports Inline Queries: ${me.supports_inline_queries}`,
            );
        }

        // 2. Get Administrators from specific channels if provided
        if (!channelIdentsInput || channelIdentsInput.trim() === "") {
            console.log(
                "\nNo channel identifiers provided by user. Skipping administrator check for channels.",
            );
        } else {
            const channelIdents = channelIdentsInput.split(",").map((id) =>
                id.trim()
            ).filter((id) => id);
            if (channelIdents.length > 0) {
                console.log(
                    "\n--------------------------------------------------",
                );
                console.log(
                    "ℹ️ Checking administrators in specified channels (bot must be a member):",
                );
            }

            for (const ident of channelIdents) {
                console.log(
                    `\n⏳ Processing channel for admin check: ${ident}`,
                );
                try {
                    const chatInfo = await bot.getChat(ident);
                    console.log(
                        `  ✅ Found channel: "${
                            chatInfo.title || chatInfo.username || chatInfo.id
                        }" (Type: ${chatInfo.type})`,
                    );

                    if (
                        chatInfo.type === "private" ||
                        chatInfo.type === "sender"
                    ) {
                        console.log(
                            "     ℹ️ This is a private chat with a user. Cannot fetch administrators list.",
                        );
                        continue;
                    }

                    const admins = await bot.getChatAdministrators(chatInfo.id);
                    if (admins && admins.length > 0) {
                        console.log(
                            `  👥 Administrators for "${
                                chatInfo.title || ident
                            }":`,
                        );
                        admins.forEach((admin) => {
                            let adminDesc =
                                `    - User ID: ${admin.user.id}, Status: ${admin.status}`;
                            if (admin.user.username) {
                                adminDesc += `, @${admin.user.username}`;
                            }
                            if (admin.user.first_name) {
                                adminDesc += ` (${admin.user.first_name}${
                                    admin.user.last_name
                                        ? " " + admin.user.last_name
                                        : ""
                                })`;
                            }
                            if (admin.custom_title) {
                                adminDesc += ` [Title: ${admin.custom_title}]`;
                            }
                            console.log(adminDesc);
                        });
                    } else {
                        console.log(
                            `  ℹ️ No administrators found for "${
                                chatInfo.title || ident
                            }", or the bot doesn't have permission.`,
                        );
                    }
                } catch (error) {
                    console.error(
                        `  ❌ Error processing channel "${ident}" for admin check: ${error.message}`,
                    );
                    if (error.response && error.response.body) {
                        console.error(
                            `     API Error: ${
                                error.response.body.description ||
                                JSON.stringify(error.response.body)
                            }`,
                        );
                    }
                    console.log(
                        "     Possible reasons: Bot is not a member, channel ID is incorrect, or bot lacks permissions.",
                    );
                }
            }
        }
    } catch (error) {
        handleBotApiError(error, "inspecting bot with token");
    }
    // No explicit disconnect for bot API client
}

// --- New Placeholder Function for Bot API ---
export async function sendMessageViaBot(botToken, chatId, messageText) {
    console.log(`\n⏳ Action: Send Message via Bot to Chat ID: ${chatId}`);
    if (!botToken) {
        console.error("❌ Error: Bot Token is required.");
        return;
    }
    if (!chatId || !messageText || messageText.trim() === "") {
        console.error(
            "❌ Error: Chat ID and non-empty Message Text are required.",
        );
        return;
    }

    const bot = new TelegramBot(botToken);

    try {
        await bot.sendMessage(chatId, messageText);
        console.log(`✅ Message sent successfully to Chat ID: ${chatId}`);
        console.log(
            `   Content: "${messageText.substring(0, 100)}${
                messageText.length > 100 ? "..." : ""
            }"`,
        );
    } catch (error) {
        handleBotApiError(error, `sending message to ${chatId}`);
    }
}

// --- Webhook Management Functions ---
export async function getBotWebhookInfo(botToken) {
    console.log("\n⏳ Action: Get Bot Webhook Info");
    if (!botToken) {
        console.error("❌ Error: Bot Token required.");
        return;
    }
    const bot = new TelegramBot(botToken);
    try {
        const info = await bot.getWebhookInfo();
        console.log("\nℹ️ Current Webhook Information:");
        console.log(`  URL: ${info.url || "Not set"}`);
        console.log(`  Has Custom Certificate: ${info.has_custom_certificate}`);
        console.log(`  Pending Update Count: ${info.pending_update_count}`);
        if (info.last_error_date) {
            console.log(
                `  Last Error Date: ${
                    new Date(info.last_error_date * 1000).toLocaleString()
                }`,
            );
            console.log(
                `  Last Error Message: ${info.last_error_message || "N/A"}`,
            );
        }
        if (info.ip_address) {
            console.log(`  IP Address: ${info.ip_address}`);
        }
        console.log(`  Max Connections: ${info.max_connections || "N/A"}`);
        console.log(
            `  Allowed Updates: ${
                info.allowed_updates
                    ? info.allowed_updates.join(", ")
                    : "All (default)"
            }`,
        );
    } catch (error) {
        handleBotApiError(error, "get webhook info");
    }
}

export async function setBotWebhook(botToken, url, options = {}) {
    console.log(`\n⏳ Action: Set Bot Webhook to URL: ${url}`);
    if (!botToken) {
        console.error("❌ Error: Bot Token required.");
        return;
    }
    if (!url) {
        console.error("❌ Error: Webhook URL required.");
        return;
    }
    const bot = new TelegramBot(botToken);
    try {
        // Basic options for now, can be expanded via more input prompts in main.js if needed
        // e.g., allowed_updates: ['message', 'callback_query']
        const result = await bot.setWebhook(url, options);
        if (result) { // setWebhook returns true on success
            console.log(`✅ Webhook set successfully to: ${url}`);
            console.log(
                "   Bot will now receive updates at this URL (if configured correctly on your server).",
            );
        } else {
            console.error(
                "❌ Failed to set webhook. The API returned false (this is unusual, check logs or token).",
            );
        }
    } catch (error) {
        handleBotApiError(error, `set webhook to ${url}`);
    }
}

export async function deleteBotWebhook(
    botToken,
    options = { drop_pending_updates: false },
) {
    console.log("\n⏳ Action: Delete Bot Webhook");
    if (!botToken) {
        console.error("❌ Error: Bot Token required.");
        return;
    }
    const bot = new TelegramBot(botToken);
    try {
        // Ask user if they want to drop pending updates, as it's a boolean option.
        // The main.js already confirms deletion, so we can directly pass an option here or make it interactive.
        // For simplicity, added as a parameter with a default.
        // We could prompt for drop_pending_updates in main.js if needed.
        const dropPending = await input.confirm(
            "Drop pending updates when deleting webhook?",
            { default: false },
        );

        const result = await bot.deleteWebhook({
            drop_pending_updates: dropPending,
        });
        if (result) { // deleteWebhook returns true on success
            console.log("✅ Webhook deleted successfully.");
            console.log(
                "   Bot will stop receiving updates via webhook and will revert to getUpdates polling (if you start polling).",
            );
        } else {
            console.error(
                "❌ Failed to delete webhook. The API returned false (this is unusual, check logs or token).",
            );
        }
    } catch (error) {
        handleBotApiError(error, "delete webhook");
    }
}

// Helper for consistent Bot API error handling
function handleBotApiError(error, actionDescription) {
    console.error(`\n🔴 Error during ${actionDescription}:`);
    if (error.response && error.response.body) {
        console.error(`  API Error Code: ${error.response.body.error_code}`);
        console.error(`  Description: ${error.response.body.description}`);
        if (error.response.body.error_code === 401) {
            console.error(
                "  Suggestion: Invalid Bot Token. Please verify TG_BOT_TOKEN.",
            );
        } else if (error.response.body.error_code === 400) {
            console.log(
                "  Suggestion: Check parameters (e.g., URL format for setWebhook, command format).",
            );
        }
    } else {
        console.error(`  ${error.message}`);
    }
    if (
        error.message &&
        (error.message.includes("401") ||
            (error.response && error.response.statusCode === 401)) &&
        !(error.response && error.response.body)
    ) {
        // Catch generic 401s not caught by error.response.body check
        console.error(
            "\n  (Error 401 often indicates an invalid Bot Token. Please check your TG_BOT_TOKEN)",
        );
    }
}

// --- Bot Command Management Functions ---
export async function getBotCommands(
    botToken,
    scope = null,
    languageCode = null,
) {
    console.log("\n⏳ Action: Get Bot Commands");
    if (!botToken) {
        console.error("❌ Error: Bot Token required.");
        return;
    }
    const bot = new TelegramBot(botToken);
    try {
        // For now, gets global commands. Scope/language_code can be added later with more prompts.
        const commands = await bot.getMyCommands(
            scope ? { scope, language_code: languageCode } : {},
        );
        if (commands && commands.length > 0) {
            console.log("\n📜 Current Bot Commands:");
            commands.forEach((cmd) => {
                console.log(`  - /${cmd.command}: ${cmd.description}`);
            });
        } else {
            console.log(
                "ℹ️ No commands are currently set for this bot (or for the specified scope/language).",
            );
        }
    } catch (error) {
        handleBotApiError(error, "get bot commands");
    }
}

export async function setBotCommands(
    botToken,
    commands,
    scope = null,
    languageCode = null,
) {
    console.log("\n⏳ Action: Set Bot Commands");
    if (!botToken) {
        console.error("❌ Error: Bot Token required.");
        return;
    }
    if (
        !commands || !Array.isArray(commands) || !commands.every((c) =>
            typeof c.command === "string" && typeof c.description === "string"
        )
    ) {
        console.error(
            "❌ Error: Commands must be an array of {command: string, description: string} objects.",
        );
        return;
    }
    const bot = new TelegramBot(botToken);
    try {
        const result = await bot.setMyCommands(
            commands,
            scope ? { scope, language_code: languageCode } : {},
        );
        if (result) { // setMyCommands returns true on success
            console.log("✅ Bot commands updated successfully.");
            if (commands.length === 0) {
                console.log(
                    "   All commands have been cleared for the default scope.",
                );
            }
        } else {
            console.error(
                "❌ Failed to set bot commands. The API returned false.",
            );
        }
    } catch (error) {
        handleBotApiError(error, "set bot commands");
    }
}

export async function deleteBotCommands(
    botToken,
    scope = null,
    languageCode = null,
) {
    console.log("\n⏳ Action: Delete Bot Commands (for default scope)");
    if (!botToken) {
        console.error("❌ Error: Bot Token required.");
        return;
    }
    // Deleting commands is equivalent to setting an empty array of commands for the specified scope.
    // For simplicity in this CLI, we'll delete for the default scope.
    // To delete for specific scopes, setBotCommands would need to be called with an empty array and the scope.
    await setBotCommands(botToken, [], scope, languageCode);
}

// main.js
import "dotenv/config";
import input from "input";
import {
    analyzePublicTelegramLink,
    checkUserStatusInChannel,
    exportChatMembersToFile,
    getBotInviter,
    getChannelAdmins,
    getExtendedChannelInfo,
    getLocatedPeers,
    getTelegramBotInfo,
    getUserPublicInfo,
    listJoinedDialogs,
    listRecentMessages,
    loginUserClient,
    searchMessagesInChat,
    searchPublicChannels,
} from "./lib/userClientActions.js";
import {
    deleteBotCommands,
    deleteBotWebhook,
    getBotCommands,
    getBotWebhookInfo,
    inspectBotWithToken,
    sendMessageViaBot,
    setBotCommands,
    setBotWebhook,
} from "./lib/botApiActions.js";

// Store client and session globally for potential reuse within a single run
let userClient = null;
let currentSessionString = process.env.TG_STRING_SESSION || "";

// --- Sub-Menu Display Functions ---
async function displayUserAccountSubMenu() {
    console.log("\n--- User Account Actions ---");
    const choices = [
        {
            name: "1. Get My Current Logged-in User Info",
            value: "getMyOwnUserInfo",
        },
        {
            name: "2. Get Public Info for Another User/Bot",
            value: "getUserOrBotInfo",
        },
        { name: "3. List My Joined Channels/Groups", value: "listMyDialogs" },
        { name: "4. Back to Main Menu", value: "back" },
    ];
    return await input.select("► Choose User Account action:", choices);
}

async function displayChannelGroupSubMenu() {
    console.log("\n--- Channel/Group Actions (User Account) ---");
    const choices = [
        { name: "1. Get Admins of a Channel/Group", value: "getAdmins" },
        {
            name: "2. Get Extended Channel/Group Info",
            value: "getChannelDetails",
        },
        {
            name: "3. Check User Status in Channel/Group",
            value: "checkUserStatus",
        },
        { name: "4. Export Chat Members to File", value: "exportChatMembers" },
        { name: "5. Back to Main Menu", value: "back" },
    ];
    return await input.select("► Choose Channel/Group action:", choices);
}

async function displayMessageSubMenu() {
    console.log("\n--- Message Actions (User Account) ---");
    const choices = [
        {
            name: "1. List Recent Messages in Chat",
            value: "listRecentMessages",
        },
        { name: "2. Search Messages in Chat", value: "searchMessages" },
        { name: "3. Back to Main Menu", value: "back" },
    ];
    return await input.select("► Choose Message action:", choices);
}

async function displayBotInfoUserSubMenu() {
    console.log("\n--- Bot Information (User Account) ---");
    const choices = [
        {
            name:
                "1. Get Public Info about a Specific Bot (Legacy - use User Account > Get Info)",
            value: "getBotInfo_legacy",
        },
        {
            name: "2. Find Who Added a Bot to a Channel",
            value: "getBotInviter",
        },
        { name: "3. Back to Main Menu", value: "back" },
    ];
    return await input.select("► Choose Bot Information action:", choices);
}

async function displayBotTokenSubMenu() {
    console.log("\n--- Bot Token Actions ---");
    const choices = [
        {
            name: "1. Inspect Bot (GetMe & Channel Admins)",
            value: "inspectBotToken",
        },
        { name: "2. Send Message via Bot", value: "sendMessageBot" },
        { name: "3. Webhook Management", value: "manageWebhook" },
        { name: "4. Bot Command Management", value: "manageCommands" },
        { name: "5. Back to Main Menu", value: "back" },
    ];
    return await input.select("► Choose Bot Token action:", choices);
}

async function displayWebhookSubMenu() {
    console.log("\n--- Webhook Management Sub-Menu ---");
    const choices = [
        { name: "1. Get Webhook Info", value: "getWebhook" },
        { name: "2. Set Webhook", value: "setWebhook" },
        { name: "3. Delete Webhook", value: "deleteWebhook" },
        { name: "4. Back to Bot Token Actions", value: "back" },
    ];
    return await input.select("► Choose Webhook action:", choices);
}

async function displayBotCommandSubMenu() {
    console.log("\n--- Bot Command Management Sub-Menu ---");
    const choices = [
        { name: "1. Get My Commands", value: "getCommands" },
        { name: "2. Set My Commands", value: "setCommands" },
        { name: "3. Delete My Commands", value: "deleteCommands" },
        { name: "4. Back to Bot Token Actions", value: "back" },
    ];
    return await input.select("► Choose Bot Command action:", choices);
}

async function displayOsintSubMenu() {
    console.log("\n--- OSINT Features (User Account) ---");
    const choices = [
        {
            name: "1. Search Public Channels/Groups by Keyword",
            value: "osintSearchPublic",
        },
        {
            name: "2. Analyze Public Telegram Link (t.me/...)",
            value: "osintAnalyzeLink",
        },
        {
            name: "3. Find Users/Chats Near Geo-coordinates",
            value: "osintGetLocated",
        },
        { name: "4. Back to Main Menu", value: "back" },
    ];
    return await input.select("► Choose OSINT action:", choices);
}

// --- Main Menu ---
async function displayMainMenu() {
    console.log("\n===================================");
    console.log("Telegram Utilities Menu");
    console.log("===================================");
    const choices = [
        { name: "1. User Account Actions", value: "userAccountSubMenu" },
        {
            name: "2. Channel/Group Actions (User Account)",
            value: "channelGroupSubMenu",
        },
        { name: "3. Message Actions (User Account)", value: "messageSubMenu" },
        {
            name: "4. Bot Information (User Account)",
            value: "botInfoUserSubMenu",
        },
        { name: "5. Bot Token Actions", value: "botTokenSubMenu" },
        { name: "6. OSINT Features (User Account)", value: "osintSubMenu" },
        { name: "7. Exit", value: "exit" },
    ];
    return await input.select("\n► Choose a category:", choices);
}

async function handleUserClientAction(actionCallback) {
    if (!process.env.TG_API_ID || !process.env.TG_API_HASH) {
        console.error(
            "❌ Error: TG_API_ID and TG_API_HASH must be set in your .env file for this action.",
        );
        return false; // Indicate failure
    }

    if (!userClient || !userClient.connected) {
        console.log("\nLogging in with user account...");
        const loginResult = await loginUserClient(
            parseInt(process.env.TG_API_ID, 10),
            process.env.TG_API_HASH,
            currentSessionString,
        );
        if (loginResult && loginResult.client) {
            userClient = loginResult.client;
            currentSessionString = loginResult.sessionString;
            if (process.env.TG_STRING_SESSION !== currentSessionString) {
                console.log(
                    "\n🔑 A new session string was generated. Consider updating TG_STRING_SESSION in your .env file:",
                );
                console.log(currentSessionString);
            }
        } else {
            console.error("Login failed. Cannot proceed.");
            return false; // Indicate failure
        }
    } else {
        console.log("✓ Using existing user session.");
    }
    await actionCallback(userClient);
    return true; // Indicate success
}

// Helper to get bot token
async function getBotToken() {
    const token = process.env.TG_BOT_TOKEN ||
        await input.text("► Enter Bot Token (or set TG_BOT_TOKEN in .env): ");
    if (!token) {
        console.error("❌ Error: Bot token is required for this action.");
        return null;
    }
    return token;
}

// New helper for post-action navigation
async function postActionNav(actionName, subMenuFunction) {
    const navChoice = await input.select(`\n--- After "${actionName}" ---`, [
        { name: `1. Perform "${actionName}" again`, value: "again" },
        { name: "2. Back to current Sub-Menu", value: "subMenu" },
        { name: "3. Back to Main Menu", value: "mainMenu" },
    ]);
    return navChoice;
}

async function run() {
    let mainAction;
    while (mainAction !== "exit") {
        mainAction = await displayMainMenu();
        console.log(`\nMainMenu chose: ${mainAction}`);

        switch (mainAction) {
            case "userAccountSubMenu":
                let userAccAction;
                userAccLoop: while (true) {
                    userAccAction = await displayUserAccountSubMenu();
                    if (userAccAction === "back") break userAccLoop;

                    let performed = false;
                    let currentActionNameForNav = "User Account Action"; // Default name for postActionNav

                    if (userAccAction === "getMyOwnUserInfo") {
                        currentActionNameForNav = "Get My User Info";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const me = await client.getMe();
                                await getUserPublicInfo(client, me.id);
                            },
                        );
                    } else if (userAccAction === "getUserOrBotInfo") {
                        currentActionNameForNav = "Get User/Bot Info";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const ident = await input.text(
                                    "► Enter User/Bot @username or ID: ",
                                );
                                if (ident) {
                                    await getUserPublicInfo(client, ident);
                                } else {
                                    console.log(
                                        "❌ Identifier cannot be empty.",
                                    );
                                    throw new Error("Input validation failed");
                                }
                            },
                        ).catch(() => false);
                    } else if (userAccAction === "listMyDialogs") {
                        currentActionNameForNav = "List My Dialogs";
                        performed = await handleUserClientAction(
                            listJoinedDialogs,
                        );
                    }

                    if (performed) {
                        const nav = await postActionNav(
                            currentActionNameForNav,
                            displayUserAccountSubMenu,
                        );
                        if (nav === "mainMenu") break userAccLoop;
                        if (nav === "subMenu") continue userAccLoop;
                    } else if (userAccAction !== "back") {
                        await input.text(
                            "\nPress Enter to return to User Account Menu...",
                        );
                    }
                }
                break;

            case "channelGroupSubMenu":
                let cgAction;
                cgLoop: while (true) {
                    cgAction = await displayChannelGroupSubMenu();
                    if (cgAction === "back") break cgLoop;

                    let performedAction = false;
                    let actionName = "";

                    if (cgAction === "getAdmins") {
                        actionName = "Get Admins";
                        performedAction = await handleUserClientAction(
                            async (client) => {
                                const id = await input.text(
                                    "► Enter Channel/Group @username, t.me/ link, or ID: ",
                                );
                                await getChannelAdmins(client, id);
                            },
                        );
                    } else if (cgAction === "getChannelDetails") {
                        actionName = "Get Extended Channel/Group Info";
                        performedAction = await handleUserClientAction(
                            async (client) => {
                                const id = await input.text(
                                    "► Enter Channel/Group @username, t.me/ link, or ID: ",
                                );
                                await getExtendedChannelInfo(client, id);
                            },
                        );
                    } else if (cgAction === "checkUserStatus") {
                        actionName = "Check User Status";
                        performedAction = await handleUserClientAction(
                            async (client) => {
                                const chId = await input.text(
                                    "► Enter Channel/Group @username, t.me/ link, or ID: ",
                                );
                                const uId = await input.text(
                                    "► Enter User @username or ID to check: ",
                                );
                                await checkUserStatusInChannel(
                                    client,
                                    chId,
                                    uId,
                                );
                            },
                        );
                    } else if (cgAction === "exportChatMembers") {
                        actionName = "Export Chat Members";
                        performedAction = await handleUserClientAction(
                            async (client) => {
                                const id = await input.text(
                                    "► Enter Channel/Group @username, t.me/ link, or ID: ",
                                );
                                const fmt = await input.select(
                                    "► Select export format:",
                                    [{ name: "CSV", value: "csv" }, {
                                        name: "JSON",
                                        value: "json",
                                    }],
                                );
                                const fn = await input.text(
                                    `► Enter filename (e.g., members.${fmt}): `,
                                    { default: `members-${Date.now()}.${fmt}` },
                                );
                                await exportChatMembersToFile(
                                    client,
                                    id,
                                    fmt,
                                    fn,
                                );
                            },
                        );
                    }

                    if (performedAction) {
                        const nav = await postActionNav(
                            actionName,
                            displayChannelGroupSubMenu,
                        );
                        if (nav === "mainMenu") break cgLoop;
                        if (nav === "subMenu") continue cgLoop;
                    } else if (cgAction !== "back") {
                        await input.text(
                            "\nPress Enter to return to Channel/Group Menu...",
                        );
                    }
                }
                break;

            case "messageSubMenu":
                let msgAction;
                msgLoop: while (true) {
                    msgAction = await displayMessageSubMenu();
                    if (msgAction === "back") break msgLoop;
                    let performed = false;
                    let currentActionName = "";

                    if (msgAction === "listRecentMessages") {
                        currentActionName = "List Recent Messages";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const id = await input.text(
                                    "► Enter Chat @username, t.me/ link, or ID: ",
                                );
                                const lim = await input.text(
                                    "► Max messages (e.g., 10, default 20): ",
                                );
                                await listRecentMessages(client, id, lim);
                            },
                        );
                    } else if (msgAction === "searchMessages") {
                        currentActionName = "Search Messages";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const id = await input.text(
                                    "► Enter Chat @username, t.me/ link, or ID: ",
                                );
                                const q = await input.text("► Search query: ");
                                const lim = await input.text(
                                    "► Max messages (e.g., 10, default 20): ",
                                );
                                await searchMessagesInChat(client, id, q, lim);
                            },
                        );
                    }
                    if (performed) {
                        const nav = await postActionNav(
                            currentActionName,
                            displayMessageSubMenu,
                        );
                        if (nav === "mainMenu") break msgLoop;
                        if (nav === "subMenu") continue msgLoop;
                    } else if (msgAction !== "back") {
                        await input.text(
                            "\nPress Enter to return to Message Menu...",
                        );
                    }
                }
                break;

            case "botInfoUserSubMenu":
                let biuAction;
                biuLoop: while (true) {
                    biuAction = await displayBotInfoUserSubMenu();
                    if (biuAction === "back") break biuLoop;
                    let performed = false;
                    let currentActionName = "";

                    if (
                        biuAction === "getBotInfo_legacy" ||
                        biuAction === "getBotInfo"
                    ) {
                        currentActionName = "Get Bot Public Info";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const id = await input.text(
                                    "► Enter Bot @username or Bot ID: ",
                                );
                                await getTelegramBotInfo(client, id);
                            },
                        );
                    } else if (biuAction === "getBotInviter") {
                        currentActionName = "Get Bot Inviter";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const chId = await input.text(
                                    "► Enter Channel @username, t.me/ link, or ID: ",
                                );
                                const bId = await input.text(
                                    "► Enter Bot @username or Bot ID to find: ",
                                );
                                await getBotInviter(client, chId, bId);
                            },
                        );
                    }
                    if (performed) {
                        const nav = await postActionNav(
                            currentActionName,
                            displayBotInfoUserSubMenu,
                        );
                        if (nav === "mainMenu") break biuLoop;
                        if (nav === "subMenu") continue biuLoop;
                    } else if (biuAction !== "back") {
                        await input.text(
                            "\nPress Enter to return to Bot Info Menu...",
                        );
                    }
                }
                break;

            case "botTokenSubMenu":
                let btAction;
                btLoop: while (true) {
                    btAction = await displayBotTokenSubMenu();
                    if (btAction === "back") break btLoop;

                    const token = await getBotToken();
                    if (
                        !token &&
                        (btAction === "inspectBotToken" ||
                            btAction === "sendMessageBot" ||
                            btAction === "manageWebhook" ||
                            btAction === "manageCommands")
                    ) {
                        await input.text(
                            "\nPress Enter to return to Bot Token Menu...",
                        );
                        continue btLoop;
                    }

                    let performed = false;
                    let currentActionName = "";

                    if (btAction === "inspectBotToken") {
                        currentActionName = "Inspect Bot";
                        const cIdents = await input.text(
                            "► Channel ID(s) for admin check (comma-separated, optional): ",
                        );
                        await inspectBotWithToken(token, cIdents);
                        performed = true;
                    } else if (btAction === "sendMessageBot") {
                        currentActionName = "Send Message via Bot";
                        const cId = await input.text("► Target Chat ID: ");
                        const txt = await input.text("► Message text: ");
                        if (cId && txt) {
                            await sendMessageViaBot(token, cId, txt);
                            performed = true;
                        } else {
                            console.log("❌ Chat ID and text required.");
                            performed = false;
                        }
                    } else if (btAction === "manageWebhook") {
                        currentActionName = "Manage Webhook";
                        let webhookAction = await displayWebhookSubMenu();
                        webhookLoop: while (webhookAction !== "back") {
                            let whPerformed = false;
                            let whActionName = "";
                            if (webhookAction === "getWebhook") {
                                whActionName = "Get Webhook Info";
                                await getBotWebhookInfo(token);
                                whPerformed = true;
                            } else if (webhookAction === "setWebhook") {
                                whActionName = "Set Webhook";
                                const url = await input.text(
                                    "► Webhook URL (HTTPS or http://localhost): ",
                                );
                                if (
                                    url &&
                                    (url.startsWith("https://") ||
                                        url.startsWith("http://localhost"))
                                ) {
                                    await setBotWebhook(token, url);
                                    whPerformed = true;
                                } else {
                                    console.error("❌ Invalid URL.");
                                    whPerformed = false;
                                }
                            } else if (webhookAction === "deleteWebhook") {
                                whActionName = "Delete Webhook";
                                if (
                                    await input.confirm(
                                        "► Sure you want to delete webhook?",
                                        { default: false },
                                    )
                                ) {
                                    await deleteBotWebhook(token);
                                    whPerformed = true;
                                } else whPerformed = false;
                            }
                            if (whPerformed) {
                                const nav = await postActionNav(
                                    whActionName,
                                    displayWebhookSubMenu,
                                );
                                if (nav === "mainMenu") {
                                    performed = true;
                                    break btLoop;
                                }
                                if (nav === "subMenu") continue webhookLoop;
                            } else if (webhookAction !== "back") {
                                await input.text(
                                    "\nPress Enter to return to Webhook Menu...",
                                );
                            }
                            webhookAction = await displayWebhookSubMenu();
                        }
                        if (webhookAction === "back") performed = true;
                    } else if (btAction === "manageCommands") {
                        currentActionName = "Manage Commands";
                        let cmdAction = await displayBotCommandSubMenu();
                        cmdLoop: while (cmdAction !== "back") {
                            let cmdPerformed = false;
                            let cmdActionName = "";
                            if (cmdAction === "getCommands") {
                                cmdActionName = "Get Commands";
                                await getBotCommands(token);
                                cmdPerformed = true;
                            } else if (cmdAction === "setCommands") {
                                cmdActionName = "Set Commands";
                                const json = await input.text(
                                    '► Commands JSON array (e.g., [{"command":"c","description":"d"}]): ',
                                );
                                try {
                                    const cmds = JSON.parse(json);
                                    if (
                                        Array.isArray(cmds) &&
                                        cmds.every((c) =>
                                            c.command && c.description
                                        )
                                    ) {
                                        await setBotCommands(token, cmds);
                                        cmdPerformed = true;
                                    } else {
                                        console.error("❌ Invalid format.");
                                        cmdPerformed = false;
                                    }
                                } catch (e) {
                                    console.error("❌ Invalid JSON.");
                                    cmdPerformed = false;
                                }
                            } else if (cmdAction === "deleteCommands") {
                                cmdActionName = "Delete Commands";
                                if (
                                    await input.confirm(
                                        "► Sure to delete all commands?",
                                        { default: false },
                                    )
                                ) {
                                    await deleteBotCommands(token);
                                    cmdPerformed = true;
                                } else cmdPerformed = false;
                            }
                            if (cmdPerformed) {
                                const nav = await postActionNav(
                                    cmdActionName,
                                    displayBotCommandSubMenu,
                                );
                                if (nav === "mainMenu") {
                                    performed = true;
                                    break btLoop;
                                }
                                if (nav === "subMenu") continue cmdLoop;
                            } else if (cmdAction !== "back") {
                                await input.text(
                                    "\nPress Enter to return to Command Menu...",
                                );
                            }
                            cmdAction = await displayBotCommandSubMenu();
                        }
                        if (cmdAction === "back") performed = true;
                    }

                    if (performed && btAction !== "back") {
                        if (
                            btAction === "inspectBotToken" ||
                            btAction === "sendMessageBot"
                        ) {
                            const nav = await postActionNav(
                                currentActionName,
                                displayBotTokenSubMenu,
                            );
                            if (nav === "mainMenu") break btLoop;
                            if (nav === "subMenu") continue btLoop;
                        } else if (
                            btAction === "manageWebhook" ||
                            btAction === "manageCommands"
                        ) {
                        }
                    } else if (!performed && btAction !== "back") {
                        await input.text(
                            "\nPress Enter to return to Bot Token Menu...",
                        );
                    }
                }
                break;

            case "osintSubMenu":
                let osintAction;
                osintLoop: while (true) {
                    osintAction = await displayOsintSubMenu();
                    if (osintAction === "back") break osintLoop;

                    let performed = false; // To track if an OSINT action was successfully initiated
                    let actionName = "";

                    if (osintAction === "osintSearchPublic") {
                        actionName = "Search Public Channels/Groups";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const keyword = await input.text(
                                    "► Enter keyword to search for: ",
                                );
                                const limitInput = await input.text(
                                    "► Max results to fetch (e.g., 20, default 10): ",
                                );
                                if (keyword) {
                                    await searchPublicChannels(
                                        client,
                                        keyword,
                                        limitInput,
                                    );
                                } else {
                                    console.log("❌ Keyword cannot be empty.");
                                }
                            },
                        );
                    } else if (osintAction === "osintAnalyzeLink") {
                        actionName = "Analyze Public Telegram Link";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const link = await input.text(
                                    "► Enter t.me/... link to analyze: ",
                                );
                                if (link) {
                                    await analyzePublicTelegramLink(
                                        client,
                                        link,
                                    );
                                } else {
                                    console.log("❌ Link cannot be empty.");
                                }
                            },
                        );
                    } else if (osintAction === "osintGetLocated") {
                        actionName = "Find Users/Chats Near Geo-coordinates";
                        performed = await handleUserClientAction(
                            async (client) => {
                                const latStr = await input.text(
                                    "► Enter Latitude (e.g., 34.0522): ",
                                );
                                const longStr = await input.text(
                                    "► Enter Longitude (e.g., -118.2437): ",
                                );
                                const accRadiusStr = await input.text(
                                    "► Accuracy Radius in meters (optional, default 500, max 2500): ",
                                );
                                const lat = parseFloat(latStr);
                                const long = parseFloat(longStr);
                                if (!isNaN(lat) && !isNaN(long)) {
                                    await getLocatedPeers(
                                        client,
                                        lat,
                                        long,
                                        accRadiusStr,
                                    );
                                } else {
                                    console.log(
                                        "❌ Invalid Latitude or Longitude.",
                                    );
                                }
                            },
                        );
                    }
                    // Add other OSINT action handlers here

                    if (performed) {
                        const nav = await postActionNav(
                            actionName,
                            displayOsintSubMenu,
                        );
                        if (nav === "mainMenu") break osintLoop;
                        if (nav === "subMenu") continue osintLoop;
                    } else if (osintAction !== "back") {
                        // If action wasn't performed (e.g. bad input before calling action, or action itself failed early)
                        // and user didn't choose 'back' from OSINT menu itself.
                        await input.text(
                            "\nPress Enter to return to OSINT Menu...",
                        );
                    }
                }
                break;

            case "exit":
                console.log("👋 Exiting. Goodbye!");
                break;
            default:
                console.log("Invalid choice from main menu. Please try again.");
        }

        if (mainAction !== "exit") {
        }
    }
    if (userClient && userClient.connected) {
        await userClient.disconnect();
        console.log("Disconnected Telegram client.");
    }
    process.exit(0);
}

run();

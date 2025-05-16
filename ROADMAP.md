# Project Roadmap: Telegram Utilities CLI

This document outlines potential future features and enhancements for the
Telegram Utilities CLI tool. The goal is to expand its capabilities for both
administrative tasks and open-source intelligence (OSINT) gathering within the
bounds of ethical use and Telegram's API capabilities.

## I. Core Enhancements & General Improvements

1. **Enhanced Output Formatting Options:**
   - **Task:** Allow users to specify output format (e.g., JSON, CSV,
     pretty-printed text) for various information-retrieval commands.
   - **Details:** This would apply to commands like `getChannelAdmins`,
     `getExtendedChannelInfo`, `getUserPublicInfo`, `listJoinedDialogs`,
     `getBotCommands`, etc.
   - **Affected Files:** `main.js` (for prompting format choice), relevant
     functions in `userClientActions.js` and `botApiActions.js` (to structure
     data before output or use format-specific writers).

2. **More Granular Error Handling & User Guidance:**
   - **Task:** Improve error messages to be more specific and provide actionable
     suggestions.
   - **Details:** For example, distinguish between "entity not found," "API
     permission denied," "invalid input format," etc., with tailored advice.
   - **Affected Files:** Primarily functions within `lib/userClientActions.js`
     and `lib/botApiActions.js`.

3. **Interactive Input for Complex Parameters:**
   - **Task:** For functions requiring complex input (e.g., setting bot commands
     with scopes, setting webhook with all options), provide an interactive
     prompt-based way to build the parameters instead of requiring raw JSON.
   - **Details:** For `setBotCommands`, prompt for command, description, scope
     type, scope chat_id (if applicable), language code one by one. For
     `setWebhook`, prompt for URL, certificate, IP address, max connections,
     allowed updates.
   - **Affected Files:** `main.js` (for new input flows), `lib/botApiActions.js`
     (to accept structured options).

4. **Batch Operations from File:**
   - **Task:** Allow users to provide a list of identifiers (e.g., channel IDs,
     user IDs) from a text file for batch processing certain actions.
   - **Details:** E.g., get info for multiple channels, export members from
     multiple groups.
   - **Affected Files:** `main.js` (to handle file input option), relevant
     action functions in `lib/`.

5. **Configuration for Default Limits/Options:**
   - **Task:** Allow some default behaviors (like message limits, default export
     format) to be configurable, perhaps via an extended `.env` or a separate
     config file.
   - **Affected Files:** `main.js` and relevant action functions.

## II. User Account Features (TelegramClient)

_(Existing features: Get Admins, Get Bot Info, Get Bot Inviter, Get Extended
Channel Info, Get User Public Info, List Joined Dialogs, List Recent Messages,
Search Messages, Check User Status, Export Chat Members)_

1. **No new User Account features immediately planned from the previous
   brainstorming list.** Focus will be on refining existing ones and OSINT
   features first.

## III. Bot API Features (Bot Token)

_(Existing features: Inspect Bot, Send Message, Webhook Management, Bot Command
Management)_

1. **Enhanced `getChat` Information (Bot Perspective):**
   - **Task:** Create a dedicated menu option or enhance `inspectBotWithToken`
     to display more comprehensive information from `bot.getChat(chatId)`.
   - **Details:** Show title, type, ID, description, pinned message,
     permissions, etc., for a chat the bot is in.
   - **Affected Files:** `main.js`, `lib/botApiActions.js`.

## IV. OSINT Features (Primarily User Account)

**Important Note for OSINT Features:** All OSINT features must be implemented
with clear user understanding of their purpose, limitations, and ethical
considerations. Focus on information accessible via standard API interactions,
avoiding overly aggressive or ToS-violating behavior.

1. **Public Channel/Group Enumeration & Analysis:**
   - **Task:** Search for public channels/groups based on a keyword and display
     basic information.
   - **Details:**
     - Input: Keyword.
     - Action: Use
       `client.invoke(new Api.contacts.Search({ q: keyword, limit: N }))`.
     - Output: For each result, show Name, Username, ID, Member Count (if
       public). Optionally, get description via `GetFullChannel`.
     - Add option to list a few recent public messages for context.
   - **Affected Files:** `main.js`, `lib/userClientActions.js`.

2. **User/Bot Public Footprint (Accessible Chats):**
   - **Task:** Given a User/Bot ID, list common public groups/channels where
     your authenticated account and the target account are both present.
   - **Details:**
     - Input: Target User/Bot ID.
     - Action: Iterate through your `client.getDialogs()`. For each public
       channel/group, check if the target ID is a participant.
     - Output: List of common public chats.
   - **Affected Files:** `main.js`, `lib/userClientActions.js`.

3. **Forwarded Message Origin Tracer:**
   - **Task:** Analyze a specific message to identify its original source if it
     was forwarded.
   - **Details:**
     - Input: Chat ID and Message ID.
     - Action: Fetch the message. Check `message.fwdFrom`. Display
       `fwdFrom.fromId` (original user/channel), `fwdFrom.fromName`,
       `fwdFrom.savedFromPeer` (if forwarded from another chat by the current
       user), `fwdFrom.date`.
     - Output: Original sender/channel information.
   - **Affected Files:** `main.js`, `lib/userClientActions.js`.

4. **Public Bot Interaction Search:**
   - **Task:** Search for mentions of a specific bot username in your accessible
     public chats.
   - **Details:**
     - Input: Bot username (e.g., `@some_bot`).
     - Action: Iterate through your dialogs. For public channels/groups, use
       `client.getMessages(chat, { search: botUsername, limit: M })`.
     - Output: List of messages mentioning the bot.
   - **Affected Files:** `main.js`, `lib/userClientActions.js`.

## V. Future Considerations (Longer Term)

- **Plugin System:** Allow users to add their own custom action scripts.
- **GUI Wrapper:** A simple web interface or desktop GUI using Electron/Tauri
  for users less comfortable with CLI.
- **More Sophisticated Data Analysis:** For exported data, integrate options for
  basic analysis or visualization (e.g., member join dates, message frequency –
  very advanced).

## Contribution

Feel free to pick up any task from this roadmap, suggest new ones, or improve
existing features. Please open an issue to discuss significant changes before
starting work.

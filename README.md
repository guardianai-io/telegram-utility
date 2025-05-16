# Telegram Utilities CLI

A command-line interface (CLI) tool to perform various administrative and
inspection tasks on Telegram using your user account or a bot token.

## Features

This tool allows you to perform actions categorized into:

**1. User Account Specific Actions:**

- Get your own public user info.
- List channels and groups you've joined.

**2. Channel/Group Actions (User Account):**

- Get administrators of a specified channel or group.
- Get extended information about a channel or group (ID, title, type,
  description, member count, etc.).
- Check the status (member, admin, creator, etc.) of a specific user within a
  channel or group.
- Export the member list of a channel or group to a CSV or JSON file.

**3. Message Actions (User Account):**

- List recent messages from a specific chat.
- Search for messages containing a specific query within a chat.

**4. Bot Information (User Account):**

- Retrieve publicly available information for any Telegram bot.
- Find out which user (if recorded) added a specific bot to a channel/group.

**5. Bot Token Actions (Using a Bot's API Token):**

- Inspect your bot's own details (`getMe`).
- List administrators of channels where your bot is a member (from the bot's
  perspective).
- Send a message to a chat via your bot.
- Manage your bot's webhook: Get info, Set URL, Delete webhook.
- Manage your bot's commands: Get, Set, or Delete commands.

**6. OSINT Features (User Account):**

- **Search Public Channels/Groups by Keyword:** Discover public communities
  based on keywords.
- **Analyze Public Telegram Link:** Get information about `t.me/joinchat/...`
  invite links or `t.me/username` public profile/channel links.
- **Find Users/Chats Near Geo-coordinates:** Query for users and geochats
  publicly sharing their location near specified latitude/longitude (one-shot
  query).

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or pnpm (or yarn)

## Setup

1. **Clone the Repository (if applicable):**
   ```bash
   # If you're cloning from a Git repository
   # git clone <repository-url>
   # cd <repository-name>
   ```

2. **Install Dependencies:** Navigate to the project directory in your terminal
   and run:
   ```bash
   npm install telegram dotenv input csv-writer node-telegram-bot-api
   ```
   or if you use pnpm:
   ```bash
   pnpm add telegram dotenv input csv-writer node-telegram-bot-api
   ```

3. **Create and Configure `.env` File:** Create a `.env` file in the root of the
   project directory. This file will store your API credentials and session
   strings. Add the following variables:

   ```env
   # Required for User Account actions (Features 1, 2, 3, 4, 6)
   TG_API_ID=YOUR_TELEGRAM_APP_ID
   TG_API_HASH=YOUR_TELEGRAM_APP_HASH

   # Optional for User Account: Stores your login session to avoid logging in every time.
   # This will be automatically populated/updated by the script after your first successful user login.
   TG_STRING_SESSION=

   # Required for Bot Token actions (Feature 5)
   TG_BOT_TOKEN=YOUR_BOT_FATHER_BOT_TOKEN
   ```

   - **`TG_API_ID` and `TG_API_HASH`**: Obtain these from
     [my.telegram.org](https://my.telegram.org) under "API development tools".
   - **`TG_STRING_SESSION`**: Leave this blank initially if you haven't run the
     tool before. After your first successful login for a user account action, a
     session string will be displayed if one is generated. Copy this string and
     paste it as the value for `TG_STRING_SESSION` in your `.env` file to
     persist your login.
   - **`TG_BOT_TOKEN`**: This is the token you receive from @BotFather when you
     create a new bot or manage an existing one.

   **Important:** Keep your `.env` file secure and **do not commit it to version
   control** if this is a public repository. Add `.env` to your `.gitignore`
   file.

## Usage

Run the main script from the project's root directory:

```bash
node main.js
```

This will launch an interactive menu system. Navigate through the categories:

```
===================================
Telegram Utilities Menu
===================================

► Choose a category:
  1. User Account Actions
  2. Channel/Group Actions (User Account)
  3. Message Actions (User Account)
  4. Bot Information (User Account)
  5. Bot Token Actions
  6. OSINT Features (User Account)
  7. Exit
```

Follow the on-screen prompts for each action. Some actions will lead to further
sub-menus (e.g., Webhook Management, Bot Command Management).

**OSINT Sub-Menu Example:**

```
--- OSINT Features (User Account) ---
► Choose OSINT action:
  1. Search Public Channels/Groups by Keyword
  2. Analyze Public Telegram Link (t.me/...)
  3. Find Users/Chats Near Geo-coordinates
  4. Back to Main Menu
```

After an action is completed, you will typically be prompted to perform the
action again, return to the current sub-menu, or return to the main menu.

## Project Structure

- `main.js`: The main entry point and menu handler.
- `lib/`: Contains the core logic modules.
  - `userClientActions.js`: Handles actions performed using a Telegram user
    account (via `telegram` library).
  - `botApiActions.js`: Handles actions performed using the Telegram Bot API
    (via `node-telegram-bot-api` library).
- `.env`: Stores your API credentials and session strings (must be created
  manually).
- `package.json`: Project dependencies and scripts.
- `ROADMAP.md`: Document outlining potential future features.
- `README.md`: This file.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an
issue for bugs, feature requests, or improvements. Refer to the `ROADMAP.md` for
ideas.

## License

(Consider adding a license, e.g., MIT License) This project is open source and
available under the [MIT License](LICENSE).

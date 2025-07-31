# ToriBot 🤖

A Node.js bot that scrapes [tori.fi](https://www.tori.fi) ads and sends Telegram notifications for good deals.

## Features

- 🔍 Scrapes tori.fi for new listings
- 📱 Sends Telegram notifications for matching deals
- ⚙️ Configurable search terms and price ranges
- 🎯 Smart filtering and duplicate detection
- 📊 Rich formatted messages with deal details

## Setup

### 1. Prerequisites

- Node.js (v14 or higher)
- A Telegram bot token
- Your Telegram chat ID

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Tori.fi Configuration
TORI_SEARCH_URL=https://www.tori.fi/koko_suomi?q=
TORI_BASE_URL=https://www.tori.fi

# Notification Settings
MIN_PRICE=0
MAX_PRICE=1000
CHECK_INTERVAL=300000 # 5 minutes in milliseconds
```

### 4. Get Your Telegram Bot Token

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the API token provided

### 5. Get Your Chat ID

1. Start a conversation with your bot
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your `chat.id` in the response

## Usage

### Test the Bot

First, test that your bot can send messages:

```bash
npm test
```

This will send test messages to your Telegram account to verify the configuration.

### Run the Bot

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Project Structure

```
toribot/
├── package.json          # Project dependencies and scripts
├── env.example          # Environment variables template
├── test-sender.js       # Test script for Telegram messaging
├── index.js             # Main bot application (coming soon)
├── scraper.js           # Tori.fi scraping logic (coming soon)
└── README.md           # This file
```

## Configuration Options

### Telegram Settings
- `TELEGRAM_BOT_TOKEN`: Your bot's API token
- `TELEGRAM_CHAT_ID`: Your personal chat ID

### Tori.fi Settings
- `TORI_SEARCH_URL`: Base search URL for tori.fi
- `TORI_BASE_URL`: Base URL for tori.fi

### Notification Settings
- `MIN_PRICE`: Minimum price filter (in euros)
- `MAX_PRICE`: Maximum price filter (in euros)
- `CHECK_INTERVAL`: How often to check for new listings (in milliseconds)

## Development

### Adding New Features

1. Create feature branch
2. Implement functionality
3. Test with `npm test`
4. Submit pull request

### Testing

```bash
npm test
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

If you encounter any issues:

1. Check the console output for error messages
2. Verify your `.env` configuration
3. Test your bot token and chat ID
4. Open an issue with detailed error information 
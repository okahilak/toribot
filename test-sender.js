require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Check if required environment variables are set
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
    console.log('Please create a .env file with your bot token');
    process.exit(1);
}

if (!process.env.TELEGRAM_CHAT_ID) {
    console.error('❌ TELEGRAM_CHAT_ID is not set in environment variables');
    console.log('Please add your chat ID to the .env file');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

async function sendTestMessage() {
    try {
        console.log('🤖 Sending test message to Telegram...');
        
        const testMessage = `🚀 ToriBot Test Message
        
✅ Bot is working correctly!
⏰ Time: ${new Date().toLocaleString('fi-FI')}
🔧 Environment: ${process.env.NODE_ENV || 'development'}

This is a test message from your ToriBot. If you receive this, the bot is properly configured and ready to send notifications about good deals from tori.fi!`;

        await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, testMessage, {
            parse_mode: 'HTML'
        });
        
        console.log('✅ Test message sent successfully!');
        console.log('📱 Check your Telegram to see the message');
        
    } catch (error) {
        console.error('❌ Error sending test message:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

async function sendFormattedTestMessage() {
    try {
        console.log('🤖 Sending formatted test message...');
        
        const formattedMessage = `🎯 *ToriBot Test - Formatted Message*

📊 *Bot Status:* Active
🕒 *Timestamp:* ${new Date().toLocaleString('fi-FI')}
🔧 *Environment:* ${process.env.NODE_ENV || 'development'}

💡 *Next Steps:*
• Configure search terms
• Set price ranges
• Start monitoring tori.fi

_This message uses Markdown formatting to test rich text support._`;

        await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, formattedMessage, {
            parse_mode: 'Markdown'
        });
        
        console.log('✅ Formatted test message sent successfully!');
        
    } catch (error) {
        console.error('❌ Error sending formatted test message:', error.message);
    }
}

async function runTests() {
    console.log('🧪 Starting ToriBot Test Suite...\n');
    
    // Test 1: Basic message
    await sendTestMessage();
    
    // Wait a bit between messages
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Formatted message
    await sendFormattedTestMessage();
    
    console.log('\n🎉 Test suite completed!');
    console.log('📝 Check your Telegram for both test messages');
    
    process.exit(0);
}

// Run the tests
runTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
}); 
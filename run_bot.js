require('dotenv').config();
const ToriScraper = require('./scraper.js');
const DealEvaluator = require('./deal_evaluator.js');
const WebGenerator = require('./web_generator.js');

async function main() {
    const searchQuery = process.env.TORI_SEARCH_QUERY || 'macbook pro';
    console.log('🤖 ToriBot starting...');
    console.log(`🔍 Search query: "${searchQuery}"`);

    try {
        // 1. Scrape new listings
        console.log('\n📥 Fetching listings...');
        const scraper = new ToriScraper();
        await scraper.main(searchQuery);

        // 2. Evaluate new listings
        console.log('\n📊 Evaluating listings...');
        const evaluator = new DealEvaluator();
        await evaluator.evaluateTopListing(searchQuery);

        // 3. Generate website
        console.log('\n🌐 Generating website...');
        const generator = new WebGenerator();
        await generator.generateHTML();

        console.log('\n✅ All tasks completed successfully!');

    } catch (error) {
        console.error('\n💥 Error in main process:', error);
        throw error;
    }
}

// Run the main function
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
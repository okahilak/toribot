require('dotenv').config();
const ToriScraper = require('./scraper.js');
const DealEvaluator = require('./deal_evaluator.js');
const WebGenerator = require('./web_generator.js');

async function main() {
    const searchQuery = process.env.TORI_SEARCH_QUERY || null;
    const productCategory = process.env.TORI_PRODUCT_CATEGORY || null;
    const location = process.env.TORI_LOCATION || null;

    console.log('🤖 ToriBot starting...');
    if (searchQuery) {
        console.log(`🔍 Search query: "${searchQuery}"`);
    }
    if (productCategory) {
        console.log(`📁 Category: "${productCategory}"`);
    }
    if (location) {
        console.log(`📍 Location: "${location}"`);
    }

    try {
        // 1. Scrape new listings
        console.log('\n📥 Fetching listings...');
        const scraper = new ToriScraper();
        await scraper.main(searchQuery, productCategory, location);

        // 2. Evaluate new listings
        console.log('\n📊 Evaluating listings...');
        const evaluator = new DealEvaluator();
        const searchName = searchQuery || (productCategory ? `category:${productCategory}` : null);
        await evaluator.evaluateTopListing(searchName);

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
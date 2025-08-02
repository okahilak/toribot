require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('./db.js');

class ToriScraper {
    constructor() {
        this.client = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,fi;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });
        this.db = new Database();
    }

    async fetchSearchResults(searchQuery = null, productCategory = null, location = null) {
        const params = new URLSearchParams({
            trade_type: '1' // Always filter for selling listings
        });

        // Add search query only if explicitly provided (not null or empty string)
        if (searchQuery?.trim()) {
            params.append('q', searchQuery.trim());
        }

        // Add product category only if explicitly provided (not null or empty string)
        if (productCategory?.trim()) {
            params.append('product_category', productCategory.trim());
        }

        // Add location only if explicitly provided (not null or empty string)
        if (location?.trim()) {
            params.append('location', location.trim());
        }

        const url = `https://www.tori.fi/recommerce/forsale/search?${params.toString()}`;
        console.log('🔍 Fetching results from:', url);

        try {
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            console.error('Error fetching results:', error.message);
            throw error;
        }
    }

    validateContent(html) {
        const $ = cheerio.load(html);
        
        console.log('🔍 Analyzing HTML content:');
        console.log('📄 Page title:', $('title').text());

        // Check for total results count
        const totalResults = $('.search_results_count').text().match(/\d+/);
        if (totalResults) {
            console.log('📊 Total results:', totalResults[0]);
        }

        // Check for product listings
        const listings = $('article.sf-search-ad');
        console.log('📦 Product listings found:', listings.length);

        if (listings.length === 0) {
            throw new Error('No product listings found');
        }

        return $;
    }

    parseListings($) {
        const listings = [];

        $('article.sf-search-ad').each((i, el) => {
            const $el = $(el);
            
            const listing = {
                id: $el.find('[id^="search-ad-"]').attr('id')?.replace('search-ad-', ''),
                title: $el.find('h2 a').text().trim(),
                price: $el.find('.text-m.font-bold').first().text().trim(),
                location: $el.find('.text-xs.s-text-subtle span').first().text().trim(),
                link: $el.find('h2 a').attr('href'),
                image: $el.find('img').attr('src'),
                seller: $el.find('.text-xs.s-text-subtle.truncate span').text().trim(),
                timestamp: $el.find('.text-xs.s-text-subtle span').last().text().trim(),
                badges: $el.find('.badge--positionTL').text().trim()
            };

            Object.keys(listing).forEach(key => {
                if (!listing[key]) delete listing[key];
            });

            if (listing.link && !listing.link.startsWith('http')) {
                listing.link = `https://www.tori.fi${listing.link}`;
            }
            if (listing.image && !listing.image.startsWith('http')) {
                listing.image = `https://www.tori.fi${listing.image}`;
            }

            if (listing.price) {
                const priceMatch = listing.price.match(/(\d+[\s\d]*)/);
                if (priceMatch) {
                    listing.priceNumber = parseInt(priceMatch[1].replace(/\s/g, ''));
                }
            }

            listings.push(listing);
        });

        return listings;
    }

    async fetchListingDetails(url) {
        try {
            console.log(`📄 Fetching details for: ${url}`);
            const response = await this.client.get(url);
            const $ = cheerio.load(response.data);
            
            const description = $('[data-testid="description"]').text().trim() ||
                              $('.body').text().trim() ||
                              $('.description').text().trim();
            
            const details = {};
            $('[data-testid="product-details"] li').each((_, el) => {
                const $el = $(el);
                const key = $el.find('dt').text().trim();
                const value = $el.find('dd').text().trim();
                if (key && value) details[key] = value;
            });

            return {
                description,
                details
            };
        } catch (error) {
            console.warn(`⚠️ Failed to fetch details for ${url}:`, error.message);
            return null;
        }
    }

    async main(searchQuery = null, productCategory = null, location = null) {
        if (!searchQuery?.trim() && !productCategory?.trim()) {
            throw new Error('Either TORI_SEARCH_QUERY or TORI_PRODUCT_CATEGORY must be provided in environment variables');
        }

        await this.db.init();

        try {
            // Create a consistent search name with optional location
            let searchName = searchQuery || (productCategory ? `category:${productCategory}` : null);
            if (!searchName) {
                throw new Error('No search query or category provided');
            }
            if (location) {
                searchName += ` in location:${location}`;
            }
            
            // Get search ID first
            const searchId = await this.db.addSearch(searchName);
            console.log(`🔍 Starting search for "${searchName}" (ID: ${searchId})`);

            // Fetch and validate content
            const html = await this.fetchSearchResults(searchQuery, productCategory, location);
            const $ = this.validateContent(html);

            // Parse listings
            let listings = this.parseListings($);

            // Limit to the newest listings based on MAX_LISTINGS env variable
            const maxListings = parseInt(process.env.MAX_LISTINGS) || 3;
            listings = listings.slice(0, maxListings);

            console.log('\n📦 Processing', listings.length, 'newest listings');
            console.log('📥 Fetching details for each listing...');

            let newListings = 0;

            // Process each listing
            for (let i = 0; i < listings.length; i++) {
                const listing = listings[i];
                console.log(`\n[${i + 1}/${listings.length}] ${listing.title}`);
                
                // Check if listing already exists
                const exists = await this.db.checkListingExists(listing.id);
                if (exists) {
                    console.log('   ⏭️  Skipping - already in database');
                    continue;
                }

                // Fetch details for new listing
                const details = await this.fetchListingDetails(listing.link);
                if (details) {
                    listing.description = details.description;
                    listing.details = details.details;
                }

                // Save to database
                await this.db.addListing(listing, searchId);
                newListings++;

                // Show progress
                console.log(`   💰 ${listing.price}`);
                console.log(`   📍 ${listing.location}`);
                console.log(`   ⏰ ${listing.timestamp}`);
                if (listing.seller) console.log(`   👤 ${listing.seller}`);
                if (listing.badges) console.log(`   🏷️  ${listing.badges}`);
                if (listing.description) {
                    const previewLength = 100;
                    const preview = listing.description.length > previewLength 
                        ? listing.description.substring(0, previewLength) + '...'
                        : listing.description;
                    console.log(`   📝 ${preview}`);
                }
                console.log('   ✅ Added to database');

                // Add a delay between requests
                if (i < listings.length - 1) {
                    const delay = 1000 + Math.random() * 2000; // 1-3 seconds
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Show summary
            const allListings = await this.db.getListingsBySearch(searchId);
            console.log(`\n✅ Found ${newListings} new listings`);
            console.log(`📊 Total listings for "${searchQuery}": ${allListings.length}`);

        } catch (error) {
            console.error('💥 Error in main:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
            }
            throw error;
        } finally {
            await this.db.close();
        }
    }
}

// If running directly (not imported as a module)
if (require.main === module) {
    const scraper = new ToriScraper();
    const searchQuery = process.env.TORI_SEARCH_QUERY || null;
    const productCategory = process.env.TORI_PRODUCT_CATEGORY || null;
    
    scraper.main(searchQuery, productCategory)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = ToriScraper;
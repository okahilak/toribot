require('dotenv').config();
const OpenAI = require('openai');
const Database = require('./db.js');

class DealEvaluator {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.db = new Database();
    }

    async evaluateListing(listing) {
        // Note: Market analysis functionality is temporarily disabled
        // but the code is kept for future reference when we want to
        // reimplement it with better integration
        
        /* 
        // Example of how we could do market analysis in the future:
        const marketAnalysis = await this.getMarketAnalysis(listing);
        */
        
        const marketAnalysis = "Market analysis temporarily disabled for performance optimization.";

        // Prepare the evaluation prompt with market data
        const buyerRequirements = process.env.BUYER_REQUIREMENTS || "Looking for a reliable device with good performance for everyday tasks";
        
        const currentDate = new Date();
        const prompt = `You are an expert in evaluating tech deals in Finland, with deep knowledge of computer hardware and market values. 
Please evaluate this listing and rate it on a scale of 0-10 (0.5 increments allowed) based on price/performance ratio and the buyer's specific requirements.

CURRENT DATE: ${currentDate.toISOString().split('T')[0]}

LISTING INFORMATION:
Title: ${listing.title}
Price: ${listing.price}
Location: ${listing.location}
Posted: ${listing.timestamp}
Description: ${listing.description || 'No description provided'}
Technical Details: ${JSON.stringify(listing.details || {}, null, 2)}

CURRENT MARKET ANALYSIS:
${marketAnalysis}

BUYER'S REQUIREMENTS:
${buyerRequirements}

Consider:
1. How well this device meets the buyer's specific requirements
2. Performance comparison with the buyer's current setup (if specified)
3. The current market prices from the analysis above
4. Age and specifications of the device
5. Condition as described
6. Any red flags or concerns
7. Overall value for money compared to market prices

Important Notes:
- Today's date is ${currentDate.toISOString().split('T')[0]}. Use this to validate any dates mentioned in the listing.
- If you see dates that are clearly wrong (like future dates), mention this in the red flags but don't let it heavily impact the scores unless there are other concerns.

Respond in this exact format, with CONCISE bullet points (max 15 words each):
VALUE SCORE: [number 0-10 with .5 increments]
VALUE POINTS:
• [1-3 key points focusing on price/quality ratio]

MATCH SCORE: [number 0-10 with .5 increments]
MATCH POINTS:
• [1-3 key points focusing on how it meets requirements]

RED FLAGS: [bullet points if any, or "None"]

Example good bullet points:
VALUE POINTS:
• Great price (600€) considering recent model and pristine condition
• Includes all accessories and 18 months warranty remaining
• Low usage: only 2 months old, battery at 100% health

MATCH POINTS:
• 4x faster in multi-core performance than current setup
• Runs all required applications smoothly with no throttling
• Better display and cooling system for long work sessions

Example bad bullet points (too verbose):
❌ "The price of 600€ for this barely used device with high-end specifications is significantly competitive considering current market prices"
❌ "This will be a very significant improvement over the buyer's current setup especially for multitasking performance"
❌ "The specifications align perfectly with the buyer's requirements providing ample performance for their needs"

Focus on:
- Short, factual statements
- Skip repeating specs from the listing
- Compare directly to requirements when relevant
- Use numbers and specifics when possible
- Highlight key advantages or concerns`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // Using GPT-4 for better analysis
                messages: [
                    {
                        role: "system",
                        content: "You are an expert in evaluating tech deals in Finland, with deep knowledge of computer hardware, specifications, and market values."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7, // Balanced between consistency and flexibility
                max_tokens: 500
            });

            const response = completion.choices[0].message.content;
            
            // Parse the response
            const valueScoreMatch = response.match(/VALUE SCORE:\s*(\d+\.?\d*)/);
            const valuePointsMatch = response.match(/VALUE POINTS:\n((?:•[^\n]+\n?)+)/);
            const valuePoints = valuePointsMatch ? valuePointsMatch[1].trim().split('\n').map(p => p.trim()) : [];

            const matchScoreMatch = response.match(/MATCH SCORE:\s*(\d+\.?\d*)/);
            const matchPointsMatch = response.match(/MATCH POINTS:\n((?:•[^\n]+\n?)+)/);
            const matchPoints = matchPointsMatch ? matchPointsMatch[1].trim().split('\n').map(p => p.trim()) : [];

            const redFlagsMatch = response.match(/RED FLAGS:\s*([^\n]+(?:\n(?:•[^\n]+))*)/);
            const redFlags = redFlagsMatch ? redFlagsMatch[1].trim() : "None";

            // Check if we got a valid evaluation
            const valueScore = valueScoreMatch ? parseFloat(valueScoreMatch[1]) : null;
            const matchScore = matchScoreMatch ? parseFloat(matchScoreMatch[1]) : null;

            if (!valueScore || !matchScore || valuePoints.length === 0 || matchPoints.length === 0) {
                console.log('   ⏭️  Skipping - invalid or incomplete evaluation');
                return null;
            }

            return {
                valueScore,
                valuePoints,
                matchScore,
                matchPoints,
                redFlags,
                fullResponse: response
            };
        } catch (error) {
            console.error('Error evaluating listing:', error);
            throw error;
        }
    }

    async evaluateTopListing(searchQuery) {
        await this.db.init();

        try {
            // Get the search ID
            const searchId = await this.db.addSearch(searchQuery);
            
            // Get all listings for this search, ordered by first_seen DESC
            const listings = await this.db.getListingsBySearch(searchId);
            
            if (listings.length === 0) {
                console.log('No listings found for query:', searchQuery);
                return null;
            }

            // Get the number of listings to evaluate
            const maxListings = parseInt(process.env.MAX_LISTINGS) || 3;
            const listingsToEvaluate = listings.slice(0, maxListings);

            console.log(`\n📊 Processing ${listingsToEvaluate.length} newest listings...`);

            // Evaluate each listing
            for (const listing of listingsToEvaluate) {
                console.log(`\n📊 Processing listing: ${listing.title}`);
                console.log('💰 Price:', listing.price);
                
                console.log('   🤖 Generating new evaluation...');
                
                // Evaluate the listing
                const evaluation = await this.evaluateListing(listing);
                
                // Only store and display valid evaluations
                if (evaluation) {
                    await this.db.addEvaluation(listing.id, evaluation);
                    
                    // Print the results
                    console.log('\n🎯 Evaluation Results:');
                    console.log(`💰 Value Score: ${evaluation.valueScore}/10`);
                    evaluation.valuePoints.forEach(point => console.log(`   • ${point.replace(/^•\s*/, '')}`));
                    
                    console.log(`\n🎯 Requirements Match Score: ${evaluation.matchScore}/10`);
                    evaluation.matchPoints.forEach(point => console.log(`   • ${point.replace(/^•\s*/, '')}`));
                    
                    if (evaluation.redFlags !== 'None') {
                        console.log('\n⚠️  Red Flags:');
                        if (evaluation.redFlags.includes('\n')) {
                            evaluation.redFlags.split('\n').forEach(flag => 
                                console.log(`   • ${flag.replace(/^[•⚠️]\s*/, '')}`));
                        } else {
                            console.log(`   • ${evaluation.redFlags}`);
                        }
                    }
                    console.log('\n✅ Evaluation stored in database');
                }
            }

            return listingsToEvaluate;

        } catch (error) {
            console.error('Error in evaluateTopListing:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }
}

module.exports = DealEvaluator;
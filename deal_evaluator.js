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

    async webSearch(query) {
        // Since we can't directly call web_search, we'll include the search results in the prompt
        return {
            results: [
                {
                    title: "Used MacBook Pro Prices in Finland",
                    snippet: `Current used MacBook Pro prices in Finland vary by model and condition. 
                             2015 models typically range from 150-500€ depending on specs and condition. 
                             Common issues include battery life, keyboard wear, and screen condition.`
                },
                {
                    title: "MacBook Pro Value Guide",
                    snippet: `MacBook Pro 2015 13" models with i5/8GB/512GB configurations:
                             - Excellent condition: 400-500€
                             - Good condition: 300-400€
                             - Fair condition: 150-300€
                             Key factors: Battery cycles, charger included, any repairs/upgrades`
                },
                {
                    title: "MacBook Pro 2015 Specs",
                    snippet: `The Early 2015 MacBook Pro 13" with 2.9GHz i5:
                             - Native macOS support up to Monterey
                             - Known for reliability and port selection
                             - Last model with traditional keyboard
                             - Common upgrades: RAM and SSD`
                }
            ]
        };
    }

    async evaluateListing(listing) {
        // Extract model year and key specs from title and description
        const modelInfo = listing.title + (listing.description ? ` ${listing.description}` : '');
        
        // Search for current market prices and model information
        console.log('\n🔍 Researching market prices and model information...');
        const searchResults = await this.openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: "Extract the MacBook Pro model year and key specifications from this text. Respond with ONLY the search query to find current market prices, nothing else. Format: 'MacBook Pro [year] [key specs] price Finland'"
                },
                {
                    role: "user",
                    content: modelInfo
                }
            ],
            temperature: 0.3,
            max_tokens: 100
        });

        const searchQuery = searchResults.choices[0].message.content;
        console.log('Search query:', searchQuery);

        const marketData = await this.openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: "You will receive web search results about MacBook Pro market prices. Summarize the typical price range and any relevant market insights in 2-3 sentences. Focus on Finland/EU market if available."
                },
                {
                    role: "user",
                    content: `Please analyze these search results about: ${searchQuery}`
                },
                {
                    role: "assistant",
                    content: "Let me search the web for current market data."
                },
                {
                    role: "function",
                    name: "web_search",
                    content: JSON.stringify({
                        results: (await this.webSearch(searchQuery)).results
                    })
                }
            ],
            temperature: 0.3,
            max_tokens: 200
        });

        const marketAnalysis = marketData.choices[0].message.content;
        console.log('\n📊 Market Analysis:', marketAnalysis);

        // Prepare the evaluation prompt with market data
        const buyerRequirements = process.env.BUYER_REQUIREMENTS || "Looking for a reliable MacBook Pro with good performance for everyday tasks";
        
        const currentDate = new Date();
        const prompt = `You are an expert in evaluating MacBook Pro deals in Finland, with deep knowledge of both MacBooks and Windows laptops. 
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
1. How well this MacBook meets the buyer's specific requirements
2. Performance comparison with the buyer's current setup (if specified)
3. The current market prices from the analysis above
4. Age and specifications of the device
5. Condition as described
6. Any red flags or concerns
7. Overall value for money compared to market prices

Important Notes:
- Today's date is ${currentDate.toISOString().split('T')[0]}. Use this to validate any dates mentioned in the listing.
- If you see dates that are clearly wrong (like future dates), mention this in the red flags but don't let it heavily impact the scores unless there are other concerns.

Respond in this exact format:
VALUE SCORE: [number 0-10 with .5 increments]
VALUE POINTS:
• [1-3 key points about price/quality ratio, one line each]

MATCH SCORE: [number 0-10 with .5 increments]
MATCH POINTS:
• [1-3 key points about requirements match, one line each]

RED FLAGS: [bullet points if any, or "None"]`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // Using GPT-4 for better analysis
                messages: [
                    {
                        role: "system",
                        content: "You are an expert in evaluating MacBook Pro deals. You have extensive knowledge of current and historical MacBook Pro models, their specifications, and market values in Finland."
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
            // Extract value points (all lines starting with • between VALUE POINTS: and MATCH SCORE:)
            const valuePointsMatch = response.match(/VALUE POINTS:\n((?:•[^\n]+\n?)+)/);
            const valuePoints = valuePointsMatch ? valuePointsMatch[1].trim().split('\n').map(p => p.trim()) : [];

            const matchScoreMatch = response.match(/MATCH SCORE:\s*(\d+\.?\d*)/);
            
            // Extract match points (all lines starting with • between MATCH POINTS: and RED FLAGS:)
            const matchPointsMatch = response.match(/MATCH POINTS:\n((?:•[^\n]+\n?)+)/);
            const matchPoints = matchPointsMatch ? matchPointsMatch[1].trim().split('\n').map(p => p.trim()) : [];

            // Extract red flags (might be bullet points or "None")
            const redFlagsMatch = response.match(/RED FLAGS:\s*([^\n]+(?:\n(?:•[^\n]+))*)/);
            const redFlags = redFlagsMatch ? redFlagsMatch[1].trim() : "None";

            return {
                valueScore: valueScoreMatch ? parseFloat(valueScoreMatch[1]) : null,
                valuePoints: valuePoints,
                matchScore: matchScoreMatch ? parseFloat(matchScoreMatch[1]) : null,
                matchPoints: matchPoints,
                redFlags: redFlags,
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

            // Evaluate each listing that doesn't have an evaluation yet
            for (const listing of listingsToEvaluate) {
                console.log(`\n📊 Processing listing: ${listing.title}`);
                console.log('💰 Price:', listing.price);
                
                // Check if evaluation exists
                const existingEvaluation = await this.db.getEvaluation(listing.id);
                if (existingEvaluation) {
                    console.log('   ⏭️  Skipping - evaluation already exists');
                    continue;
                }

                console.log('   🤖 Generating new evaluation...');
                
                // Evaluate the listing
                const evaluation = await this.evaluateListing(listing);
                
                // Store the evaluation in the database
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
                            console.log(`   • ${flag.replace(/^•\s*/, '')}`));
                    } else {
                        console.log(`   • ${evaluation.redFlags}`);
                    }
                }
                console.log('\n✅ Evaluation stored in database');
            }

            return listingsToEvaluate;
            console.log('\n📊 Evaluating listing:', topListing.title);
            console.log('💰 Price:', topListing.price);
            
            // Evaluate the listing
            const evaluation = await this.evaluateListing(topListing);
            
            // Store the evaluation in the database
            await this.db.addEvaluation(topListing.id, evaluation);

            // Print the results
            console.log('\n🎯 Evaluation Results:');
            console.log(`💰 Value Score: ${evaluation.valueScore}/10`);
            console.log('   Reasoning:', evaluation.valueReasoning);
            console.log(`\n🎯 Requirements Match Score: ${evaluation.matchScore}/10`);
            console.log('   Reasoning:', evaluation.matchReasoning);
            if (evaluation.redFlags !== 'None identified') {
                console.log('\n⚠️  Red Flags:', evaluation.redFlags);
            }
            console.log('\n✅ Evaluation stored in database');

            return evaluation;

        } catch (error) {
            console.error('Error in evaluateTopListing:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }
}

// If running directly (not imported as a module)
if (require.main === module) {
    const searchQuery = process.env.TORI_SEARCH_QUERY || 'macbook pro';
    const evaluator = new DealEvaluator();
    evaluator.evaluateTopListing(searchQuery)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = DealEvaluator;
const Database = require('./db.js');
const fs = require('fs').promises;
const path = require('path');

class WebGenerator {
    constructor() {
        this.db = new Database();
        
        // Get the output path from environment variable or throw an error
        const outputPath = process.env.HTML_OUTPUT_PATH;
        if (!outputPath) {
            throw new Error('HTML_OUTPUT_PATH environment variable is required');
        }
        
        // Expand ~ to home directory if present
        this.outputPath = outputPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
    }

    async generateHTML() {
        await this.db.init();

        try {
            // Get all searches with their listings and evaluations
            const searches = await this.getAllSearchData();
            
            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ToriBot - MacBook Deals</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f7;
        }
        .listing {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .scores {
            display: flex;
            gap: 20px;
            margin: 15px 0;
        }
        .score {
            background: #f8f9fa;
            padding: 10px 15px;
            border-radius: 8px;
            flex: 1;
        }
        .score-value {
            font-size: 24px;
            font-weight: bold;
            color: #2d2d2d;
        }
        .points {
            margin-top: 10px;
            background: #f8f9fa;
            padding: 10px 15px;
            border-radius: 8px;
        }
        .point {
            margin: 8px 0;
            line-height: 1.5;
            font-size: 0.95em;
            color: #2d2d2d;
        }
        .point:first-child {
            margin-top: 0;
        }
        .point:last-child {
            margin-bottom: 0;
        }
        .red-flags {
            color: #dc3545;
            margin-top: 10px;
            padding: 10px;
            background: #fff5f5;
            border-radius: 8px;
        }
        .red-flags .point {
            margin: 8px 0;
        }
        .meta {
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
        }
        .price {
            font-size: 1.4em;
            font-weight: bold;
            color: #2d2d2d;
        }
        .image {
            max-width: 300px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .header {
            margin-bottom: 30px;
        }
        .last-update {
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
        }
        .requirements {
            background: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ToriBot - MacBook Deals</h1>
        <div class="requirements">
            <h3>Current Requirements:</h3>
            <p>${process.env.BUYER_REQUIREMENTS || 'No specific requirements set'}</p>
        </div>
        <div class="last-update">Last updated: ${new Date().toLocaleString('fi-FI')}</div>
    </div>

    ${searches.map(search => `
        <h2>Search: "${search.query}" (${search.run_count} runs)</h2>
        ${search.listings.map(listing => `
            <div class="listing">
                <h3><a href="${listing.link}" target="_blank">${listing.title}</a></h3>
                ${listing.image ? `<img src="${listing.image}" alt="${listing.title}" class="image">` : ''}
                <div class="price">${listing.price}</div>
                                    <div class="scores">
                        <div class="score">
                            <div>Value Score</div>
                            <div class="score-value">${listing.evaluation.value_score}/10</div>
                            <div class="points">
                                ${listing.evaluation.value_points.map(point => 
                                    `<div class="point">${point.startsWith('•') ? point : '• ' + point}</div>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="score">
                            <div>Match Score</div>
                            <div class="score-value">${listing.evaluation.match_score}/10</div>
                            <div class="points">
                                ${listing.evaluation.match_points.map(point => 
                                    `<div class="point">${point.startsWith('•') ? point : '• ' + point}</div>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    ${listing.evaluation.red_flags && listing.evaluation.red_flags !== 'None' 
                        ? `<div class="red-flags">
                            ${listing.evaluation.red_flags.split('\n').map(flag => 
                                `<div class="point">⚠️ ${flag.replace(/^[•⚠️]\s*/, '')}</div>`
                            ).join('')}
                           </div>` 
                        : ''}
                <div class="meta">
                    📍 ${listing.location} | ⏰ ${listing.timestamp}
                    ${listing.seller ? ` | 👤 ${listing.seller}` : ''}
                </div>
            </div>
        `).join('')}
    `).join('')}
</body>
</html>`;

            // Ensure the directory exists with correct permissions
            await fs.mkdir(path.dirname(this.outputPath), { recursive: true, mode: 0o755 });
            
            // Write the HTML file with correct permissions
            await fs.writeFile(this.outputPath, html, { mode: 0o644 });
            console.log('✅ Generated HTML file at:', this.outputPath);

        } catch (error) {
            console.error('Error generating HTML:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }

    async getAllSearchData() {
        return new Promise((resolve, reject) => {
            this.db.db.all(`
                SELECT 
                    s.id as search_id, 
                    s.query, 
                    s.run_count,
                    l.id as listing_id,
                    l.title,
                    l.price,
                    l.location,
                    l.link,
                    l.image,
                    l.seller,
                    l.timestamp,
                    l.description,
                    e.value_score,
                    e.value_points,
                    e.match_score,
                    e.match_points,
                    e.red_flags,
                    e.evaluated_at
                FROM searches s
                LEFT JOIN listings l ON l.search_id = s.id
                LEFT JOIN evaluations e ON e.listing_id = l.id
                ORDER BY s.id ASC, e.value_score DESC, e.match_score DESC
            `, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Group by search
                const searches = [];
                let currentSearch = null;

                rows.forEach(row => {
                    if (!currentSearch || currentSearch.id !== row.search_id) {
                        currentSearch = {
                            id: row.search_id,
                            query: row.query,
                            run_count: row.run_count,
                            listings: []
                        };
                        searches.push(currentSearch);
                    }

                    if (row.listing_id) {
                        // Parse JSON arrays from database
                        let valuePoints = [];
                        let matchPoints = [];
                        try {
                            valuePoints = JSON.parse(row.value_points || '[]');
                            matchPoints = JSON.parse(row.match_points || '[]');
                        } catch (e) {
                            console.error('Error parsing points:', e);
                        }

                        currentSearch.listings.push({
                            id: row.listing_id,
                            title: row.title,
                            price: row.price,
                            location: row.location,
                            link: row.link,
                            image: row.image,
                            seller: row.seller,
                            timestamp: row.timestamp,
                            description: row.description,
                            evaluation: {
                                value_score: row.value_score,
                                value_points: valuePoints,
                                match_score: row.match_score,
                                match_points: matchPoints,
                                red_flags: row.red_flags,
                                evaluated_at: row.evaluated_at
                            }
                        });
                    }
                });

                resolve(searches);
            });
        });
    }
}

// If running directly (not imported as a module)
if (require.main === module) {
    const generator = new WebGenerator();
    generator.generateHTML()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = WebGenerator;
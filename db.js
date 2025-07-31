const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'tori.db'));
    }

    async init() {
        return new Promise((resolve, reject) => {
                            // Create tables if they don't exist
            this.db.serialize(() => {
                // Searches table to track different search queries
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS searches (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        query TEXT UNIQUE NOT NULL,
                        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_run DATETIME DEFAULT CURRENT_TIMESTAMP,
                        run_count INTEGER DEFAULT 1
                    )
                `);

                // Listings table with foreign key to searches
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS listings (
                        id TEXT PRIMARY KEY,
                        search_id INTEGER,
                        title TEXT NOT NULL,
                        price TEXT,
                        price_number INTEGER,
                        location TEXT,
                        link TEXT NOT NULL,
                        image TEXT,
                        seller TEXT,
                        timestamp TEXT,
                        badges TEXT,
                        description TEXT,
                        details TEXT,
                        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (search_id) REFERENCES searches(id)
                    )
                `);

                // Evaluations table with foreign key to listings
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS evaluations (
                        listing_id TEXT PRIMARY KEY,
                        value_score REAL NOT NULL,      -- Price/quality ratio score (0-10)
                        value_points TEXT NOT NULL,     -- JSON array of bullet points
                        match_score REAL NOT NULL,      -- How well it matches requirements (0-10)
                        match_points TEXT NOT NULL,     -- JSON array of bullet points
                        red_flags TEXT,
                        evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (listing_id) REFERENCES listings(id)
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async addSearch(query) {
        return new Promise((resolve, reject) => {
            // Try to update existing search first
            this.db.run(
                `UPDATE searches 
                 SET last_run = CURRENT_TIMESTAMP,
                     run_count = run_count + 1
                 WHERE query = ?`,
                [query],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // If no rows were updated, insert new search
                    this.db.get(
                        'SELECT id FROM searches WHERE query = ?',
                        [query],
                        (err, row) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            if (row) {
                                // Search exists, return its ID
                                resolve(row.id);
                            } else {
                                // Insert new search
                                this.db.run(
                                    'INSERT INTO searches (query) VALUES (?)',
                                    [query],
                                    function(err) {
                                        if (err) reject(err);
                                        else resolve(this.lastID);
                                    }
                                );
                            }
                        }
                    );
                }
            );
        });
    }

    // No longer needed as updates are handled in addSearch
    async updateSearchTimestamp(searchId) {
        return Promise.resolve();
    }

    async checkListingExists(listingId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id FROM listings WHERE id = ?',
                [listingId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    async addListing(listing, searchId) {
        const details = listing.details ? JSON.stringify(listing.details) : null;

        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO listings (
                    id, search_id, title, price, price_number, location,
                    link, image, seller, timestamp, badges,
                    description, details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                listing.id, searchId, listing.title, listing.price,
                listing.priceNumber, listing.location, listing.link,
                listing.image, listing.seller, listing.timestamp,
                listing.badges, listing.description, details
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getListingsBySearch(searchId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM listings 
                WHERE search_id = ?
                ORDER BY first_seen DESC
            `, [searchId], (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse JSON details back to object
                    rows.forEach(row => {
                        if (row.details) {
                            try {
                                row.details = JSON.parse(row.details);
                            } catch (e) {
                                console.warn(`Failed to parse details for listing ${row.id}`);
                            }
                        }
                    });
                    resolve(rows);
                }
            });
        });
    }

    async getSearches() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM searches ORDER BY last_run DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async addEvaluation(listingId, evaluation) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO evaluations (
                    listing_id, value_score, value_points,
                    match_score, match_points,
                    red_flags, evaluated_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                listingId,
                evaluation.valueScore,
                JSON.stringify(evaluation.valuePoints),
                evaluation.matchScore,
                JSON.stringify(evaluation.matchPoints),
                evaluation.redFlags,
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async getEvaluation(listingId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM evaluations WHERE listing_id = ?',
                [listingId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }
}

module.exports = Database;
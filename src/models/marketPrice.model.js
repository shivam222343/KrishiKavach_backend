import mongoose from 'mongoose';

/**
 * Agricultural Commodity Price Record
 * Populated from RSS/news scraping and optionally government data.
 */
const marketPriceSchema = new mongoose.Schema(
    {
        commodity: { type: String, required: true, trim: true, index: true },
        state: { type: String, required: true, trim: true },
        district: { type: String, default: 'Unknown', trim: true },
        marketType: { type: String, enum: ['news', 'government'], default: 'news' },

        // Normalised price (always ₹ per quintal)
        pricePerQuintal: { type: Number, required: true },

        // Original values before normalisation
        originalPrice: { type: Number },
        originalUnit: { type: String, default: 'quintal' }, // kg | quintal | tonne

        // Source metadata
        sourceName: { type: String, default: 'Unknown' },
        sourceUrl: { type: String, default: '' },

        publishDate: { type: Date, required: true },
        extractedAt: { type: Date, default: Date.now },

        // 0–1: how confident we are in the extraction
        confidenceScore: { type: Number, default: 0.5, min: 0, max: 1 },

        // Snippet of text that led to this extraction (for debugging)
        snippet: { type: String, default: '' },
    },
    { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
marketPriceSchema.index({ commodity: 1, state: 1, district: 1, publishDate: -1 });
marketPriceSchema.index({ publishDate: -1 });
marketPriceSchema.index({ commodity: 1, publishDate: -1 });

// Unique on sourceUrl so we never store the same article's price twice
marketPriceSchema.index({ sourceUrl: 1, commodity: 1, district: 1 }, { unique: true, sparse: true });

const MarketPrice = mongoose.model('MarketPrice', marketPriceSchema);
export default MarketPrice;

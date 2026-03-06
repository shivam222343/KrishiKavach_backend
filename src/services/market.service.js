import MarketPrice from '../models/marketPrice.model.js';
import ProcessingCenter from '../models/processingCenter.model.js';
import { getMarketPrices } from './gemini.service.js';
import { fetchNearbyFacilities } from './places.service.js';
import { scrapeMarketPrices } from './scraper.service.js';
// ── Daily scrape cycle for facility market prices ──────────────────────────────
export const runScrapeCycle = async () => {
    console.log('[Market] Starting facility price and location scrape cycle...');
    let updatedCount = 0;
    const errors = [];

    try {
        // 1. Fetch real-time agricultural facilities from Google Places (Kolhapur Region as base) 
        // Note: Coordinates for Kolhapur=16.7050, 74.2433
        console.log('[Market] Fetching real facilities from Google Places...');
        const realFacilities = await fetchNearbyFacilities(16.7050, 74.2433, 40000); // 40km radius
        console.log(`[Market] Discovered/Updated ${realFacilities?.length || 0} real facilities.`);

        // 2. Run real Agmarknet scraper for global market prices
        console.log('[Market] Running real-time Agmarknet and mandi scraper...');
        const scrapeResults = await scrapeMarketPrices(['Cotton', 'Soybean', 'Sugar', 'Grapes', 'Onion', 'Turmeric', 'Jaggery']);
        console.log(`[Market] Mandi prices updated for ${scrapeResults?.count || 0} commodities.`);

        // 3. Update existing ADMIN/Manual facilities with latest AI/real-time regional prices 
        // to ensure even manual entries have fresh market data
        const facilities = await ProcessingCenter.find({ source: 'ADMIN' });

        for (const facility of facilities) {
            try {
                // Get prices relevant to that facility's specific city context
                const crops = ['Soybean', 'Cotton', 'Wheat', 'Onion'];
                const priceData = await getMarketPrices(crops, null, facility.city || 'Nashik');

                if (priceData && priceData.localMarkets && priceData.localMarkets.length > 0) {
                    const mappedPrices = priceData.localMarkets.map(p => ({
                        crop: p.commodity || 'Soybean',
                        price: p.modalPrice || p.price || 4000,
                        unit: 'quintal',
                        date: new Date()
                    }));

                    facility.marketPrices = mappedPrices;
                    facility.lastUpdated = new Date();
                    await facility.save();
                    updatedCount++;
                }
            } catch (err) {
                console.error(`[Market] Failed to update ${facility.name}:`, err.message);
                errors.push({ facility: facility.name, error: err.message });
            }
        }

        return { saved: updatedCount, realTimeFacilities: realFacilities?.length || 0, scrapeResults, errors };
    } catch (err) {
        console.error('[Market] Scrape cycle critical failure:', err.message);
        throw err;
    }
};

// ── Query helpers ─────────────────────────────────────────────────────────────
export const searchMarketPrices = async ({
    commodity, state, district, startDate, endDate, page = 1, limit = 48,
} = {}) => {
    const q = {};
    if (commodity) q.commodity = { $regex: commodity, $options: 'i' };
    if (state) q.state = { $regex: state, $options: 'i' };
    if (district) q.district = { $regex: district, $options: 'i' };
    if (startDate || endDate) {
        q.publishDate = {};
        if (startDate) q.publishDate.$gte = new Date(startDate);
        if (endDate) q.publishDate.$lte = new Date(endDate);
    }
    const skip = (page - 1) * limit;
    const [results, total] = await Promise.all([
        MarketPrice.find(q).sort({ publishDate: -1 }).skip(skip).limit(limit).lean(),
        MarketPrice.countDocuments(q),
    ]);
    return { results, total, page, pages: Math.ceil(total / limit) };
};

export const getLatestByDistrict = async (commodity, state) => {
    const q = { commodity: { $regex: commodity, $options: 'i' } };
    if (state) q.state = { $regex: state, $options: 'i' };
    return MarketPrice.aggregate([
        { $match: q },
        { $sort: { publishDate: -1 } },
        { $group: { _id: '$district', district: { $first: '$district' }, state: { $first: '$state' }, pricePerQuintal: { $first: '$pricePerQuintal' }, publishDate: { $first: '$publishDate' }, sourceName: { $first: '$sourceName' }, confidenceScore: { $first: '$confidenceScore' }, marketType: { $first: '$marketType' } } },
        { $sort: { district: 1 } },
    ]);
};

export const getCommodityPriceHistory = async (commodity, { state, district } = {}) => {
    const q = { commodity: { $regex: commodity, $options: 'i' } };
    if (state) q.state = { $regex: state, $options: 'i' };
    if (district) q.district = { $regex: district, $options: 'i' };
    return MarketPrice.find(q).sort({ publishDate: 1 }).limit(365).lean();
};

export const predictPrices = async (commodity, district) => {
    const q = { commodity: { $regex: commodity, $options: 'i' } };
    if (district) q.district = { $regex: district, $options: 'i' };
    const raw = await MarketPrice.aggregate([
        { $match: q },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishDate' } }, avgPrice: { $avg: '$pricePerQuintal' } } },
        { $sort: { _id: 1 } },
        { $limit: 30 },
    ]);
    if (raw.length < 3) return { available: false, message: 'Not enough data for prediction' };
    const prices = raw.map(r => r.avgPrice);
    const windowSize = Math.min(7, prices.length);
    const recentAvg = prices.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
    const older = prices.slice(0, Math.floor(prices.length / 2));
    const newer = prices.slice(Math.floor(prices.length / 2));
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const newerAvg = newer.reduce((a, b) => a + b, 0) / newer.length;
    const trendFactor = newerAvg > 0 ? (newerAvg - olderAvg) / olderAvg : 0;
    const dailyTrend = trendFactor / raw.length;
    const lastDate = new Date(raw[raw.length - 1]._id);
    const predictions = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i + 1);
        return { date: d.toISOString().slice(0, 10), predictedPrice: Math.max(Math.round(recentAvg * (1 + dailyTrend * (i + 1))), 50) };
    });
    return { available: true, commodity, district: district || 'All', basedOnDays: raw.length, movingAverageWindow: windowSize, currentAvg: Math.round(recentAvg), trend: trendFactor > 0.01 ? 'rising' : trendFactor < -0.01 ? 'falling' : 'stable', predictions, history: raw.map(r => ({ date: r._id, avgPrice: Math.round(r.avgPrice) })) };
};

export const getDistinctFilterValues = async () => {
    const [states, commodities, districts] = await Promise.all([
        MarketPrice.distinct('state'),
        MarketPrice.distinct('commodity'),
        MarketPrice.distinct('district'),
    ]);
    return { states: states.sort(), commodities: commodities.sort(), districts: districts.sort() };
};

export const getMarketStats = async () => {
    const [total, latest, sources] = await Promise.all([
        MarketPrice.countDocuments(),
        MarketPrice.findOne().sort({ publishDate: -1 }).lean(),
        MarketPrice.distinct('sourceName'),
    ]);
    return { totalRecords: total, lastUpdated: latest?.publishDate || null, sourceCount: sources.length, sources };
};

export const getLatestPricesForCrops = async (cropNames) => {
    if (!cropNames?.length) return [];
    const results = await Promise.all(
        cropNames.map(async (cropName) => {
            const record = await MarketPrice.findOne({ commodity: { $regex: new RegExp(cropName, 'i') } }).sort({ publishDate: -1 }).lean();
            return record ? { ...record, requestedCrop: cropName } : null;
        })
    );
    return results.filter(Boolean);
};

import { getRecommendedSchemes } from '../services/gemini.service.js';
import User from '../models/user.model.js';

export const getSchemes = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const language = req.query.lang || user.language || 'en';
        const schemes = await getRecommendedSchemes(user, language, user.groqApiKey);

        // Safety check: Ensure we have a recommendations array
        if (!schemes || !Array.isArray(schemes.recommendations)) {
            console.error('[Schemes] Invalid AI response structure:', schemes);
            return res.status(200).json({
                summary: schemes?.summary || "Unable to fetch personalized schemes at this moment.",
                recommendations: []
            });
        }

        // Pass descriptive keywords for the frontend to fetch specific images
        const enhancedSchemes = {
            ...schemes,
            recommendations: schemes.recommendations.map(s => ({
                ...s,
                imageKeywords: s.imageKeywords || `farming,india,${s.title}`
            }))
        };

        res.status(200).json(enhancedSchemes);
    } catch (error) {
        console.error('Error fetching schemes:', error);
        res.status(500).json({ message: error.message });
    }
};

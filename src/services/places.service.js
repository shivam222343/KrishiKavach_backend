import axios from 'axios';
import ProcessingCenter from '../models/processingCenter.model.js';

/**
 * Service to fetch nearby agricultural facilities using Google Places API.
 * Keywords: "ginning mill", "apmc market", "warehouse", "cold storage"
 */
export const fetchNearbyFacilities = async (lat, lng, radius = 25000) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
        console.warn('[Places] Google Maps API key not set. Skipping real-time facility fetch.');
        return [];
    }

    const keywords = ['ginning mill', 'apmc market', 'warehouse', 'cold storage'];
    let allResults = [];

    for (const keyword of keywords) {
        try {
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;
            const response = await axios.get(url);

            if (response.data.status === 'OK') {
                const transformed = response.data.results.map(place => ({
                    externalId: place.place_id,
                    name: place.name,
                    type: mapPlaceTypeToFacilityType(keyword, place.types),
                    location: {
                        type: 'Point',
                        coordinates: [place.geometry.location.lng, place.geometry.location.lat]
                    },
                    city: place.vicinity,
                    source: 'GOOGLE_PLACES',
                    images: place.photos ? place.photos.map(p =>
                        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${apiKey}`
                    ) : []
                }));
                allResults = [...allResults, ...transformed];
            }
        } catch (error) {
            console.error(`[Places] Error fetching "${keyword}":`, error.message);
        }
    }

    // Save/Update in DB
    const savedFacilities = [];
    for (const facilityData of allResults) {
        try {
            const facility = await ProcessingCenter.findOneAndUpdate(
                { externalId: facilityData.externalId },
                facilityData,
                { upsert: true, new: true }
            );
            savedFacilities.push(facility);
        } catch (err) {
            console.error('[Places] Error saving facility:', err.message);
        }
    }

    return savedFacilities;
};

const mapPlaceTypeToFacilityType = (keyword, placeTypes) => {
    if (keyword.includes('ginning')) return 'Ginning Mill';
    if (keyword.includes('apmc')) return 'Agri Market';
    if (keyword.includes('warehouse')) return 'Warehouse';
    if (keyword.includes('cold storage')) return 'Processing Center';
    return 'Processing Center';
};

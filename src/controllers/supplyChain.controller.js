import SupplyChainListing from '../models/supplyChainListing.model.js';
import CollaborationRequest from '../models/collaborationRequest.model.js';
import CollaborationChat from '../models/collaborationChat.model.js';
import ProcessingCenter from '../models/processingCenter.model.js';
import axios from 'axios';
import { fetchNearbyFacilities } from '../services/places.service.js';
const ADVISORY_URL = process.env.ADVISORY_URL || "https://shivamdombe-appadvisory.hf.space";

// Ensure axios is available globally in this module if default import fails
const _axios = axios;

/**
 * Create a new crop listing for the supply chain
 */
export const createListing = async (req, res) => {
    try {
        const {
            cropType, quantity, unit, price, availabilityDate, longitude, latitude, description,
            city, yieldAmount, neededAmount, destinationName, preferredTransport, contactPhone,
            destinationLongitude, destinationLatitude, listingImage
        } = req.body;

        const listing = await SupplyChainListing.create({
            farmerId: req.user.id,
            cropType,
            quantity,
            unit,
            price,
            city,
            yieldAmount,
            neededAmount,
            destinationName,
            destinationCoords: destinationLongitude && destinationLatitude ? {
                type: 'Point',
                coordinates: [parseFloat(destinationLongitude), parseFloat(destinationLatitude)]
            } : undefined,
            listingImage,
            preferredTransport,
            contactPhone,
            availabilityDate,
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            description
        });

        res.status(201).json({ success: true, data: listing });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Search for nearby listings based on user location and distance
 */
export const getNearbyListings = async (req, res) => {
    try {
        const { longitude, latitude, distance = 10, cropType, city } = req.query;

        const query = {
            status: 'Active'
        };

        if (cropType) {
            query.cropType = cropType;
        }

        if (city) {
            query.city = { $regex: city, $options: 'i' };
        }

        if (longitude && latitude && !city) {
            query.location = {
                $nearSphere: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseFloat(distance) * 1000 // Convert km to meters
                }
            };
        }

        const listings = await SupplyChainListing.find(query).populate('farmerId', 'fullName mobileNumber');
        res.status(200).json({ success: true, count: listings.length, data: listings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Send a collaboration request to another farmer
 */
export const sendRequest = async (req, res) => {
    try {
        const { receiverId, listingId, message } = req.body;

        // Check if request already exists
        const existing = await CollaborationRequest.findOne({
            senderId: req.user.id,
            receiverId,
            listingId,
            status: 'Pending'
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Request already pending' });
        }

        const request = await CollaborationRequest.create({
            senderId: req.user.id,
            receiverId,
            listingId,
            message
        });

        // Emit real-time notification
        const io = req.app.get('socketio');
        if (io) {
            io.emit(`notification_${receiverId}`, {
                type: 'COLLAB_REQUEST',
                message: `New collaboration request from ${req.user.fullName || 'a farmer'}`,
                data: request
            });
        }

        res.status(201).json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Accept or Reject a collaboration request
 */
export const updateRequestStatus = async (req, res) => {
    try {
        const { requestId, status } = req.body;

        if (!['Accepted', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const request = await CollaborationRequest.findById(requestId);
        if (!request || request.receiverId.toString() !== req.user.id) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Request already processed' });
        }

        request.status = status;

        if (status === 'Accepted') {
            // Mark the listing as Sold/Collaborated
            await SupplyChainListing.findByIdAndUpdate(request.listingId, { status: 'Sold' });

            // Auto-reject other pending requests for the same listing
            await CollaborationRequest.updateMany(
                {
                    listingId: request.listingId,
                    _id: { $ne: request._id },
                    status: 'Pending'
                },
                { status: 'Rejected' }
            );

            // Create chat room
            const chat = await CollaborationChat.create({
                requestId: request._id,
                participants: [request.senderId, request.receiverId],
                messages: [{
                    senderId: req.user.id,
                    text: 'Collaboration request accepted! You can now coordinate logistics here.',
                    isSystem: true
                }]
            });
            request.chatId = chat._id;
        }

        await request.save();

        let responseData = request;
        if (status === 'Accepted' && request.chatId) {
            responseData = await CollaborationChat.findById(request.chatId)
                .populate('participants', 'fullName')
                .populate({
                    path: 'requestId',
                    populate: { path: 'listingId' }
                });
        }

        // Emit real-time notification to the sender
        const io = req.app.get('socketio');
        if (io) {
            io.emit(`notification_${request.senderId}`, {
                type: 'REQUEST_UPDATE',
                message: `Your collaboration request was ${status}`,
                data: responseData
            });
        }

        res.status(200).json({ success: true, data: responseData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all active collaborations and requests for current user
 */
export const getMyCollaborations = async (req, res) => {
    try {
        const requestsReceived = await CollaborationRequest.find({
            receiverId: req.user.id,
            status: 'Pending'
        })
            .populate('senderId', 'fullName mobileNumber')
            .populate('listingId');

        const requestsSent = await CollaborationRequest.find({
            senderId: req.user.id,
            status: 'Pending'
        })
            .populate('receiverId', 'fullName mobileNumber')
            .populate('listingId');

        const activeChats = await CollaborationChat.find({ participants: req.user.id })
            .populate('participants', 'fullName')
            .populate({
                path: 'requestId',
                populate: { path: 'listingId' }
            });

        res.status(200).json({
            success: true,
            data: {
                received: requestsReceived,
                sent: requestsSent,
                chats: activeChats
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
/**
 * Fetch nearby processing centers (Ginning mills, warehouses, etc.)
 * Using Google Places API or mock data if key is missing
 */
export const getExternalProcessingCenters = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50, city } = req.query;

        // 1. Search locally in our DB first
        let localCenters = [];
        if (latitude && longitude) {
            localCenters = await ProcessingCenter.find({
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                        $maxDistance: radius * 1000
                    }
                }
            }).limit(50);
        }
        // 2. Fetch fresh data in the background if count is low or data is old
        const needsUpdate = localCenters.length < 5;

        const fetchExternalData = async () => {
            // 2. Fetch from Google Places (Primary for real facilities)
            if (needsUpdate && latitude && longitude) {
                try {
                    console.log('[*] Low local results or update needed. Fetching from Google Places in background...');
                    await fetchNearbyFacilities(latitude, longitude, radius * 1000);
                } catch (err) {
                    console.error("[-] Google Places fetch error:", err.message);
                }
            }

            // 3. Call Python Hybrid Service (Scraper + OSM)
            const pythonServiceUrl = `${ADVISORY_URL}/search-facilities?lat=${latitude}&lon=${longitude}&radius=${radius}${city ? `&city=${city}` : ''}`;
            try {
                console.log(`[*] Triggering hybrid fetch: ${pythonServiceUrl}`);
                const response = await _axios.get(pythonServiceUrl, { timeout: 15000 }); // Increase timeout to 15s for scraper
                if (response.data && response.data.success) {
                    const externalResults = response.data.data;
                    for (const center of externalResults) {
                        if (!center.id) continue;
                        await ProcessingCenter.findOneAndUpdate(
                            { externalId: center.id },
                            {
                                name: center.name,
                                type: center.type,
                                city: center.city,
                                contact: center.contact,
                                image: center.image,
                                source: center.source,
                                location: {
                                    type: "Point",
                                    coordinates: center.location
                                },
                                lastUpdated: new Date()
                            },
                            { upsert: true, new: true }
                        );
                    }
                }
            } catch (err) {
                console.error("[-] Python Service Error (Background):", err.message);
            }
        };

        // If we have some results, return them immediately and fetch fresh ones in background
        if (localCenters.length > 3) {
            console.log(`[+] Returning ${localCenters.length} cached results immediately.`);
            // Trigger background update but don't await
            fetchExternalData().catch(err => console.error("[-] Background fetch failed:", err));

            return res.status(200).json({
                success: true,
                count: localCenters.length,
                data: localCenters.map(prepareCenterResponse)
            });
        }

        // If we have nothing, we must wait at least for the first attempt or timeout
        console.log(`[*] No cached results. Waiting for external fetch...`);
        await fetchExternalData();

        // Final query to get whatever we found
        const finalCenters = await ProcessingCenter.find({
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                    $maxDistance: radius * 1000
                }
            }
        }).limit(50);

        res.status(200).json({
            success: true,
            count: finalCenters.length,
            data: finalCenters.map(prepareCenterResponse)
        });
    } catch (error) {
        console.error("[-] Facility API error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper to keep response clean
const prepareCenterResponse = (c) => ({
    id: c.externalId || c._id,
    _id: c._id,
    name: c.name,
    type: c.type,
    location: c.location.coordinates,
    city: c.city,
    contact: c.contact,
    image: c.image,
    images: c.images || [],
    marketPrices: c.marketPrices || [],
    source: c.source || 'External',
    lastUpdated: c.lastUpdated
});

/**
 * Delete a listing (mark as completed or removed)
 */
export const deleteListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await SupplyChainListing.findById(id);

        if (!listing) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }

        // Verify ownership
        if (listing.farmerId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });
        }

        await SupplyChainListing.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Listing removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all listings created by the current user
 */
export const getMyListings = async (req, res) => {
    try {
        const listings = await SupplyChainListing.find({ farmerId: req.user.id })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: listings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update listing status (e.g. to 'Sold' or 'Completed')
 */
export const updateListingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['Active', 'Sold', 'Expired'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const listing = await SupplyChainListing.findById(id);
        if (!listing) {
            return res.status(404).json({ success: false, message: 'Listing not found' });
        }

        if (listing.farmerId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        listing.status = status;
        await listing.save();

        res.status(200).json({ success: true, data: listing });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

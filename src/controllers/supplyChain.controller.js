import SupplyChainListing from '../models/supplyChainListing.model.js';
import CollaborationRequest from '../models/collaborationRequest.model.js';
import CollaborationChat from '../models/collaborationChat.model.js';
import ProcessingCenter from '../models/processingCenter.model.js';
import axios from 'axios';

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

        request.status = status;

        if (status === 'Accepted') {
            // Mark the listing as Sold/Collaborated so it doesn't show for others
            await SupplyChainListing.findByIdAndUpdate(request.listingId, { status: 'Sold' });

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

        // Emit real-time notification to the sender
        const io = req.app.get('socketio');
        if (io) {
            io.emit(`notification_${request.senderId}`, {
                type: 'REQUEST_UPDATE',
                message: `Your collaboration request was ${status}`,
                data: request
            });
        }

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all active collaborations and requests for current user
 */
export const getMyCollaborations = async (req, res) => {
    try {
        const requestsReceived = await CollaborationRequest.find({ receiverId: req.user.id })
            .populate('senderId', 'fullName mobileNumber')
            .populate('listingId');

        const requestsSent = await CollaborationRequest.find({ senderId: req.user.id })
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

        // 2. Call our Python Hybrid Service (Scraper + OSM)
        const pythonServiceUrl = `http://localhost:8000/search-facilities?lat=${latitude}&lon=${longitude}&radius=${radius}${city ? `&city=${city}` : ''}`;
        
        console.log(`[*] Fetching hybrid facilities from: ${pythonServiceUrl}`);
        
        let externalResults = [];
        try {
            const response = await _axios.get(pythonServiceUrl);
            if (response.data && response.data.success) {
                externalResults = response.data.data;

                // 3. Persist external results to DB for future use
                for (const center of externalResults) {
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
                
                // Refresh local search to include newly added ones
                localCenters = await ProcessingCenter.find({
                    location: {
                        $near: {
                            $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                            $maxDistance: radius * 1000
                        }
                    }
                }).limit(50);
            }
        } catch (err) {
            console.error("[-] Python Service Error:", err.message);
            if (localCenters.length === 0) {
                 // Fallback to absolute minimal if even DB is empty and service is down
                 localCenters = [{
                    id: 'fallback_1',
                    name: 'Rajashri Shahu Ginning (Fallback)',
                    type: 'Processing Center',
                    location: [74.582, 16.852],
                    city: 'Sangli',
                    contact: '+91 98765 43210',
                    image: 'https://images.unsplash.com/photo-1590633717560-49651582e3b2',
                    source: 'Fallback'
                }];
            }
        }

        res.status(200).json({ 
            success: true, 
            count: localCenters.length, 
            data: localCenters.map(c => ({
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
                source: c.source
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

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

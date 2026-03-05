import mongoose from 'mongoose';

const collaborationRequestSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        listingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SupplyChainListing',
            required: true
        },
        message: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Accepted', 'Rejected'],
            default: 'Pending'
        },
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CollaborationChat'
        }
    },
    { timestamps: true }
);

const CollaborationRequest = mongoose.model('CollaborationRequest', collaborationRequestSchema);
export default CollaborationRequest;

import mongoose from 'mongoose';

const collaborationChatSchema = new mongoose.Schema(
    {
        requestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CollaborationRequest',
            required: true
        },
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        messages: [
            {
                senderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                text: String,
                isSystem: { type: Boolean, default: false },
                createdAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

const CollaborationChat = mongoose.model('CollaborationChat', collaborationChatSchema);
export default CollaborationChat;

import mongoose from "mongoose";

const ambulanceRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // We can store user socket ID or actual DB Object ID depending on logic. I'll use String for flexibility (e.g., Socket ID from frontend if no user is signed in, or User ID if signed in).
  userName: { type: String, required: true },
  pickupLocation: {
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  },
  destinationLocation: { // Assigned hospital
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  },
  ambulanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ambulance', default: null },
  status: { type: String, enum: ['pending', 'accepted', 'completed', 'cancelled'], default: 'pending' }
}, { timestamps: true });

const ambulanceRequestModel = mongoose.models.ambulanceRequest || mongoose.model("ambulanceRequest", ambulanceRequestSchema);

export default ambulanceRequestModel;

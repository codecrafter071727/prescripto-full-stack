import mongoose from "mongoose";

const ambulanceSchema = new mongoose.Schema({
  driverName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  currentLocation: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  available: { type: Boolean, default: false }
});

const ambulanceModel = mongoose.models.ambulance || mongoose.model("ambulance", ambulanceSchema);

export default ambulanceModel;

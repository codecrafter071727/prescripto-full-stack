import ambulanceModel from "../models/ambulanceModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";

// Register a new driver (Admin action)
const registerDriver = async (req, res) => {
    try {
        const { driverName, email, password, phone, vehicleNumber } = req.body;

        if (!driverName || !email || !password || !phone || !vehicleNumber) {
            return res.json({ success: false, message: 'Missing Details' });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password (min 8 chars)" });
        }

        const exists = await ambulanceModel.findOne({ email });
        if (exists) {
            return res.json({ success: false, message: "Driver with this email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAmbulance = new ambulanceModel({
            driverName,
            email,
            password: hashedPassword,
            phone,
            vehicleNumber,
            available: true
        });

        const ambulance = await newAmbulance.save();
        const token = jwt.sign({ id: ambulance._id }, process.env.JWT_SECRET);
        res.json({ success: true, message: "Driver registered successfully", token });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Get all available ambulances
const getAvailableAmbulances = async (req, res) => {
    try {
        const ambulances = await ambulanceModel.find({ available: true }).select('-password');
        res.json({ success: true, ambulances });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Driver Login
const loginDriver = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({ success: false, message: "Email and password are required" });
        }

        const driver = await ambulanceModel.findOne({ email });

        if (!driver) {
            return res.json({ success: false, message: "Driver does not exist" });
        }

        const isMatch = await bcrypt.compare(password, driver.password);

        if (isMatch) {
            const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET);
            res.json({
                success: true,
                token,
                driverData: {
                    _id: driver._id,
                    driverName: driver.driverName,
                    email: driver.email,
                    phone: driver.phone,
                    vehicleNumber: driver.vehicleNumber,
                    available: driver.available
                }
            });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Get Driver Profile (protected by authDriver middleware)
const getDriverProfile = async (req, res) => {
    try {
        const driverId = req.driverId;
        const driver = await ambulanceModel.findById(driverId).select("-password");
        if (!driver) {
            return res.json({ success: false, message: "Driver not found" });
        }
        res.json({ success: true, driverData: driver });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Update Driver Availability
const updateDriverAvailability = async (req, res) => {
    try {
        const driverId = req.driverId;
        const { available } = req.body;
        await ambulanceModel.findByIdAndUpdate(driverId, { available });
        res.json({ success: true, message: "Availability updated" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export { registerDriver, getAvailableAmbulances, loginDriver, getDriverProfile, updateDriverAvailability };

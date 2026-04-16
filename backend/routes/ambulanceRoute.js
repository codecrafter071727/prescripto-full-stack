import express from 'express';
import {
    registerDriver,
    getAvailableAmbulances,
    loginDriver,
    getDriverProfile,
    updateDriverAvailability
} from '../controllers/ambulanceController.js';
import authDriver from '../middleware/authDriver.js';

const ambulanceRouter = express.Router();

// Public routes
ambulanceRouter.post('/register', registerDriver);
ambulanceRouter.post('/login', loginDriver);
ambulanceRouter.get('/available', getAvailableAmbulances);

// Protected driver routes
ambulanceRouter.get('/profile', authDriver, getDriverProfile);
ambulanceRouter.post('/availability', authDriver, updateDriverAvailability);

export default ambulanceRouter;

import { Server } from "socket.io";
import ambulanceRequestModel from "../models/ambulanceRequestModel.js";

let io;

// In-memory map: driverId (MongoDB _id string) → socket.id
const driverSocketMap = {};

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("New socket connection:", socket.id);

        // ── DRIVER REGISTERS after login ──────────────────────────────────────
        // Driver emits this right after connecting so we can map their driverId → socket.id
        socket.on("driver_register", ({ driverId }) => {
            driverSocketMap[driverId] = socket.id;
            socket.join("drivers"); // join a shared room for broadcast
            console.log(`Driver ${driverId} registered with socket ${socket.id}`);

            // Immediately send any pending emergency they may have missed
            ambulanceRequestModel.find({ status: "pending" })
                .sort({ createdAt: -1 })
                .limit(1)
                .then((pending) => {
                    if (pending.length > 0) {
                        const req = pending[0];
                        socket.emit("incoming_emergency", {
                            requestId: req._id,
                            userName: req.userName,
                            pickupLocation: req.pickupLocation,
                            destinationLocation: req.destinationLocation,
                        });
                    }
                })
                .catch(console.error);
        });

        // ── PATIENT requests ambulance ────────────────────────────────────────
        socket.on("user_request_ambulance", async (data) => {
            try {
                const newRequest = new ambulanceRequestModel({
                    userId: socket.id,           // patient's socket.id — used for targeted notify
                    userName: data.userName,
                    pickupLocation: data.pickupLocation,
                    destinationLocation: data.destinationLocation,
                    status: "pending"
                });
                await newRequest.save();

                // Broadcast only to drivers room
                io.to("drivers").emit("incoming_emergency", {
                    requestId: newRequest._id,
                    userName: newRequest.userName,
                    pickupLocation: newRequest.pickupLocation,
                    destinationLocation: newRequest.destinationLocation,
                });

                // Acknowledge patient
                socket.emit("request_acknowledged", {
                    requestId: newRequest._id,
                    status: "pending"
                });

                console.log(`Emergency request ${newRequest._id} from ${newRequest.userName}`);
            } catch (error) {
                console.error(error);
                socket.emit("error", "Failed to process emergency request.");
            }
        });

        // ── DRIVER accepts request ────────────────────────────────────────────
        socket.on("driver_accept_request", async (data) => {
            try {
                const { requestId, driverId, driverDetails } = data;

                const request = await ambulanceRequestModel.findById(requestId);
                if (!request) {
                    return socket.emit("error", "Request not found.");
                }

                if (request.status !== "pending") {
                    return socket.emit("error", "This request has already been handled.");
                }

                request.status = "accepted";
                request.ambulanceId = driverId;
                await request.save();

                // Notify the specific patient
                io.to(request.userId).emit("ambulance_assigned", {
                    driverDetails,
                    requestId
                });

                // Confirm to driver
                socket.emit("request_accepted_confirmed", { requestId });

                // Tell all other drivers this request is gone
                socket.to("drivers").emit("emergency_taken", { requestId });

                console.log(`Request ${requestId} accepted by driver ${driverId}`);
            } catch (error) {
                console.error(error);
                socket.emit("error", "Failed to accept request.");
            }
        });

        // ── DRIVER rejects/ignores request ───────────────────────────────────
        socket.on("driver_reject_request", ({ requestId }) => {
            // Just dismiss on this driver's side — other drivers still see it
            socket.emit("request_rejected_ack", { requestId });
        });

        // ── DRIVER sends live location ────────────────────────────────────────
        socket.on("driver_location_update", async (data) => {
            try {
                const { requestId, location } = data;

                // Look up the patient's socket.id from DB
                const request = await ambulanceRequestModel.findById(requestId).lean();
                if (request && request.userId) {
                    io.to(request.userId).emit("live_tracking_update", { location });
                }
            } catch (error) {
                console.error(error);
            }
        });

        // ── DRIVER completes ride ─────────────────────────────────────────────
        socket.on("ride_completed", async ({ requestId }) => {
            try {
                const request = await ambulanceRequestModel.findById(requestId);
                if (request) {
                    request.status = "completed";
                    await request.save();
                    io.to(request.userId).emit("ride_completed_notify");
                }
            } catch (error) {
                console.error(error);
            }
        });

        // ── DRIVER asks for missed emergencies on connect ─────────────────────
        socket.on("get_pending_emergencies", async () => {
            try {
                const pending = await ambulanceRequestModel.find({ status: "pending" })
                    .sort({ createdAt: -1 })
                    .limit(1);
                if (pending.length > 0) {
                    const req = pending[0];
                    socket.emit("incoming_emergency", {
                        requestId: req._id,
                        userName: req.userName,
                        pickupLocation: req.pickupLocation,
                        destinationLocation: req.destinationLocation,
                    });
                }
            } catch (error) {
                console.error(error);
            }
        });

        // ── DISCONNECT ────────────────────────────────────────────────────────
        socket.on("disconnect", () => {
            // Remove from driver map if it was a driver
            for (const [dId, sId] of Object.entries(driverSocketMap)) {
                if (sId === socket.id) {
                    delete driverSocketMap[dId];
                    console.log(`Driver ${dId} disconnected`);
                    break;
                }
            }
            console.log("Socket disconnected:", socket.id);
        });
    });
};

export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
};

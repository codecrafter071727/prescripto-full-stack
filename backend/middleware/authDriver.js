import jwt from 'jsonwebtoken';

const authDriver = async (req, res, next) => {
    try {
        const { drivertoken } = req.headers;
        if (!drivertoken) {
            return res.json({ success: false, message: 'Not Authorized. Login Again.' });
        }

        const tokenDecode = jwt.verify(drivertoken, process.env.JWT_SECRET);
        req.driverId = tokenDecode.id;
        next();
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export default authDriver;

import mongoose from "mongoose";
import { ENV } from "./env.js";


export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(ENV.DB_URL)
        console.log("connected to mongoDB", conn.connection.host);
    } catch (error) {
        console.error("Error connecting to database:", error.message);
        process.exit(1); //
    }
}
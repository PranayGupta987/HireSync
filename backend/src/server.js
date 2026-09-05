import express from "express";
import { ENV } from "./lib/env.js";
import path from "path";
import { connectDB } from "./lib/db.js"
import dns from "dns";
import { start } from "repl";

dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const __dirname = path.resolve();

if (ENV.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("/{*any}", (req, res) => {
        res.sendFile(
            path.join(__dirname, "../frontend/dist/index.html")
        );
    });
}



const startServer = async () => {
    try {
        await connectDB();
        app.listen(ENV.PORT, () => console.log(`Server running on port ${ENV.PORT}`));
    } catch (error) {
        console.error("error starting server");
    }

}


startServer();
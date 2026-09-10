import { clerkClient, requireAuth } from "@clerk/express";
import User from "../models/User.js";
import { syncUser } from "../lib/userSync.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;

      if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

      let user = await User.findOne({ clerkId });

      // Clerk webhooks are asynchronous and may be unavailable in local
      // development. Never reject an otherwise valid signed-in user just
      // because their local profile has not been created yet.
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        user = await syncUser(clerkUser);
      }

      // attach user to req
      req.user = user;

      next();
    } catch (error) {
      console.error("Error in protectRoute middleware", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];

import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import User from "../models/User.js";
import { deleteStreamUser } from "./stream.js";
import { syncUser } from "./userSync.js";

export const inngest = new Inngest({ id: "Hire-Sync" });

const syncClerkUser = inngest.createFunction(
  { id: "sync-user" },
  [{ event: "clerk/user.created" }, { event: "clerk/user.updated" }],
  async ({ event }) => {
    await connectDB();
    await syncUser(event.data);
  }
);

const deleteUserFromDB = inngest.createFunction(
  { id: "delete-user-from-db" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();

    const { id } = event.data;
    await User.deleteOne({ clerkId: id });

    await deleteStreamUser(id.toString());
  }
);

export const functions = [syncClerkUser, deleteUserFromDB];

import { Inngest } from "inngest"; 
import { connectDB } from "./db.js"; 
import User from "../models/User.js"; 
import { upsertStreamUser,deleteStreamUser } from "./stream.js";
export const inngest = new Inngest({ id: "Hire--Sync" }); 
 
const syncUser = inngest.createFunction( 
    {id: "sync-user", name: "Sync User"}, 
    {event: "clerk/user.created",}, 
    async ({ event }) => { 
        await connectDB(); 
        const {id,first_name,last_name,email_addresses,image_url} = event.data; 
        const newUser = { 
            clerkId: id, 
            email: email_addresses[0]?.email_address, 
            name: `${first_name || ""} ${last_name || ""}`.trim(), 
            profileImage: image_url, 
        }; 
        await User.create(newUser); 
        console.log(`User synced to MongoDB: ${id}`);
        await upsertStreamUser({
            id: newUser.clerkId.toString(),
            name: newUser.name,
            image: newUser.profileImage
        })
    } 
); 
 
const deleteUserFromDB = inngest.createFunction( 
    {id: "delete-user-from-db",name: "Delete User From DB"}, 
    {event: "clerk/user.deleted",}, 
    async ({ event }) => { 
        await connectDB(); 
        const { id } = event.data; 
        await User.deleteOne({ clerkId: id }); 
        console.log(`User deleted from MongoDB: ${id}`);
        await deleteStreamUser(id.toString());
    } 
); 
 
export const functions = [syncUser, deleteUserFromDB];
import {Ingest} from "inngest";
import {connnectDB} from "./db.js";
import User from "../models/User.js";

export const inngest = new Inngest({ id: "HireSync" });


const syncUser = inngest.createFunction(
    { name: "Sync User" },  
    { event: "clerk/user.created" }, 
    async ({ event }) => {
        await connnectDB();
        const { id, first_name, last_name, email_addresses, image_url } = event.data;
        const newUser={
            clerkID:id,
            email:email_addresses[0]?.email_addresses,
            name:`${first_name || ""} ${last_name || ""}`,
            profileImage:image_url
        }
       await User.create(newUser)
    }  
)

const deleteUserFromDB = inngest.createFunction(
    { name: "delete-user-from-db" },  
    { event: "clerk/user.deleted" }, 
    async ({ event }) => {
        await connnectDB();
        const{id}=event.data;
        await User.deleteOne({clerkID:id});
    }  
)

export const functions =[syncUser,deleteUserFromDB];
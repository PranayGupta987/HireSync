import {StreamChat} from "stream-chat";
import {ENV} from "./env.js";

const apiKey = ENV.STREAM_API_KEY;
const apiSecret = ENV.STREAM_API_SECRET;

if(!apiKey || !apiSecret){
    throw new Error("STREAM_API_KEY and STREAM_API_SECRET are required");
}

export const chatClient =  StreamChat.getInstance(apiKey,apiSecret);

export const upsertStreamUser = async (userData) =>{
    try{
        await chatClient.upsertUser(userData);
        return userData;
    }
    catch(error){
        console.error("Error creating/updating user in Stream:", error);    
        throw error;
    }
}

export const deleteStreamUser = async (userId) =>{
    try{
        await chatClient.deleteUser(userId);
        return { id: userId };
    }
    catch(error){
        console.error("Error deleting user in Stream:", error);    
        throw error;
    }
}
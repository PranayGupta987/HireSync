import express from "express";
import {ENV} from "./lib/env.js"
const app = express();


app.get('/',(req,res)=>{
    res.send("hello from pranay");
});

app.listen(process.env.PORT, ()=>{
    console.log(`server running on port ${ENV.PORT}`);
})
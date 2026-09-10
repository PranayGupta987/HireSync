import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import mongoose from "mongoose";

const isValidSessionId = (id) => mongoose.isValidObjectId(id);

export async function createSession(req, res) {
  try {
    const { problem, difficulty } = req.body;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    if (typeof problem !== "string" || !problem.trim() || typeof difficulty !== "string") {
      return res.status(400).json({ message: "Problem and difficulty are required" });
    }

    const normalizedDifficulty = difficulty.toLowerCase();
    if (!Session.schema.path("difficulty").enumValues.includes(normalizedDifficulty)) {
      return res.status(400).json({ message: "Difficulty must be easy, medium, or hard" });
    }

    // generate a unique call id for stream video
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Generate the id first so both Stream resources can be tied to the local
    // session. Saving afterwards avoids listing a session when Stream rejects
    // its creation.
    const session = new Session({
      problem: problem.trim(),
      difficulty: normalizedDifficulty,
      host: userId,
      callId,
    });

    const call = streamClient.video.call("default", callId);
    let channel;

    try {
      await call.getOrCreate({
        data: {
          created_by_id: clerkId,
          custom: {
            problem: session.problem,
            difficulty: normalizedDifficulty,
            sessionId: session._id.toString(),
          },
        },
      });

      channel = chatClient.channel("messaging", callId, {
        name: `${session.problem} Session`,
        created_by_id: clerkId,
        members: [clerkId],
      });
      await channel.create();

      await session.save();
    } catch (error) {
      // Do not leave a call behind if the associated chat channel or database
      // write fails during setup.
      await Promise.allSettled([
        call.delete({ hard: true }),
        channel?.delete(),
      ]);
      throw error;
    }

    res.status(201).json({ session });
  } catch (error) {
    console.log("Error in createSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getActiveSessions(_, res) {
  try {
    const sessions = await Session.find({ status: "active" })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getActiveSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyRecentSessions(req, res) {
  try {
    const userId = req.user._id;

    // get sessions where user is either host or participant
    const sessions = await Session.find({
      status: "completed",
      $or: [{ host: userId }, { participant: userId }],
    })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getMyRecentSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getSessionById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidSessionId(id)) return res.status(400).json({ message: "Invalid session id" });

    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in getSessionById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function joinSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    if (!isValidSessionId(id)) return res.status(400).json({ message: "Invalid session id" });

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status !== "active") {
      return res.status(400).json({ message: "Cannot join a completed session" });
    }

    if (session.host.toString() === userId.toString()) {
      return res.status(400).json({ message: "Host cannot join their own session as participant" });
    }

    // check if session is already full - has a participant
    if (session.participant) return res.status(409).json({ message: "Session is full" });

    // The conditional update makes two simultaneous join requests safe: only
    // one can claim the single participant spot.
    const joinedSession = await Session.findOneAndUpdate(
      { _id: id, status: "active", participant: null },
      { $set: { participant: userId } },
      { new: true }
    );

    if (!joinedSession) return res.status(409).json({ message: "Session is no longer available" });

    try {
      const channel = chatClient.channel("messaging", joinedSession.callId);
      await channel.addMembers([clerkId]);
    } catch (error) {
      // The participant slot is only valid when the chat membership was also
      // established. Roll it back so another user is not locked out.
      await Session.updateOne({ _id: id, participant: userId }, { $set: { participant: null } });
      throw error;
    }

    res.status(200).json({ session: joinedSession });
  } catch (error) {
    console.log("Error in joinSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function endSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!isValidSessionId(id)) return res.status(400).json({ message: "Invalid session id" });

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    // check if user is the host
    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can end the session" });
    }

    // check if session is already completed
    if (session.status === "completed") {
      return res.status(400).json({ message: "Session is already completed" });
    }

    session.status = "completed";
    await session.save();

    // External cleanup should not prevent a host from ending a session. Calls
    // and channels may already have been removed by Stream retention rules.
    const call = streamClient.video.call("default", session.callId);
    const channel = chatClient.channel("messaging", session.callId);
    const cleanup = await Promise.allSettled([call.delete({ hard: true }), channel.delete()]);
    cleanup.filter((result) => result.status === "rejected").forEach((result) => {
      console.warn("Unable to clean up Stream session resource:", result.reason?.message);
    });

    res.status(200).json({ session, message: "Session ended successfully" });
  } catch (error) {
    console.log("Error in endSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

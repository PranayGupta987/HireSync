import User from "../models/User.js";
import { upsertStreamUser } from "./stream.js";

const getEmail = (user) =>
  user.primaryEmailAddress?.emailAddress ||
  user.primary_email_address?.email_address ||
  user.emailAddresses?.[0]?.emailAddress ||
  user.email_addresses?.[0]?.email_address ||
  `${user.id}@users.invalid`;

/**
 * Keeps the local user record in step with Clerk. Webhooks are useful for this,
 * but this function also lets authenticated users use the app before a webhook
 * has been delivered.
 */
export async function syncUser(user) {
  const name = [user.firstName ?? user.first_name, user.lastName ?? user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const userData = {
    clerkId: user.id,
    email: getEmail(user),
    name: name || user.username || "HireSync user",
    profileImage: user.imageUrl ?? user.image_url ?? "",
  };

  const localUser = await User.findOneAndUpdate(
    { clerkId: userData.clerkId },
    { $set: userData },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Stream accepts idempotent upserts, so calling this on first API use also
  // repairs users created while the webhook endpoint was unavailable.
  await upsertStreamUser({
    id: userData.clerkId,
    name: userData.name,
    image: userData.profileImage,
  });

  return localUser;
}

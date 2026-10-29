import { currentUser, response } from "../../_lib/email-auth.js";
export async function onRequestGet({ request, env }) {
  if (!env.DB) return response({ message: "Authentication database is unavailable." }, 503);
  try {
    const user = await currentUser(env, request);
    return response({ user });
  } catch (error) {
    console.error("Session lookup failed", error?.message);
    return response({ message: "Could not check the current session." }, 503);
  }
}

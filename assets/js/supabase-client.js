
(() => {
  "use strict";

  const config = window.SCHOOL_CONFIG;

  if (!config?.SUPABASE_URL ||
      !config?.SUPABASE_PUBLISHABLE_KEY ||
      config.SUPABASE_URL.startsWith("YOUR_") ||
      config.SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")) {
    console.error("Please configure your Supabase URL and publishable key.");
    return;
  }

  let projectUrl;
  try {
    projectUrl = new URL(config.SUPABASE_URL);
  } catch {
    console.error("The Supabase project URL is invalid.");
    return;
  }

  if (projectUrl.protocol !== "https:") {
    console.error("The Supabase project URL must use HTTPS.");
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase library did not load.");
    return;
  }

  try {
    window.schoolSupabase = window.supabase.createClient(
      projectUrl.origin,
      config.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  } catch {
    console.error("Supabase client could not be initialized. Check the URL, publishable key and SDK.");
  }
})();

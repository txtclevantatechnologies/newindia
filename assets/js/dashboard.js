(async () => {
  "use strict";

  const client = window.schoolSupabase;
  const status = document.getElementById("dashboardStatus");
  const emailLabel = document.getElementById("adminEmail");
  const logoutButton = document.getElementById("logoutButton");
  const refreshCountsButton = document.getElementById("dashboardRefreshCounts");
  const countsUpdated = document.getElementById("dashboardCountsUpdated");

  function showError(text) {
    status.textContent = text;
    status.className = "module-status error";
  }

  function loadModule(source, statusElementId) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => {
        const moduleStatus = document.getElementById(statusElementId);
        if (moduleStatus) {
          moduleStatus.textContent = "This admin module could not load. Refresh the page and try again.";
          moduleStatus.className = "module-status error";
        }
        reject(new Error(`Could not load ${source}`));
      };
      document.body.appendChild(script);
    });
  }

  async function loadOverviewCounts() {
    if (refreshCountsButton) {
      refreshCountsButton.disabled = true;
      refreshCountsButton.textContent = "Refreshing...";
    }

    const metrics = [
      {
        id: "publishedAnnouncementCount",
        label: "published announcements",
        query: () => client
          .from("announcements")
          .select("id", { count: "exact", head: true })
          .eq("is_published", true)
      },
      {
        id: "publishedGalleryCount",
        label: "published gallery items",
        query: () => client
          .from("gallery_items")
          .select("id", { count: "exact", head: true })
          .eq("is_published", true)
      },
      {
        id: "newEnquiryCount",
        label: "new enquiries",
        query: () => client
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "new")
      },
      {
        id: "publishedContentCount",
        label: "published content items",
        query: () => client
          .from("site_content")
          .select("content_key", { count: "exact", head: true })
          .eq("is_published", true)
      }
    ];

    await Promise.all(metrics.map(async ({ id, label, query }) => {
      const value = document.getElementById(id);
      if (!value) return;

      try {
        const { count, error } = await query();
        if (error) throw error;
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error("A valid count was not returned by the database.");
        }
        value.textContent = String(count);
        value.dataset.state = "loaded";
      } catch (error) {
        console.error(`Could not load count for ${label}:`, error);
        value.textContent = "—";
        value.dataset.state = "error";
        value.title = "Count unavailable. Check the related table permissions.";
      }
    }));

    if (countsUpdated) {
      countsUpdated.textContent = `Last updated ${new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date())}.`;
    }
    if (refreshCountsButton) {
      refreshCountsButton.disabled = false;
      refreshCountsButton.textContent = "Refresh counts";
    }
  }

  if (!client) {
    showError("Supabase is not configured. Check config.js and network access.");
    logoutButton.disabled = true;
    return;
  }

  try {
    const { data: { session }, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.user) {
      window.location.replace("./login.html");
      return;
    }

    const { data: profile, error: profileError } = await client
      .from("admin_profiles")
      .select("user_id, display_name")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      await client.auth.signOut();
      window.location.replace("./login.html");
      return;
    }

    status.textContent = `Access verified. Welcome, ${profile.display_name}.`;
    status.className = "dashboard-status";
    emailLabel.textContent = `Signed in as: ${session.user.email || "Administrator"}`;

    window.schoolDashboardRefreshCounts = loadOverviewCounts;
    refreshCountsButton?.addEventListener("click", loadOverviewCounts);
    void loadOverviewCounts();

    const modules = [
      ["../assets/js/announcements.js", "announcementStatus"],
      ["../assets/js/gallery-admin.js", "galleryStatus"],
      ["../assets/js/site-content-admin.js", "siteContentStatus"],
      ["../assets/js/enquiries-admin.js", "enquiriesStatus"]
    ];
    const results = await Promise.allSettled(
      modules.map(([source, statusId]) => loadModule(source, statusId))
    );
    if (results.some((result) => result.status === "rejected")) {
      console.error("One or more administrator modules failed to load.", results);
    }
  } catch (error) {
    console.error("Dashboard authorization failed:", error);
    showError("Unable to verify administrator access. Please sign in again.");
    await client.auth.signOut();
    window.location.replace("./login.html");
    return;
  }

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out…";

    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      window.location.replace("./login.html");
    } catch (error) {
      console.error("Sign-out failed:", error);
      showError("Sign-out failed. Please try again.");
      logoutButton.disabled = false;
      logoutButton.textContent = "Sign out";
    }
  });
})();

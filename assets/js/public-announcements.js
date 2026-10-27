(() => {
  "use strict";

  const widgets = [...document.querySelectorAll("[data-announcement-widget]")];
  if (widgets.length === 0) return;

  function initializeWidget(widget) {
    const container = widget.querySelector("[data-announcements-container]");
    const countLabel = widget.querySelector("[data-announcements-count]");
    const refreshButton = widget.querySelector("[data-announcements-refresh]");
    if (!container || !countLabel) return async () => {};

    let loading = false;
    const category = container.dataset.announcementCategory;
    const previewMode = container.hasAttribute("data-announcement-preview");

    function showMessage(message, isError = false) {
      container.replaceChildren();
      const box = document.createElement("div");
      box.className = `news-empty${isError ? " news-error" : ""}`;
      box.setAttribute("role", "status");

      const heading = document.createElement("h3");
      heading.textContent = isError
        ? "Unable to load updates"
        : "No announcements yet";
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      box.append(heading, paragraph);
      container.appendChild(box);
    }

    function formatDate(value) {
      if (!value) return "Date unavailable";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Date unavailable";
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(date);
    }

    function createCard(item) {
      const card = document.createElement("article");
      card.className = "news-card";
      const top = document.createElement("div");
      top.className = "news-card-top";

      const categoryLabel = document.createElement("span");
      categoryLabel.className = "news-category";
      categoryLabel.textContent = item.category || "General";
      const date = document.createElement("time");
      date.className = "news-date";
      const dateValue = item.published_at || item.created_at;
      date.textContent = formatDate(dateValue);
      if (dateValue && !Number.isNaN(new Date(dateValue).getTime())) {
        date.dateTime = new Date(dateValue).toISOString();
      }
      top.append(categoryLabel, date);

      const heading = document.createElement("h3");
      heading.textContent = item.title || "School announcement";
      const body = document.createElement("p");
      body.className = "news-body";
      body.textContent = item.body || "";
      card.append(top, heading, body);
      return card;
    }

    async function loadAnnouncements() {
      if (loading) return;
      loading = true;
      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading…";
      }
      countLabel.textContent = "Loading announcements…";

      try {
        const client = window.schoolSupabase;
        if (!client) throw new Error("Supabase configuration is unavailable.");

        let query = client
          .from("announcements")
          .select("id, title, body, category, published_at, created_at")
          .eq("is_published", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(previewMode ? 3 : 50);
        if (category) query = query.eq("category", category);

        const { data, error } = await query;
        if (error) throw error;

        container.replaceChildren();
        if (!data || data.length === 0) {
          countLabel.textContent = "0 announcements";
          showMessage("There are no published announcements at the moment. Please check back later.");
          return;
        }

        const fragment = document.createDocumentFragment();
        data.forEach((item) => fragment.appendChild(createCard(item)));
        container.appendChild(fragment);
        countLabel.textContent =
          `${data.length} published announcement${data.length === 1 ? "" : "s"}`;
      } catch (error) {
        console.error("Failed to load public announcements:", error);
        countLabel.textContent = "Updates unavailable";
        showMessage(
          "Please try again shortly. If the problem continues, contact the school administrator.",
          true
        );
      } finally {
        loading = false;
        if (refreshButton) {
          refreshButton.disabled = false;
          refreshButton.textContent = "Refresh updates";
        }
      }
    }

    if (refreshButton) refreshButton.addEventListener("click", loadAnnouncements);
    loadAnnouncements();
    return loadAnnouncements;
  }

  const refreshers = widgets.map(initializeWidget);
  window.schoolPublicAnnouncements = {
    refresh: () => Promise.all(refreshers.map((refresh) => refresh()))
  };
})();

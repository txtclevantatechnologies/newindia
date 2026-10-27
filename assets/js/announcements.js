
(() => {
  "use strict";

  const client = window.schoolSupabase;
  const form = document.getElementById("announcementForm");
  const list = document.getElementById("announcementList");
  const status = document.getElementById("announcementStatus");
  const saveButton = document.getElementById("saveAnnouncement");
  const cancelButton = document.getElementById("cancelAnnouncementEdit");
  const searchInput = document.getElementById("announcementSearch");
  const visibilityFilter = document.getElementById("announcementVisibilityFilter");

  if (!form || !list || !status || !saveButton || !cancelButton) {
    console.error("Announcement module: required dashboard elements are missing.");
    return;
  }

  if (!client) {
    status.textContent = "Supabase is not configured. Check config.js.";
    return;
  }

  const titleInput = document.getElementById("announcementTitle");
  const categoryInput = document.getElementById("announcementCategory");
  const bodyInput = document.getElementById("announcementBody");
  const publishedInput = document.getElementById("announcementPublished");

  let editingId = null;
  let busy = false;

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = `module-status ${type}`.trim();
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value;
    cancelButton.disabled = value;
    saveButton.textContent = value
      ? "Saving…"
      : editingId
        ? "Update announcement"
        : "Save announcement";
  }

  function resetForm() {
    form.reset();
    editingId = null;
    publishedInput.checked = false;
    saveButton.textContent = "Save announcement";
    cancelButton.hidden = true;
  }

  function addTextElement(parent, tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text ?? "";
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function createActionButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = className;
    button.addEventListener("click", onClick);
    return button;
  }

  function applyAnnouncementFilters() {
    const cards = [...list.querySelectorAll(".announcement-card")];
    const search = (searchInput?.value || "").trim().toLocaleLowerCase();
    const visibility = visibilityFilter?.value || "all";
    let visible = 0;

    cards.forEach((card) => {
      const matchesSearch = !search || card.dataset.search.includes(search);
      const matchesVisibility =
        visibility === "all" || card.dataset.visibility === visibility;
      card.hidden = !(matchesSearch && matchesVisibility);
      if (!card.hidden) visible += 1;
    });

    if (cards.length) {
      setStatus(`Showing ${visible} of ${cards.length} announcement${cards.length === 1 ? "" : "s"}.`);
    }
  }

  searchInput?.addEventListener("input", applyAnnouncementFilters);
  visibilityFilter?.addEventListener("change", applyAnnouncementFilters);

  async function loadAnnouncements() {
    list.replaceChildren();
    setStatus("Loading announcements…");

    let data;
    let error;
    try {
      ({ data, error } = await client
        .from("announcements")
        .select("id, title, body, category, is_published, published_at, created_at")
        .order("created_at", { ascending: false }));
    } catch (requestError) {
      console.error("Could not load announcements:", requestError);
      setStatus("Could not load announcements. Check your connection and permissions.", "error");
      return;
    }

    if (error) {
      console.error(error);
      setStatus("Could not load announcements. Check your admin permissions.", "error");
      return;
    }

    if (!data || data.length === 0) {
      setStatus("No announcements yet. Create your first announcement above.");
      return;
    }

    setStatus(`${data.length} announcement(s) loaded.`);

    for (const item of data) {
      const card = document.createElement("article");
      card.className = "announcement-card";
      card.dataset.visibility = item.is_published ? "published" : "draft";
      card.dataset.search = `${item.title} ${item.category} ${item.body}`.toLocaleLowerCase();

      const headingRow = document.createElement("div");
      headingRow.className = "announcement-heading";

      addTextElement(headingRow, "h3", item.title);
      addTextElement(
        headingRow,
        "span",
        item.is_published ? "Published" : "Draft",
        item.is_published ? "pill published" : "pill draft"
      );

      card.appendChild(headingRow);
      addTextElement(card, "p", `Category: ${item.category}`);
      addTextElement(card, "p", item.body, "announcement-body");

      const actions = document.createElement("div");
      actions.className = "announcement-actions";

      actions.appendChild(createActionButton("Edit", "action-button", () => {
        editingId = item.id;
        titleInput.value = item.title;
        categoryInput.value = item.category;
        bodyInput.value = item.body;
        publishedInput.checked = item.is_published;

        saveButton.textContent = "Update announcement";
        cancelButton.hidden = false;
        setStatus("Editing announcement. Make changes and save.");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        titleInput.focus();
      }));

      actions.appendChild(createActionButton(
        item.is_published ? "Unpublish" : "Publish",
        "action-button",
        async () => {
          if (busy) return;
          busy = true;
          try {
            const updates = {
              is_published: !item.is_published,
              published_at: item.is_published
                ? null
                : new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { data: updated, error: updateError } = await client
              .from("announcements")
              .update(updates)
              .eq("id", item.id)
              .select("id")
              .maybeSingle();
            if (updateError) throw updateError;
            if (!updated) throw new Error("No announcement was updated.");

            setStatus("Publication status updated.", "success");
            window.schoolDashboardRefreshCounts?.();
            await loadAnnouncements();
          } catch (updateError) {
            console.error("Could not change publication status:", updateError);
            setStatus("Could not change publication status.", "error");
          } finally {
            busy = false;
          }
        }
      ));

      actions.appendChild(createActionButton("Delete", "action-button danger", async () => {
        if (busy) return;

        const confirmed = window.confirm(
          `Delete "${item.title}" permanently?`
        );

        if (!confirmed) return;

        busy = true;

        try {
          const { data: deleted, error: deleteError } = await client
            .from("announcements")
            .delete()
            .eq("id", item.id)
            .select("id")
            .maybeSingle();
          if (deleteError) throw deleteError;
          if (!deleted) throw new Error("No announcement was deleted.");

          if (editingId === item.id) resetForm();
          setStatus("Announcement deleted.", "success");
          window.schoolDashboardRefreshCounts?.();
          await loadAnnouncements();
        } catch (deleteError) {
          console.error("Could not delete announcement:", deleteError);
          setStatus("Could not delete this announcement.", "error");
        } finally {
          busy = false;
        }
      }));

      card.appendChild(actions);
      list.appendChild(card);
    }

    applyAnnouncementFilters();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const title = titleInput.value.trim();
    const category = categoryInput.value.trim() || "General";
    const body = bodyInput.value.trim();
    const isPublished = publishedInput.checked;

    if (title.length < 3 || title.length > 200) {
      setStatus("Title must contain between 3 and 200 characters.", "error");
      titleInput.focus();
      return;
    }

    if (body.length < 1 || body.length > 10000) {
      setStatus("Announcement text must contain 1–10,000 characters.", "error");
      bodyInput.focus();
      return;
    }

    if (category.length > 80) {
      setStatus("Category must be 80 characters or fewer.", "error");
      categoryInput.focus();
      return;
    }

    const payload = {
      title,
      category,
      body,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    setBusy(true);
    setStatus(editingId ? "Updating announcement…" : "Creating announcement…");

    try {
      let result;
      if (editingId) {
        result = await client
          .from("announcements")
          .update(payload)
          .eq("id", editingId)
          .select("id")
          .maybeSingle();
      } else {
        result = await client
          .from("announcements")
          .insert(payload)
          .select("id")
          .single();
      }

      if (result.error) throw result.error;
      if (!result.data) throw new Error("No announcement was saved.");
      resetForm();
      setStatus("Announcement saved successfully.", "success");
      window.schoolDashboardRefreshCounts?.();
      await loadAnnouncements();
    } catch (saveError) {
      console.error("Could not save announcement:", saveError);
      setStatus("Save failed. Check your connection and administrator permissions.", "error");
    } finally {
      setBusy(false);
    }
  });

  cancelButton.addEventListener("click", () => {
    resetForm();
    setStatus("Editing cancelled.");
  });

  // Called only after the dashboard has verified administrator access.
  window.schoolAnnouncements = {
    refresh: loadAnnouncements
  };

  loadAnnouncements();
})();

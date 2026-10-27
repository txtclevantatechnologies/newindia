(() => {
  "use strict";

  const client = window.schoolSupabase;
  const form = document.getElementById("galleryForm");
  const fileInput = document.getElementById("galleryFile");
  const typeInput = document.getElementById("galleryType");
  const urlInput = document.getElementById("galleryVideoUrl");
  const status = document.getElementById("galleryStatus");
  const list = document.getElementById("adminGalleryList");
  const saveButton = document.getElementById("saveGalleryItem");
  const cancelButton = document.getElementById("cancelGalleryEdit");
  const searchInput = document.getElementById("gallerySearch");
  const visibilityFilter = document.getElementById("galleryVisibilityFilter");

  if (!form || !status || !list || !client) {
    console.error("Gallery module could not initialize.");
    if (status) status.textContent = "Gallery module could not initialize.";
    return;
  }

  let editingId = null;
  let existingItem = null;
  let busy = false;

  const bucket = "school-gallery";
  const table = "gallery_items";

  function message(text) {
    status.textContent = text;
  }

  function safeText(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value || "";
    if (className) element.className = className;
    return element;
  }

  function applyGalleryFilters() {
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
      message(`Showing ${visible} of ${cards.length} gallery item${cards.length === 1 ? "" : "s"}.`);
    }
  }

  searchInput?.addEventListener("input", applyGalleryFilters);
  visibilityFilter?.addEventListener("change", applyGalleryFilters);

  function validYouTubeEmbed(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      let id = "";

      if (["youtu.be", "www.youtu.be"].includes(url.hostname)) {
        id = url.pathname.split("/").filter(Boolean)[0] || "";
      } else if (
        [
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "youtube-nocookie.com",
          "www.youtube-nocookie.com"
        ].includes(url.hostname)
      ) {
        if (url.pathname === "/watch") {
          id = url.searchParams.get("v") || "";
        } else {
          const match = url.pathname.match(
            /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)/
          );
          id = match ? match[1] : "";
        }
      }

      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

      return {
        id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`
      };
    } catch {
      return null;
    }
  }

  function updateFileInput() {
    const type = typeInput.value;
    fileInput.value = "";
    urlInput.value = "";

    if (type === "image") {
      fileInput.accept = "image/jpeg,image/png,image/webp,image/gif";
      fileInput.disabled = false;
      urlInput.disabled = true;
    } else if (type === "video_file") {
      fileInput.accept = "video/mp4,video/webm";
      fileInput.disabled = false;
      urlInput.disabled = true;
    } else {
      fileInput.disabled = true;
      urlInput.disabled = false;
    }
  }

  typeInput.addEventListener("change", updateFileInput);
  updateFileInput();

  function validateFile(file, type) {
    if (!file) return "Choose a file to upload.";

    const allowed = type === "image"
      ? {
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
          "image/webp": [".webp"],
          "image/gif": [".gif"]
        }
      : {
          "video/mp4": [".mp4"],
          "video/webm": [".webm"]
        };

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed[file.type]?.includes(extension)) {
      return "This file type is not supported.";
    }

    if (file.size > 50 * 1024 * 1024) {
      return "Files must be 50 MB or smaller.";
    }

    return null;
  }

  async function uploadFile(file, type) {
    const validation = validateFile(file, type);
    if (validation) throw new Error(validation);

    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100);

    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    return {
      path
    };
  }

  async function loadItems() {
    list.replaceChildren();
    list.appendChild(safeText("p", "Loading gallery items…"));

    let data;
    let error;
    try {
      ({ data, error } = await client
        .from(table)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }));
    } catch (loadError) {
      console.error("Could not load gallery items:", loadError);
      list.replaceChildren(safeText("p", "Could not load gallery items. Check your connection and permissions."));
      return;
    }

    if (error) {
      console.error(error);
      list.replaceChildren();
      list.appendChild(
        safeText("p", "Could not load gallery items. Check database policies.")
      );
      return;
    }

    list.replaceChildren();

    if (!data || data.length === 0) {
      list.appendChild(safeText("p", "No gallery items have been added yet."));
      return;
    }

    for (const item of data) {
      const card = document.createElement("article");
      card.className = "announcement-card";
      card.dataset.visibility = item.is_published ? "published" : "draft";
      card.dataset.search = `${item.title || ""} ${item.category || ""}`.toLocaleLowerCase();

      const heading = document.createElement("div");
      heading.className = "announcement-heading";

      heading.appendChild(safeText("strong", item.title || "Untitled media"));
      heading.appendChild(
        safeText(
          "span",
          item.is_published ? "Published" : "Draft",
          `pill ${item.is_published ? "published" : "draft"}`
        )
      );

      const category = safeText("p", `Category: ${item.category || "Other"}`);
      const mediaType = safeText("p", `Type: ${item.media_type || "image"}`);

      card.append(heading, category, mediaType);

      if (item.media_type === "image" && (item.storage_path || item.image_url)) {
        const image = document.createElement("img");
        image.alt = item.alt_text || item.title || "School gallery image";
        image.loading = "lazy";
        image.style.cssText =
          "max-width:220px;width:100%;height:auto;border-radius:10px;";
        if (item.storage_path) {
          try {
            const { data: signedData, error: signedError } = await client.storage
              .from(bucket)
              .createSignedUrl(item.storage_path, 3600);
            if (signedError) throw signedError;
            image.src = signedData.signedUrl;
          } catch (signedError) {
            console.error("Could not create an admin preview URL:", signedError);
          }
        } else {
          try {
            const imageUrl = new URL(item.image_url);
            if (imageUrl.protocol === "https:") image.src = imageUrl.href;
          } catch {
            console.error("Skipping invalid gallery image URL.");
          }
        }
        card.appendChild(image);
      }

      if (
        ["video_file", "youtube"].includes(item.media_type) &&
        (item.storage_path || item.image_url)
      ) {
        const link = document.createElement("a");
        let previewReady = true;
        if (item.storage_path) {
          try {
            const { data: signedData, error: signedError } = await client.storage
              .from(bucket)
              .createSignedUrl(item.storage_path, 3600);
            if (signedError) throw signedError;
            link.href = signedData.signedUrl;
          } catch (signedError) {
            console.error("Could not create an admin preview URL:", signedError);
            previewReady = false;
          }
        } else {
          const youtube = validYouTubeEmbed(item.image_url);
          if (item.media_type === "youtube" && youtube) {
            link.href = youtube.embedUrl;
          } else if (item.media_type === "video_file") {
            try {
              const videoUrl = new URL(item.image_url);
              if (videoUrl.protocol === "https:") link.href = videoUrl.href;
              else previewReady = false;
            } catch {
              previewReady = false;
            }
          } else {
            previewReady = false;
          }
        }
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = previewReady ? "Open video" : "Video preview unavailable";
        card.appendChild(link);
      }

      const actions = document.createElement("div");
      actions.className = "announcement-actions";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = item.is_published ? "Unpublish" : "Publish";
      toggle.addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        toggle.disabled = true;
        try {
          const { data: updated, error: updateError } = await client
            .from(table)
            .update({ is_published: !item.is_published })
            .eq("id", item.id)
            .select("id")
            .maybeSingle();
          if (updateError) throw updateError;
          if (!updated) throw new Error("No gallery item was updated.");
          message("Gallery publication status updated.");
          window.schoolDashboardRefreshCounts?.();
          await loadItems();
        } catch (updateError) {
          console.error("Could not update gallery publication:", updateError);
          message(`Could not update item: ${updateError.message || "request failed"}`);
        } finally {
          busy = false;
          toggle.disabled = false;
        }
      });

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit details";
      edit.addEventListener("click", () => beginEdit(item));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!confirm(`Delete "${item.title}" from the gallery?`)) return;

        remove.disabled = true;

        try {
          if (item.storage_path) {
            const { error: storageError } = await client.storage
              .from(bucket)
              .remove([item.storage_path]);

            if (storageError) throw new Error(`Media could not be removed; the gallery record was kept. ${storageError.message}`);
          }

          const { data: deleted, error: deleteError } = await client
            .from(table)
            .delete()
            .eq("id", item.id)
            .select("id")
            .maybeSingle();
          if (deleteError) {
            throw new Error(`Media was removed, but the gallery record could not be deleted. Retry deleting this record. ${deleteError.message}`);
          }
          if (!deleted) throw new Error("Media was removed, but no gallery record was deleted.");

          message("Gallery item deleted.");
          window.schoolDashboardRefreshCounts?.();
          await loadItems();
        } catch (error) {
          message(`Delete failed: ${error.message}`);
        } finally {
          remove.disabled = false;
        }
      });

      actions.append(toggle, edit, remove);
      card.appendChild(actions);
      list.appendChild(card);
    }

    applyGalleryFilters();
  }

  function beginEdit(item) {
    editingId = item.id;
    existingItem = item;

    document.getElementById("galleryTitle").value = item.title || "";
    document.getElementById("galleryCategory").value =
      item.category || "Other";
    document.getElementById("galleryAlt").value = item.alt_text || "";
    document.getElementById("gallerySortOrder").value = item.sort_order ?? 0;
    document.getElementById("galleryPublished").checked =
      Boolean(item.is_published);

    typeInput.value = item.media_type || "image";
    updateFileInput();

    urlInput.value =
      item.media_type === "youtube" ? item.image_url || "" : "";

    cancelButton.hidden = false;
    saveButton.textContent = "Save changes";

    message(
      "Editing details. Select a new file only if you intend to replace the current media."
    );

    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    form.reset();
    editingId = null;
    existingItem = null;
    cancelButton.hidden = true;
    saveButton.textContent = "Upload & Save";
    updateFileInput();
  }

  cancelButton.addEventListener("click", () => {
    resetForm();
    message("Edit cancelled.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    busy = true;
    saveButton.disabled = true;

    let uploadedPath = null;
    let uploadCleanupFailed = false;
    let recordSaved = false;
    let oldMediaCleanupFailed = false;

    try {
      const title = document.getElementById("galleryTitle").value.trim();
      const category = document.getElementById("galleryCategory").value;
      const altText = document.getElementById("galleryAlt").value.trim();
      const sortOrderInput = document.getElementById("gallerySortOrder");
      const published =
        document.getElementById("galleryPublished").checked;
      const type = typeInput.value;
      const sortOrder = sortOrderInput.valueAsNumber;

      if (title.length < 2 || title.length > 200) {
        throw new Error("The title must contain 2–200 characters.");
      }

      if (altText.length > 250) {
        throw new Error("The image description is too long.");
      }

      if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100000) {
        throw new Error("Display order must be a whole number between -100000 and 100000.");
      }

      const payload = {
        title,
        category,
        alt_text: altText,
        is_published: published,
        media_type: type,
        sort_order: sortOrder
      };

      const selectedFile = fileInput.files[0];

      if (type === "youtube") {
        const youtube = validYouTubeEmbed(urlInput.value.trim());

        if (!youtube) {
          throw new Error("Enter a valid YouTube video URL.");
        }

        payload.image_url = youtube.embedUrl;
        payload.storage_path = null;
      } else if (selectedFile) {
        message("Uploading media…");

        const uploaded = await uploadFile(selectedFile, type);
        uploadedPath = uploaded.path;

        payload.image_url = null;
        payload.storage_path = uploaded.path;
      } else if (editingId && existingItem) {
        if (type !== existingItem.media_type) {
          throw new Error("Choose replacement media when changing the media type.");
        }
        payload.image_url = existingItem.image_url;
        payload.storage_path = existingItem.storage_path;
      } else {
        throw new Error("Select a file to upload.");
      }

      if (type === "image" && !altText) {
        throw new Error("Add an image description before saving.");
      }

      let result;

      if (editingId) {
        result = await client
          .from(table)
          .update(payload)
          .eq("id", editingId)
          .select("id")
          .maybeSingle();
      } else {
        result = await client.from(table).insert(payload).select("id").single();
      }

      if (result.error) throw result.error;
      if (!result.data) throw new Error("No gallery item was saved.");
      recordSaved = true;

      // Remove replaced storage media only after the database update succeeds.
      if (
        editingId &&
        existingItem?.storage_path &&
        existingItem.storage_path !== payload.storage_path
      ) {
        try {
          const { error: cleanupError } = await client.storage
            .from(bucket)
            .remove([existingItem.storage_path]);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          console.error("Old media cleanup failed:", cleanupError);
          oldMediaCleanupFailed = true;
        }
      }

      resetForm();
      message(oldMediaCleanupFailed
        ? "Gallery item saved, but old media could not be removed from storage."
        : "Gallery item saved successfully.");
      window.schoolDashboardRefreshCounts?.();
      await loadItems();
    } catch (error) {
      console.error(error);

      // Avoid leaving a newly uploaded file behind if saving its record fails.
      if (uploadedPath && !recordSaved) {
        try {
          const { error: cleanupError } = await client.storage
            .from(bucket)
            .remove([uploadedPath]);
          if (cleanupError) {
            console.error("Upload cleanup failed:", cleanupError);
            uploadCleanupFailed = true;
          }
        } catch (cleanupError) {
          console.error("Upload cleanup failed:", cleanupError);
          uploadCleanupFailed = true;
        }
      }

      message(uploadCleanupFailed
        ? "Save failed, and the uploaded file could not be cleaned up. Contact an administrator."
        : error.message || "Unable to save the gallery item.");
    } finally {
      busy = false;
      saveButton.disabled = false;
    }
  });

  window.schoolGalleryAdmin = {
    refresh: loadItems
  };

  loadItems();
})();

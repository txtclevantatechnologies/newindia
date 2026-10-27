(() => {
  "use strict";

  const gallery = document.getElementById("publicGallery");
  const status = document.getElementById("galleryStatus") ||
    document.getElementById("homeGalleryStatus");
  const filters = document.getElementById("galleryFilters");
  const refresh = document.getElementById("refreshGallery");
  const searchInput = document.getElementById("gallerySearch");
  const sortSelect = document.getElementById("gallerySort");
  const previewMode = gallery?.hasAttribute("data-gallery-preview");
  const dialog = document.getElementById("galleryLightbox");
  const lightboxMedia = document.getElementById("lightboxMedia");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const closeButton = document.getElementById("lightboxClose");
  const previousButton = document.getElementById("lightboxPrevious");
  const nextButton = document.getElementById("lightboxNext");

  if (!gallery || !status) return;

  let items = [];
  let selectedCategory = "All";
  let activeIndex = 0;
  let loading = false;
  let sortMode = "order";
  let publishedCount = 0;
  let failedCount = 0;

  function galleryStatus(visibleCount) {
    const itemLabel = publishedCount === 1 ? "item" : "items";
    const summary = `Showing ${visibleCount} of ${publishedCount} published ${itemLabel}`;
    return failedCount
      ? `${summary}; ${failedCount} could not be loaded.`
      : summary;
  }

  function showState(text, isError = false) {
    gallery.replaceChildren();
    const state = document.createElement("p");
    state.className = isError ? "news-empty news-error" : "news-empty";
    state.setAttribute("role", "status");
    state.textContent = text;
    gallery.appendChild(state);
  }

  function parseYouTubeVideoId(value) {
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
          const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)/);
          id = match?.[1] || "";
        }
      }

      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  function makeYouTubePlayer(item, videoId) {
    const playerUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    playerUrl.searchParams.set("playsinline", "1");
    playerUrl.searchParams.set("rel", "0");
    playerUrl.searchParams.set("origin", window.location.origin);
    playerUrl.searchParams.set("widget_referrer", window.location.origin);

    const iframe = document.createElement("iframe");
    iframe.src = playerUrl.href;
    iframe.title = `YouTube video: ${item.title}`;
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;

    return iframe;
  }

  async function resolveMedia(item) {
    if (item.media_type === "youtube") {
      const videoId = parseYouTubeVideoId(item.image_url);
      if (!videoId) throw new Error(`Invalid YouTube URL for ${item.title}.`);
      return {
        ...item,
        media_url: `https://www.youtube.com/embed/${videoId}`,
        youtube_video_id: videoId
      };
    }

    if (!item.storage_path) throw new Error(`Media path missing for ${item.title}.`);
    const { data, error } = await window.schoolSupabase.storage
      .from("school-gallery")
      .createSignedUrl(item.storage_path, 3600);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error(`Could not create media link for ${item.title}.`);
    return { ...item, media_url: data.signedUrl };
  }

  function activeItems() {
    const search = (searchInput?.value || "").trim().toLocaleLowerCase();
    const categoryItems = selectedCategory === "All"
      ? [...items]
      : items.filter((item) => item.category === selectedCategory);
    const searchedItems = search
      ? categoryItems.filter((item) =>
          `${item.title} ${item.category} ${item.alt_text || ""}`
            .toLocaleLowerCase()
            .includes(search)
        )
      : categoryItems;

    if (sortMode === "newest") {
      searchedItems.sort((left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );
    } else if (sortMode === "title") {
      searchedItems.sort((left, right) =>
        left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
      );
    }

    return previewMode ? searchedItems.slice(0, 3) : searchedItems;
  }

  function renderMedia(item, target, inLightbox = false) {
    if (item.media_type === "youtube") {
      if (inLightbox) {
        const videoId = item.youtube_video_id || parseYouTubeVideoId(item.media_url);
        if (!videoId) throw new Error(`Invalid YouTube video link for ${item.title}.`);

        const frame = document.createElement("div");
        frame.className = "gallery-video-frame";
        frame.appendChild(makeYouTubePlayer(item, videoId));

        const fallback = document.createElement("a");
        fallback.className = "gallery-video-fallback";
        fallback.href = `https://www.youtube.com/watch?v=${videoId}`;
        fallback.target = "_blank";
        fallback.rel = "noopener noreferrer";
        fallback.textContent = "Player not loading? Watch on YouTube";
        frame.appendChild(fallback);

        target.appendChild(frame);
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-media-button gallery-video-open";
        button.setAttribute("aria-label", previewMode ? `Open gallery for ${item.title}` : `Play video: ${item.title}`);
        const videoId = parseYouTubeVideoId(item.media_url);
        if (videoId) {
          const thumbnail = document.createElement("img");
          thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          thumbnail.alt = "";
          thumbnail.loading = "lazy";
          thumbnail.decoding = "async";
          thumbnail.addEventListener("error", () => thumbnail.remove(), { once: true });
          button.appendChild(thumbnail);
        }
        const playIcon = document.createElement("span");
        playIcon.className = "gallery-play-icon";
        playIcon.setAttribute("aria-hidden", "true");
        playIcon.textContent = "▶";
        button.appendChild(playIcon);
        const label = document.createElement("span");
        label.className = "gallery-video-label";
        label.textContent = previewMode ? "View gallery" : "Watch video";
        button.appendChild(label);
        button.addEventListener("click", () => {
          if (previewMode) {
            window.location.href = "gallery.html";
          } else {
            openLightbox(activeItems().indexOf(item));
          }
        });
        target.appendChild(button);
      }
      return;
    }

    if (item.media_type === "video_file") {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = inLightbox ? "metadata" : "none";
      video.setAttribute("aria-label", item.title);

      const source = document.createElement("source");
      source.src = item.media_url;
      const extension = item.storage_path
        ?.split("?")[0]
        .split(".")
        .pop()
        .toLowerCase();
      const mimeType = {
        mp4: "video/mp4",
        webm: "video/webm"
      }[extension];
      if (mimeType) source.type = mimeType;
      video.appendChild(source);

      const playbackError = document.createElement("div");
      playbackError.className = "video-playback-error";
      playbackError.hidden = true;
      playbackError.setAttribute("role", "status");
      playbackError.id = `video-playback-error-${item.id}`;
      video.setAttribute("aria-describedby", playbackError.id);

      const errorMessage = document.createElement("p");
      errorMessage.textContent =
        "This video could not be played here. The file may use an unsupported codec or format.";
      const fallbackLink = document.createElement("a");
      fallbackLink.href = item.media_url;
      fallbackLink.target = "_blank";
      fallbackLink.rel = "noopener noreferrer";
      fallbackLink.textContent = "Open video in a new tab";
      playbackError.append(errorMessage, fallbackLink);

      video.addEventListener("error", () => {
        playbackError.hidden = false;
      });

      const mediaContainer = document.createElement("div");
      mediaContainer.className = "gallery-video-file";
      mediaContainer.append(video, playbackError);
      target.appendChild(mediaContainer);
      return;
    }

    const image = document.createElement("img");
    image.src = item.media_url;
    image.alt = item.alt_text || item.title;
    image.loading = "lazy";
    image.decoding = "async";
    if (inLightbox || previewMode) {
      target.appendChild(image);
    } else {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-media-button";
      button.setAttribute("aria-label", `View image: ${item.title}`);
      button.appendChild(image);
      button.addEventListener("click", () => openLightbox(activeItems().indexOf(item)));
      target.appendChild(button);
    }
  }

  function render() {
    const visibleItems = activeItems();
    gallery.replaceChildren();
    gallery.classList.toggle("gallery-preview-grid", Boolean(previewMode));

    if (visibleItems.length === 0) {
      showState(items.length
        ? "No gallery items match your search and category filters."
        : failedCount
          ? "Published gallery media could not be loaded. Please try again later."
          : "There are no published gallery items yet. Please check back soon.");
      if (!previewMode) {
        status.textContent = galleryStatus(0);
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "gallery-card";
      const media = document.createElement("div");
      media.className = "gallery-media";
      renderMedia(item, media);

      const copy = document.createElement("div");
      copy.className = "gallery-card-copy";
      const title = document.createElement("h3");
      title.textContent = item.title;
      const category = document.createElement("p");
      category.textContent = item.category || "Other";
      copy.append(title, category);
      card.append(media, copy);
      fragment.appendChild(card);
    });
    gallery.appendChild(fragment);
    if (!previewMode) {
      status.textContent = galleryStatus(visibleItems.length);
    }
  }

  function renderFilters() {
    if (!filters || previewMode) return;
    filters.replaceChildren();
    const categories = ["All", ...new Set(items.map((item) => item.category || "Other"))];
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-filter";
      button.textContent = category;
      button.setAttribute("aria-pressed", String(category === selectedCategory));
      button.addEventListener("click", () => {
        selectedCategory = category;
        renderFilters();
        render();
      });
      filters.appendChild(button);
    });
  }

  function openLightbox(index) {
    if (!dialog || !lightboxMedia || !items.length) return;
    const visibleItems = activeItems();
    activeIndex = (index + visibleItems.length) % visibleItems.length;
    const item = visibleItems[activeIndex];
    lightboxCaption.textContent =
      `${item.title} · ${item.category || "Other"} · ${activeIndex + 1} of ${visibleItems.length}`;
    lightboxMedia.replaceChildren();
    renderMedia(item, lightboxMedia, true);
    previousButton.disabled = visibleItems.length < 2;
    nextButton.disabled = visibleItems.length < 2;
    if (!dialog.open) dialog.showModal();
  }

  function updateGallery() {
    renderFilters();
    render();
  }

  function moveLightbox(direction) {
    if (!activeItems().length) return;
    openLightbox(activeIndex + direction);
  }

  async function loadGallery() {
    if (loading) return;
    loading = true;
    if (refresh) {
      refresh.disabled = true;
      refresh.textContent = "Loading…";
    }
    status.textContent = "Loading published gallery items…";
    showState("Loading approved photos and videos…");

    try {
      const client = window.schoolSupabase;
      if (!client) throw new Error("Supabase configuration is unavailable.");
      const { data, error } = await client
        .from("gallery_items")
        .select("id, media_type, storage_path, title, image_url, alt_text, category, sort_order, created_at")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      publishedCount = (data || []).length;
      const resolved = await Promise.all((data || []).map(async (item) => {
        try {
          return await resolveMedia(item);
        } catch (error) {
          console.error(`Could not prepare gallery media "${item.title}":`, error);
          return null;
        }
      }));
      items = resolved.filter(Boolean);
      failedCount = publishedCount - items.length;
      selectedCategory = "All";
      updateGallery();
    } catch (error) {
      console.error("Could not load the public gallery:", error);
      publishedCount = 0;
      failedCount = 0;
      status.textContent = "Gallery unavailable";
      showState("Gallery media could not be loaded. Please try again later.", true);
    } finally {
      loading = false;
      if (refresh) {
        refresh.disabled = false;
        refresh.textContent = "Refresh gallery";
      }
    }
  }

  if (closeButton) closeButton.addEventListener("click", () => dialog.close());
  if (previousButton) previousButton.addEventListener("click", () => moveLightbox(-1));
  if (nextButton) nextButton.addEventListener("click", () => moveLightbox(1));
  if (dialog) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => lightboxMedia?.replaceChildren());
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    });
  }
  if (refresh) refresh.addEventListener("click", loadGallery);
  if (searchInput) searchInput.addEventListener("input", render);
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      sortMode = sortSelect.value;
      render();
    });
  }

  window.schoolPublicGallery = { refresh: loadGallery };
  loadGallery();
})();

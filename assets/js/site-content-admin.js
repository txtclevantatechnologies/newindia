(() => {
  "use strict";

  const client = window.schoolSupabase;
  const form = document.getElementById("siteContentForm");
  const fieldsContainer = document.getElementById("siteContentFields");
  const status = document.getElementById("siteContentStatus");
  const saveButton = document.getElementById("saveSiteContent");
  const searchInput = document.getElementById("siteContentSearch");
  const pageFilter = document.getElementById("siteContentPage");
  const summary = document.getElementById("siteContentSummary");
  const logoInput = document.getElementById("siteLogoFile");
  const uploadLogoButton = document.getElementById("uploadSiteLogo");
  const resetLogoButton = document.getElementById("resetSiteLogo");
  const logoPreview = document.getElementById("siteLogoPreview");
  const logoStatus = document.getElementById("siteLogoStatus");

  if (!client || !form || !fieldsContainer || !status || !saveButton || !searchInput || !pageFilter || !summary ||
      !logoInput || !uploadLogoButton || !resetLogoButton || !logoPreview || !logoStatus) {
    console.error("Site content manager could not initialize.");
    if (status) status.textContent = "Site content manager could not initialize.";
    return;
  }

  const fields = [
    ["home.hero_title", "Homepage hero title"],
    ["home.hero_subtitle", "Homepage hero subtitle"],
    ["home.hero_description", "Homepage hero description"],
    ["home.intro_title", "Homepage welcome heading"],
    ["home.intro_description", "Homepage welcome text"],
    ["home.feature_education_title", "Education feature heading"],
    ["home.feature_education_description", "Education feature text"],
    ["home.feature_development_title", "Development feature heading"],
    ["home.feature_development_description", "Development feature text"],
    ["home.feature_future_title", "Future-readiness feature heading"],
    ["home.feature_future_description", "Future-readiness feature text"],
    ["home.news_title", "Homepage news heading"],
    ["home.news_description", "Homepage news introduction"],
    ["home.achievements_title", "Homepage achievements heading"],
    ["home.achievements_description", "Homepage achievements introduction"],
    ["home.gallery_title", "Homepage gallery heading"],
    ["home.gallery_description", "Homepage gallery introduction"],
    ["home.cta_title", "Homepage admissions call-to-action heading"],
    ["home.cta_description", "Homepage admissions call-to-action text"],
    ["home.discover_button", "Homepage discover button label"],
    ["home.admissions_button", "Homepage admissions button label"],
    ["home.cta_button", "Homepage final admissions button label"],
    ["about.intro", "About page introduction"],
    ["about.title", "About page heading"],
    ["about.approach_title", "About page section heading"],
    ["about.approach_description", "About page section text"],
    ["about.card_knowledge_title", "About knowledge card heading"],
    ["about.card_knowledge_description", "About knowledge card text"],
    ["about.card_character_title", "About character card heading"],
    ["about.card_character_description", "About character card text"],
    ["about.card_potential_title", "About potential card heading"],
    ["about.card_potential_description", "About potential card text"],
    ["about.history_title", "About history section heading"],
    ["about.history", "Verified school history"],
    ["about.leadership", "Approved leadership information"],
    ["academics.intro", "Academics page introduction"],
    ["academics.title", "Academics page heading"],
    ["academics.principles_title", "Academics principles heading"],
    ["academics.approach_title", "Academics approach heading"],
    ["academics.approach_description", "Academics approach text"],
    ["academics.foundation_title", "Foundations card heading"],
    ["academics.foundation_description", "Foundations card text"],
    ["academics.curiosity_title", "Curiosity card heading"],
    ["academics.curiosity_description", "Curiosity card text"],
    ["academics.progress_title", "Progress card heading"],
    ["academics.progress_description", "Progress card text"],
    ["academics.details_title", "Academic details heading"],
    ["academics.details", "Approved academic programme details"],
    ["facilities.intro", "Facilities page introduction"],
    ["facilities.title", "Facilities page heading"],
    ["facilities.environment_title", "Facilities section heading"],
    ["facilities.environment_description", "Facilities section text"],
    ["facilities.classrooms", "Confirmed classrooms information"],
    ["facilities.library", "Confirmed library information"],
    ["facilities.laboratories", "Confirmed laboratories information"],
    ["facilities.playground", "Confirmed playground information"],
    ["facilities.transport", "Confirmed transport information"],
    ["facilities.other", "Other confirmed facilities"],
    ["achievements.intro", "Achievements page introduction"],
    ["achievements.title", "Achievements page heading"],
    ["achievements.list_title", "Achievements list heading"],
    ["admissions.intro", "Admissions page introduction"],
    ["admissions.title", "Admissions page heading"],
    ["admissions.method_title", "Admissions instructions heading"],
    ["admissions.method_description", "Admissions instructions text"],
    ["admissions.privacy_title", "Admissions privacy heading"],
    ["admissions.privacy_description", "Admissions privacy text"],
    ["admissions.form_title", "Admissions form heading"],
    ["admissions.details", "Approved admissions procedures and fees"],
    ["admissions.fees", "Approved fee information"],
    ["contact.intro", "Contact page introduction"],
    ["contact.title", "Contact page heading"],
    ["contact.location_title", "Contact location heading"],
    ["contact.location_description", "Contact location text"],
    ["contact.details_title", "Verified contact details heading"],
    ["contact.admissions_title", "Admissions information heading"],
    ["contact.admissions_description", "Admissions information text"],
    ["contact.form_title", "Contact form heading"],
    ["contact.address", "Verified postal address"],
    ["contact.phone", "Verified telephone number"],
    ["contact.email", "Verified school email address"],
    ["contact.office_hours", "Verified office hours"],
    ["gallery.title", "Gallery page heading"],
    ["gallery.description", "Gallery page introduction"],
    ["news.title", "News page heading"],
    ["news.description", "News page introduction"],
    ["news.list_title", "News list heading"],
    ["footer.text", "Footer text"],
    ["branding.school_name", "School name shown in website branding"],
    ["branding.tagline", "Website brand tagline"],
    ["settings.site_description", "Default search and sharing description"],
    ["settings.theme_color", "Website accent color"]
  ];

  const pageTitles = {
    home: "Home",
    about: "About",
    academics: "Academics",
    facilities: "Facilities",
    achievements: "Achievements",
    admissions: "Admissions",
    contact: "Contact",
    gallery: "Gallery",
    news: "News",
    footer: "Footer",
    branding: "Branding",
    settings: "Site settings"
  };
  let savedContent = new Map();
  let pendingLogoPath = "";
  const defaultLogo = "../assets/images/school-logo.png";
  const logoExtensions = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
  };

  function setStatus(text, type = "") {
    status.textContent = text;
    status.className = `module-status ${type}`.trim();
  }

  function setLogoStatus(text, type = "") {
    logoStatus.textContent = text;
    logoStatus.className = `module-status ${type}`.trim();
  }

  function getLogoPublicUrl(path) {
    if (!/^logo\/[A-Za-z0-9._-]+\.(png|jpg|webp)$/i.test(path) || path.includes("..")) {
      throw new Error("The saved logo path is invalid. Upload the logo again.");
    }
    const { data } = client.storage.from("school-branding").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not create the logo preview URL.");
    return data.publicUrl;
  }

  async function validateLogoFile(file) {
    const extension = logoExtensions[file.type];
    if (!extension || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new Error("Choose a PNG, JPEG, or WebP logo up to 5 MB.");
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png = bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
    const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

    if (!(file.type === "image/png" && png) &&
        !(file.type === "image/jpeg" && jpeg) &&
        !(file.type === "image/webp" && webp)) {
      throw new Error("The selected file contents do not match a supported image format.");
    }

    return extension;
  }

  async function uploadLogo() {
    const file = logoInput.files?.[0];
    if (!file) {
      setLogoStatus("Choose a logo image before uploading.", "error");
      return;
    }

    uploadLogoButton.disabled = true;
    setLogoStatus("Validating and uploading logo…");

    try {
      const extension = await validateLogoFile(file);
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Sign in again.");

      const path = `logo/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error } = await client.storage
        .from("school-branding")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      pendingLogoPath = path;
      logoPreview.src = getLogoPublicUrl(path);
      setLogoStatus("Logo uploaded. Save website content below to publish it.", "success");
    } catch (error) {
      console.error("Could not upload school logo:", error);
      setLogoStatus(error.message || "Could not upload the school logo.", "error");
    } finally {
      uploadLogoButton.disabled = false;
    }
  }

  function renderFields() {
    fieldsContainer.replaceChildren();
    const groups = new Map();

    fields.forEach(([key, labelText]) => {
      const pageKey = key.split(".", 1)[0];
      let group = groups.get(pageKey);
      if (!group) {
        group = document.createElement("section");
        group.className = "site-content-page-group";
        group.dataset.page = pageKey;
        const heading = document.createElement("h3");
        heading.textContent = pageTitles[pageKey];
        const groupFields = document.createElement("div");
        groupFields.className = "site-content-page-fields";
        group.append(heading, groupFields);
        groups.set(pageKey, group);
      }

      const wrapper = document.createElement("section");
      wrapper.className = "site-content-field";
      wrapper.dataset.search = `${key} ${labelText}`.toLocaleLowerCase();

      const label = document.createElement("label");
      const inputId = `siteContent-${key.replaceAll(".", "-")}`;
      label.htmlFor = inputId;
      label.textContent = labelText;

      const fieldInput = key === "settings.theme_color"
        ? document.createElement("input")
        : document.createElement("textarea");
      fieldInput.id = inputId;
      fieldInput.name = key;
      fieldInput.maxLength = 10000;
      if (key === "settings.theme_color") {
        fieldInput.type = "color";
        const savedColor = savedContent.get(key)?.content || "#2563EB";
        fieldInput.value = /^#[0-9a-f]{6}$/i.test(savedColor) ? savedColor : "#2563EB";
      } else {
        fieldInput.rows = 3;
        fieldInput.value = savedContent.get(key)?.content || "";
      }

      const characterCount = document.createElement("output");
      characterCount.className = "site-content-character-count";
      characterCount.htmlFor = inputId;
      const updateCharacterCount = () => {
        characterCount.textContent = `${fieldInput.value.length.toLocaleString()} / 10,000 characters`;
      };
      updateCharacterCount();
      fieldInput.addEventListener("input", () => {
        updateCharacterCount();
      });

      const publishLabel = document.createElement("label");
      publishLabel.className = "publish-option";
      const publish = document.createElement("input");
      publish.type = "checkbox";
      publish.name = `${key}__published`;
      publish.checked = Boolean(savedContent.get(key)?.is_published);
      publish.addEventListener("change", updateSummary);
      publishLabel.append(publish, document.createTextNode(" Publish this content on the public website"));

      wrapper.append(label, fieldInput, characterCount, publishLabel);
      group.querySelector(".site-content-page-fields").appendChild(wrapper);
    });

    const noResults = document.createElement("p");
    noResults.className = "site-content-no-results";
    noResults.textContent = "No content fields match these filters.";
    noResults.hidden = true;
    fieldsContainer.append(...groups.values(), noResults);
    filterFields();
  }

  function filterFields() {
    if (!fieldsContainer.childElementCount) return;
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedPage = pageFilter.value;
    let visibleCount = 0;

    fieldsContainer.querySelectorAll(".site-content-page-group").forEach((group) => {
      const pageMatches = selectedPage === "all" || group.dataset.page === selectedPage;
      let groupVisibleCount = 0;
      group.querySelectorAll(".site-content-field").forEach((field) => {
        const fieldInput = field.querySelector("textarea, input");
        const matches = pageMatches &&
          `${field.dataset.search} ${fieldInput.value}`.toLocaleLowerCase().includes(query);
        field.hidden = !matches;
        if (matches) groupVisibleCount += 1;
      });
      group.hidden = groupVisibleCount === 0;
      visibleCount += groupVisibleCount;
    });

    const noResults = fieldsContainer.querySelector(".site-content-no-results");
    if (noResults) noResults.hidden = visibleCount > 0;
    updateSummary(visibleCount);
  }

  function updateSummary(visibleCount = fieldsContainer.querySelectorAll(".site-content-field:not([hidden])").length) {
    const publishedCount = [...fieldsContainer.querySelectorAll(".publish-option input:checked")].length;
    summary.textContent = `Showing ${visibleCount} of ${fields.length} fields · ${publishedCount} marked for publication`;
  }

  searchInput.addEventListener("input", filterFields);
  pageFilter.addEventListener("change", filterFields);
  uploadLogoButton.addEventListener("click", uploadLogo);
  resetLogoButton.addEventListener("click", () => {
    pendingLogoPath = "";
    logoInput.value = "";
    logoPreview.src = defaultLogo;
    setLogoStatus("The default logo will be restored when you save website content.");
  });

  async function loadContent() {
    setStatus("Loading editable content…");
    const { data, error } = await client
      .from("site_content")
      .select("content_key, content, is_published")
      .in("content_key", [...fields.map(([key]) => key), "branding.logo_path"]);

    if (error) {
      console.error("Could not load editable site content:", error);
      setStatus("Could not load content. Check administrator database permissions.", "error");
      throw error;
    }

    savedContent = new Map((data || []).map((item) => [item.content_key, item]));
    pendingLogoPath = savedContent.get("branding.logo_path")?.content || "";
    if (pendingLogoPath) {
      try {
        logoPreview.src = getLogoPublicUrl(pendingLogoPath);
        setLogoStatus("Current uploaded logo is published.", "success");
      } catch (error) {
        console.error("Could not load the saved school logo:", error);
        logoPreview.src = defaultLogo;
        setLogoStatus(error.message, "error");
      }
    } else {
      logoPreview.src = defaultLogo;
      setLogoStatus("Using the default website logo.");
    }
    renderFields();
    setStatus("Content loaded. Unchecked items remain unpublished.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    setStatus("Saving content…");

    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Your session has expired. Sign in again.");

      const rows = fields.map(([key]) => {
        const content = form.elements.namedItem(key).value.trim();
        const isPublished = form.elements.namedItem(`${key}__published`).checked;
        if (content.length > 10000) {
          throw new Error(`${key} exceeds the 10,000 character limit.`);
        }
        if (key === "settings.theme_color" && !/^#[0-9a-f]{6}$/i.test(content)) {
          throw new Error("Choose a valid six-digit hex accent color.");
        }
        return {
          content_key: key,
          content,
          is_published: isPublished,
          updated_by: user.id
        };
      });
      rows.push({
        content_key: "branding.logo_path",
        content: pendingLogoPath,
        is_published: true,
        updated_by: user.id
      });

      const { data: savedRows, error } = await client
        .from("site_content")
        .upsert(rows, { onConflict: "content_key" })
        .select("content_key");
      if (error) throw error;
      if (savedRows?.length !== rows.length) {
        throw new Error("Not all website content rows were saved.");
      }

      window.schoolDashboardRefreshCounts?.();
      await loadContent();
      setStatus("Website content saved.", "success");
    } catch (error) {
      console.error("Could not save website content:", error);
      setStatus(error.message || "Could not save website content.", "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  loadContent().catch((error) => {
    console.error("Could not load editable site content:", error);
    setStatus("Could not load content. Refresh and try again.", "error");
  });
})();

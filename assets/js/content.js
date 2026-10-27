(() => {
  "use strict";

  const year = document.getElementById("currentYear");
  if (year) year.textContent = String(new Date().getFullYear());

  const placeholders = [...document.querySelectorAll("[data-site-content]")];
  const keys = [...new Set([
    ...placeholders.map((element) => element.dataset.siteContent),
    "branding.logo_path",
    "branding.school_name",
    "branding.tagline",
    "settings.site_description",
    "settings.theme_color"
  ])];
  const client = window.schoolSupabase;

  if (!client) return;

  client
    .from("site_content")
    .select("content_key, content")
    .eq("is_published", true)
    .in("content_key", keys)
    .then(({ data, error }) => {
      if (error) {
        console.error("Could not load approved site content:", error);
        return;
      }

      const contentByKey = new Map(
        (data || []).map((item) => [item.content_key, item.content])
      );

      placeholders.forEach((element) => {
        const content = contentByKey.get(element.dataset.siteContent);
        if (typeof content === "string") {
          if (element.tagName === "META") {
            element.setAttribute("content", content);
          } else if (element.tagName === "TITLE") {
            element.textContent = content;
          } else {
            element.textContent = content;
          }
          const facilityCard = element.closest("[data-facility-card]");
          if (facilityCard && content.trim()) facilityCard.hidden = false;
        }
      });

      const schoolName = contentByKey.get("branding.school_name")?.trim();
      if (schoolName) {
        document.querySelectorAll(".brand-copy strong").forEach((element) => {
          element.textContent = schoolName;
        });
        document.title = document.title.replace("New India Matric School", schoolName);
      }

      const tagline = contentByKey.get("branding.tagline")?.trim();
      if (tagline) {
        document.querySelectorAll(".brand-copy small").forEach((element) => {
          element.textContent = tagline;
        });
      }

      const description = contentByKey.get("settings.site_description")?.trim();
      if (description) {
        document.querySelectorAll('meta[name="description"], meta[property="og:description"]')
          .forEach((element) => element.setAttribute("content", description));
      }

      const themeColor = contentByKey.get("settings.theme_color")?.trim();
      if (themeColor && /^#[0-9a-f]{6}$/i.test(themeColor)) {
        document.documentElement.style.setProperty("--blue", themeColor);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
      }

      const logoPath = contentByKey.get("branding.logo_path");
      if (logoPath && /^logo\/[A-Za-z0-9._-]+\.(png|jpg|webp)$/i.test(logoPath) && !logoPath.includes("..")) {
        const { data: logoData } = client.storage.from("school-branding").getPublicUrl(logoPath);
        if (!logoData?.publicUrl) {
          console.error("Could not resolve the published school logo URL.");
        } else {
          document.querySelectorAll(".brand-mark").forEach((element) => {
            element.style.backgroundImage = `url("${logoData.publicUrl}")`;
          });
          document.querySelectorAll(".hero-logo").forEach((element) => {
            element.setAttribute("src", logoData.publicUrl);
          });
        }
      } else if (logoPath) {
        console.error("The published school logo path is invalid.");
      }

      const hasPublishedFacilities = [...document.querySelectorAll("[data-facility-card]")]
        .some((card) => !card.hidden);
      const facilityEmptyState = document.getElementById("facilityEmptyState");
      if (facilityEmptyState && hasPublishedFacilities) {
        facilityEmptyState.hidden = true;
      }
    })
    .catch((error) => {
      console.error("Could not load approved site content:", error);
    });
})();

(() => {
  "use strict";

  document.querySelectorAll("[data-enquiry-form]").forEach((form) => {
    const status = form.querySelector(".form-status");
    const submitButton = form.querySelector('button[type="submit"]');
    const honeypot = form.elements.namedItem("website");

    function showStatus(text, type = "") {
      status.textContent = text;
      status.className = `form-status ${type}`.trim();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      if (honeypot?.value) {
        showStatus("The enquiry could not be submitted. Please try again.", "error");
        return;
      }

      const client = window.schoolSupabase;
      if (!client) {
        showStatus("The enquiry service is unavailable. Please try again later.", "error");
        return;
      }

      const values = new FormData(form);
      const payload = {
        enquiry_type: form.dataset.enquiryType,
        name: String(values.get("name") || "").trim(),
        email: String(values.get("email") || "").trim(),
        phone: String(values.get("phone") || "").trim() || null,
        message: String(values.get("message") || "").trim()
      };

      if (
        !["contact", "admissions"].includes(payload.enquiry_type) ||
        payload.name.length < 2 ||
        payload.name.length > 100 ||
        payload.email.length > 254 ||
        payload.message.length < 10 ||
        payload.message.length > 5000 ||
        (payload.phone && payload.phone.length > 30)
      ) {
        showStatus("Please check the form details and try again.", "error");
        return;
      }

      submitButton.disabled = true;
      showStatus("Submitting your enquiry…");

      try {
        const { error } = await client.from("enquiries").insert(payload);
        if (error) throw error;

        form.reset();
        showStatus("Your enquiry has been sent to the school.", "success");
      } catch (error) {
        console.error("Enquiry submission failed:", error);
        showStatus(
          "We could not submit your enquiry. Please try again later.",
          "error"
        );
      } finally {
        submitButton.disabled = false;
      }
    });
  });
})();

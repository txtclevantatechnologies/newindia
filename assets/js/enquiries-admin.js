(() => {
  "use strict";

  const client = window.schoolSupabase;
  const list = document.getElementById("enquiriesList");
  const status = document.getElementById("enquiriesStatus");
  const typeFilter = document.getElementById("enquiryTypeFilter");
  const statusFilter = document.getElementById("enquiryStatusFilter");
  const refreshButton = document.getElementById("refreshEnquiries");
  const searchInput = document.getElementById("enquirySearch");
  const exportButton = document.getElementById("exportEnquiries");

  if (
    !client || !list || !status || !typeFilter || !statusFilter ||
    !refreshButton || !searchInput || !exportButton
  ) {
    console.error("Enquiry manager could not initialize.");
    if (status) status.textContent = "Enquiry manager could not initialize.";
    return;
  }

  let busy = false;
  let currentEnquiries = [];

  function setStatus(text, type = "") {
    status.textContent = text;
    status.className = `module-status ${type}`.trim();
  }

  function text(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value || "";
    return element;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  async function updateStatus(item, nextStatus) {
    if (busy) return;
    busy = true;
    let shouldReload = false;
    try {
      const { data: updated, error } = await client
        .from("enquiries")
        .update({ status: nextStatus })
        .eq("id", item.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("No enquiry was updated.");
      setStatus("Enquiry status updated.", "success");
      shouldReload = true;
      window.schoolDashboardRefreshCounts?.();
    } catch (error) {
      console.error("Could not update enquiry:", error);
      setStatus("Could not update this enquiry.", "error");
    } finally {
      busy = false;
    }
    if (shouldReload) await loadEnquiries();
  }

  async function deleteEnquiry(item) {
    if (busy || !window.confirm("Delete this enquiry permanently?")) return;
    busy = true;
    let shouldReload = false;
    try {
      const { data: deleted, error } = await client
        .from("enquiries")
        .delete()
        .eq("id", item.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!deleted) throw new Error("No enquiry was deleted.");
      setStatus("Enquiry deleted.", "success");
      shouldReload = true;
      window.schoolDashboardRefreshCounts?.();
    } catch (error) {
      console.error("Could not delete enquiry:", error);
      setStatus("Could not delete this enquiry.", "error");
    } finally {
      busy = false;
    }
    if (shouldReload) await loadEnquiries();
  }

  function render(items) {
    list.replaceChildren();
    if (items.length === 0) {
      list.appendChild(text("p", "No enquiries match these filters."));
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "announcement-card";
      const heading = document.createElement("div");
      heading.className = "announcement-heading";
      heading.append(text("h3", item.name));
      const pill = text("span", item.status === "reviewed" ? "Reviewed" : "New");
      pill.className = `pill ${item.status === "reviewed" ? "published" : "draft"}`;
      heading.appendChild(pill);

      card.append(
        heading,
        text("p", `Type: ${item.enquiry_type === "admissions" ? "Admissions" : "Contact"}`),
        text("p", `Email: ${item.email}`),
        text("p", `Phone: ${item.phone || "Not provided"}`),
        text("p", `Received: ${formatDate(item.created_at)}`)
      );
      const message = text("p", item.message);
      message.className = "announcement-body";
      card.appendChild(message);

      const actions = document.createElement("div");
      actions.className = "announcement-actions";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "action-button";
      toggle.textContent = item.status === "reviewed" ? "Mark as new" : "Mark reviewed";
      toggle.addEventListener("click", () => {
        updateStatus(item, item.status === "reviewed" ? "new" : "reviewed");
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "action-button danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteEnquiry(item));
      actions.append(toggle, remove);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function getVisibleEnquiries() {
    const search = searchInput.value.trim().toLocaleLowerCase();
    if (!search) return currentEnquiries;
    return currentEnquiries.filter((item) =>
      [item.name, item.email, item.phone, item.message]
        .some((value) => String(value || "").toLocaleLowerCase().includes(search))
    );
  }

  function renderFilteredEnquiries() {
    const visible = getVisibleEnquiries();
    render(visible);
    exportButton.disabled = visible.length === 0;
    const capNote = currentEnquiries.length === 100 ? " (newest 100 loaded)" : "";
    setStatus(`Showing ${visible.length} of ${currentEnquiries.length} loaded enquiries${capNote}.`);
  }

  function csvCell(value) {
    let textValue = String(value ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(textValue)) textValue = `'${textValue}`;
    return `"${textValue.replaceAll('"', '""')}"`;
  }

  function exportVisibleEnquiries() {
    const enquiries = getVisibleEnquiries();
    if (!enquiries.length) return;

    const columns = [
      ["Received", "created_at"],
      ["Type", "enquiry_type"],
      ["Status", "status"],
      ["Name", "name"],
      ["Email", "email"],
      ["Phone", "phone"],
      ["Message", "message"]
    ];
    const rows = [
      columns.map(([label]) => csvCell(label)),
      ...enquiries.map((item) => columns.map(([, key]) => csvCell(item[key])))
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `school-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported ${enquiries.length} filtered enquiries. Keep the downloaded file private.`, "success");
  }

  async function loadEnquiries() {
    if (busy) return;
    refreshButton.disabled = true;
    exportButton.disabled = true;
    setStatus("Loading private enquiries…");
    try {
      let query = client
        .from("enquiries")
        .select("id, enquiry_type, name, email, phone, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (typeFilter.value !== "all") query = query.eq("enquiry_type", typeFilter.value);
      if (statusFilter.value !== "all") query = query.eq("status", statusFilter.value);
      const { data, error } = await query;
      if (error) throw error;
      currentEnquiries = data || [];
      renderFilteredEnquiries();
    } catch (error) {
      console.error("Could not load enquiries:", error);
      currentEnquiries = [];
      list.replaceChildren();
      exportButton.disabled = true;
      setStatus("Could not load enquiries. Check administrator permissions.", "error");
    } finally {
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", loadEnquiries);
  typeFilter.addEventListener("change", loadEnquiries);
  statusFilter.addEventListener("change", loadEnquiries);
  searchInput.addEventListener("input", renderFilteredEnquiries);
  exportButton.addEventListener("click", exportVisibleEnquiries);
  loadEnquiries();
})();

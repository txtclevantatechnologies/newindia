(() => {
  const year = document.getElementById("currentYear");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".navigation a").forEach((link) => {
    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage && !link.classList.contains("nav-cta")) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    } else if (linkPage !== currentPage) {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
    }
  });
})();
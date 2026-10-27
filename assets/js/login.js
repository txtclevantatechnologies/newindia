
(() => {
  "use strict";

  const form = document.getElementById("loginForm");
  const status = document.getElementById("status");
  const button = document.getElementById("loginButton");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("togglePassword");

  function showStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function getClient() {
    if (!window.schoolSupabase) {
      showStatus(
        "Configuration error. Check config.js and the Supabase CDN connection.",
        "error"
      );
      return null;
    }
    return window.schoolSupabase;
  }

  async function verifyAdmin(client, userId) {
    const { data, error } = await client
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to verify administrator access. Check database policies.");
    }

    return Boolean(data);
  }

  async function redirectIfAdmin() {
    const client = getClient();
    if (!client) return;

    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) throw error;
      if (!session?.user) return;

      if (await verifyAdmin(client, session.user.id)) {
        window.location.replace("./dashboard.html");
      } else {
        await client.auth.signOut();
      }
    } catch (error) {
      console.error(error);
      showStatus("Could not verify the current session. Please sign in again.", "error");
    }
  }

  passwordToggle.addEventListener("click", () => {
    const visible = passwordInput.type === "password";
    passwordInput.type = visible ? "text" : "password";
    passwordToggle.textContent = visible ? "Hide password" : "Show password";
    passwordToggle.setAttribute("aria-pressed", String(visible));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const client = getClient();
    if (!client) return;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (email.length > 254 || password.length > 128) {
      showStatus("Check the email and password lengths and try again.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Verifying…";
    showStatus("Checking your credentials…");

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.user) {
        showStatus("Sign-in failed. Check your email and password.", "error");
        return;
      }

      const authorised = await verifyAdmin(client, data.user.id);

      if (!authorised) {
        await client.auth.signOut();
        showStatus("This account is not authorised to access the admin panel.", "error");
        return;
      }

      showStatus("Access verified. Opening dashboard…", "success");
      window.location.replace("./dashboard.html");
    } catch (error) {
      console.error(error);
      showStatus(error.message || "An unexpected error occurred.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Sign in securely";
    }
  });

  redirectIfAdmin();
})();

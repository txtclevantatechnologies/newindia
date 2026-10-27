# New India Matric School website

Static HTML, CSS and vanilla JavaScript pages for New India Matric School, Gudamalai, Gangavalli, Salem, Tamil Nadu. Supabase provides authentication, PostgreSQL and private media storage. Cloudflare Pages serves the static site from the GitHub repository.

The public copy intentionally avoids unverified details. Contact information, facilities, fees, curriculum specifics, leadership, history and achievements should be added only after school approval. Public copy and contact details can be edited in the administrator dashboard; achievements can be posted as announcements in the `Achievements` category.

## Requirements

- VS Code or another text editor.
- Git and a GitHub account for source control.
- A Cloudflare account for static hosting with Cloudflare Pages.
- Python 3 for the local static server (`py -m http.server 8000`).
- A Supabase project for database, authentication and storage.

There is no build step or package manager. Do not put a Supabase `service_role` key, database password or other secret in any website file.

## 1. Configure Supabase

1. Create a Supabase project and keep its database password private.
2. In the Supabase project dashboard, open **Project Settings → API** (the exact menu wording may vary). Copy the **Project URL** and the **publishable key** (older projects may label the browser-safe key `anon`).
3. Edit `assets/js/config.js` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to those values. The browser key is public by design; RLS and Storage policies are the security boundary. Never paste the `service_role` key or a secret key here.
4. The browser loads the pinned Supabase JavaScript SDK v2 from jsDelivr. The site does not use a backend server.

## 2. Install the database schema

1. Open **SQL Editor** in the Supabase dashboard.
2. Review `database/schema.sql`, then run its contents as a project administrator.
3. The script creates the required tables, indexes, timestamp triggers, RLS policies, the private `school-gallery` bucket and a separate public `school-branding` bucket for the school logo only. It is designed to be re-run without dropping tables and adds missing gallery/site-content columns to existing tables. Inspect an existing production database and back it up before applying any schema change.
4. Review the policies in **Authentication → Policies** or the Table Editor. RLS must remain enabled on all five public tables. Do not add a permissive anonymous policy to CMS tables or `enquiries`.

The `school-gallery` bucket is **private**, with a 50 MiB per-object limit and JPEG, PNG, WebP, GIF, MP4 and WebM MIME types. Published gallery media is served with short-lived signed URLs. Draft media is not readable by anonymous visitors. The separate `school-branding` bucket is public because the logo must load on public pages; it accepts only PNG, JPEG and WebP files up to 5 MiB, and only administrators can upload or change objects. Never put private or student media in that bucket.

## 3. Create the first administrator

Administrator access is an allowlist, not merely a valid Supabase account.

1. In **Authentication → Users**, create the administrator using the school-controlled email address and a strong unique password. Disable public sign-up if it is enabled.
2. Copy the new Auth user UUID.
3. In the Supabase SQL Editor, run the following after replacing both example values:

   ```sql
   insert into public.admin_profiles (user_id, display_name)
   values ('AUTH_USER_UUID', 'Approved display name');
   ```

4. Sign in at `/admin/login.html`. A user without a corresponding `admin_profiles` row is rejected by both the login flow and database policies.
5. To revoke access, delete that user's `admin_profiles` row and, if appropriate, disable the Auth user.

Do not grant administrator access by adding a frontend flag or exposing a service key.

To authorize an existing Auth user by email instead of copying the UUID, run this in the Supabase SQL Editor after replacing `ADMIN_EMAIL` with the exact email of the school-approved account:

```sql
do $$
declare
  approved_user_id uuid;
begin
  select id into approved_user_id
  from auth.users
  where lower(email) = lower('ADMIN_EMAIL');

  if approved_user_id is null then
    raise exception 'No Supabase Auth user exists for the supplied email.';
  end if;

  insert into public.admin_profiles (user_id, display_name)
  values (approved_user_id, 'School Administrator')
  on conflict (user_id) do nothing;
end
$$;
```

## 4. Local testing

From the project directory in a terminal:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/`. Opening HTML files directly with `file://` is not a valid test for Supabase requests.

Check each public page and `/admin/login.html`. Test mobile navigation, keyboard focus, form validation, empty/error states, and a narrow viewport. Supabase-dependent flows require the project URL/key, schema, Auth user and policies to be configured. This repository cannot verify or substitute for those manual project settings.

### Suggested authorization checks

- As an anonymous visitor, verify published announcements/gallery items/site content are readable, but drafts and enquiry records are not.
- Submit a test enquiry and confirm anonymous users cannot select, update or delete it.
- Sign in with an ordinary Auth user that is not listed in `admin_profiles`; confirm it cannot read or modify CMS tables/storage or access the dashboard.
- Sign in as the allowlisted administrator and test announcement draft/publish/edit/delete, gallery upload/edit/publish/delete, text publication, enquiry filtering/status/deletion, and sign-out.
- Inspect browser Network/Console for denied requests and failed CDN/configuration loads. Remove test enquiries/media after testing.

The public forms include browser validation and a honeypot, and database policies constrain accepted fields. These controls are not a rate limiter or a substitute for server-side anti-abuse controls; a static public form can be targeted by automated spam. If abuse occurs, add a verified CAPTCHA/Edge Function or another server-side rate-control service before expanding public submission.

## 5. GitHub and Cloudflare Pages

This site has no build step. Keep the GitHub repository as the source of truth and let Cloudflare Pages publish the repository root.

1. Create a GitHub repository, then initialize and push this project from its root:

   ```powershell
   git init
   git add .gitignore README.md 404.html about.html academics.html achievements.html admissions.html contact.html facilities.html gallery.html index.html news.html robots.txt admin assets database
   git commit -m "Initial school website"
   git branch -M main
   git remote add origin https://github.com/OWNER/REPOSITORY.git
   git push -u origin main
   ```

2. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git** and authorize access to the repository.
3. Select the repository and `main` as the production branch. Choose no framework, leave the build command empty, and set the build output directory to `.` (the repository root). Save and deploy.
4. Open the generated `*.pages.dev` URL and verify all public pages, the admin login route, and Supabase-backed features. Relative asset paths support the Pages domain.
5. Add the deployed URL to Supabase **Authentication → URL Configuration** as the site URL and an allowed redirect URL if required. Login redirects to the sibling dashboard page.
6. To use a custom domain later, add it under the Pages project’s **Custom domains** and follow Cloudflare’s DNS and HTTPS prompts. Add canonical URLs and a sitemap only after the final public domain is confirmed.

Cloudflare Pages is static hosting; it does not execute server-side code. Supabase must be configured independently, and deploying the HTML alone does not make authentication, forms or database-backed content functional. The Supabase URL and publishable/anon key in the browser config are public by design; never publish a service-role key or other secret.

## 6. Content management and privacy

- Authorized admins can edit published page copy, shared branding, search description, accent color and school logo in **Website content**. Text is rendered as plain text; HTML and scripts are not interpreted.
- Logo uploads require the public `school-branding` bucket and its RLS policies from `database/schema.sql`. Uploading a logo stages it; choose **Save website content** to apply it to public pages.
- Only mark a site-content item published after the school has approved it.
- Announcements in the `Achievements` category feed the achievements page. Announcements and gallery entries must be explicitly published.
- Enquiries are private and visible only to allowlisted administrators. Collect only information needed to respond; avoid sensitive information about children.
- Supabase free-tier limits, retention behavior, egress, storage and quotas can change. Review current Supabase and Cloudflare Pages usage/pricing documentation. Large/long videos may be better hosted on YouTube. No unlimited free storage or bandwidth is promised.

## Troubleshooting

- **Configuration error:** confirm the project URL and publishable/anon key in `assets/js/config.js`; never use a service-role key.
- **Tables or policies missing:** run/review `database/schema.sql`; inspect RLS and grants in Supabase.
- **Login succeeds but dashboard rejects the user:** confirm the Auth user UUID has an `admin_profiles` record and the session is not expired.
- **Gallery upload/signing fails:** confirm the private bucket and storage policies exist, the file is within the limit and the MIME type/extension is supported.
- **Uploaded video does not play:** confirm the published row has the correct `storage_path` and `video_file` type, the signed Storage URL succeeds, and the file uses a browser-supported codec (the `.mp4` or `.webm` extension alone does not guarantee codec support). The player provides a direct signed-URL fallback when playback fails.
- **YouTube player does not load:** confirm the video is public and embedding is allowed. Privacy settings, deleted videos, browser/network restrictions, and YouTube player errors can still prevent playback; use the “Watch on YouTube” fallback.
- **Enquiry submission fails:** confirm the table, insert grant and RLS policy exist. Anonymous users intentionally cannot read submitted enquiries.
- **No announcements or gallery items:** confirm content has been published and public SELECT policies are enabled.
- **CDN unavailable:** the Supabase SDK is fetched from jsDelivr; database-backed features need a working network connection. Static informational pages remain usable without it.

## Project files

- Public pages: `index.html`, `about.html`, `academics.html`, `facilities.html`, `achievements.html`, `gallery.html`, `news.html`, `admissions.html`, `contact.html`.
- Admin pages: `admin/login.html`, `admin/dashboard.html`.
- Frontend assets: `assets/css/` and `assets/js/`.
- Supabase schema/policies: `database/schema.sql`.

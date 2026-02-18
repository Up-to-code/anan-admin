# Anan Admin Dashboard

Next.js admin dashboard for the Anan platform. Uses Convex for backend.

## Vercel Deployment

1. **Push to a new repo:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/anan-admin.git
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Import in Vercel:**
   - Go to [vercel.com](https://vercel.com) → New Project → Import your `anan-admin` repo
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `.` (root)

3. **Environment variables** (required):
   - `NEXT_PUBLIC_CONVEX_URL` – Your Convex deployment URL (e.g. `https://xxx.convex.cloud`)
   - `NEXT_PUBLIC_CONVEX_SITE_URL` – Your Convex site URL (e.g. `https://xxx.convex.site`)
   - `NEXT_PUBLIC_SITE_URL` – Your app URL (e.g. `https://admin.yourdomain.com`)
   - `SITE_URL` – Convex auth base URL (usually your Convex site URL)
   - `BETTER_AUTH_TRUSTED_ORIGINS` – Comma-separated allowed origins (include your Vercel admin URL, e.g. `https://anan-admin.vercel.app`)

4. **Convex backend** – Deploy Convex from this repo:
   ```bash
   npx convex deploy
   ```

## Local Development

```bash
bun install
cp .env.example .env   # Add your Convex URLs
bun run dev
```

Runs at http://localhost:3002

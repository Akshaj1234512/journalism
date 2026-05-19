# Deploying The Red Room

The site has two pieces. To share a link in Slack or on social media, both pieces need a public URL. While they only run on your laptop, only you can see them.

| Piece | Lives in | Free host I'd recommend |
|---|---|---|
| **Frontend** (Next.js editor & UI) | `frontend/` | [Vercel](https://vercel.com) |
| **Backend** (FastAPI agents + Anthropic) | `backend/` | [Hugging Face Spaces](https://huggingface.co/spaces) |

Both have generous free tiers. Total monthly cost on free plans: **$0 in hosting**. The only real cost is the Anthropic API itself, which is per-review (~$0.05 per warm review).

Total deploy time: ~20 minutes the first time.

---

## Step 1 — push the project to GitHub

Both Vercel and Hugging Face deploy directly from a Git repository.

```bash
cd /data/akshaj/journalism
git add .
git commit -m "deploy"
# create an empty repo on github.com first, then:
git remote add origin https://github.com/<your-username>/red-room.git
git push -u origin main
```

---

## Step 2 — deploy the backend (Hugging Face Spaces)

1. Sign in at https://huggingface.co (free).
2. Click **New Space**. Settings:
   - **Owner**: your username
   - **Space name**: `red-room-api` (or anything)
   - **License**: MIT or your choice
   - **SDK**: **Docker**
   - **Hardware**: CPU basic (free)
   - **Visibility**: Public
3. Open the new Space's **Files** tab → **Add file** → **Upload files**. Upload the entire `backend/` folder so that `Dockerfile` sits at the **root** of the Space (not nested inside `backend/`). Or, easier: link the Space to your GitHub repo and set the root directory to `backend/`.
4. Go to **Settings** → **Variables and secrets**. Add these **secrets** (never plain variables):
   - `ANTHROPIC_API_KEY` = your real Anthropic key
   - `RED_ROOM_CORS_ORIGINS` = leave empty for now; we'll fill it in once we have the Vercel URL
5. The Space builds for ~2 minutes. When it's done you'll see a green "Running" badge and a public URL like `https://<your-username>-red-room-api.hf.space`.
6. Test it: open `https://<that URL>/health` in a browser. You should see `{"status":"ok"}`.

Hold on to that URL.

---

## Step 3 — deploy the frontend (Vercel)

1. Sign in at https://vercel.com with your GitHub account.
2. Click **Add New** → **Project** → import your `red-room` repo.
3. Settings:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Install Command**: `npm install` (default)
4. Open **Environment Variables** and add:
   - `NEXT_PUBLIC_BACKEND_URL` = the Hugging Face URL from Step 2 (e.g. `https://your-username-red-room-api.hf.space`). No trailing slash.
   - `NEXT_PUBLIC_SITE_URL` = leave blank for now; Vercel gives you a URL after deploy.
5. Click **Deploy**. ~90 seconds.
6. Vercel gives you a URL like `https://red-room-abc123.vercel.app`. Open it. The site should load. The masthead will be there. **Run review will still fail** because the backend doesn't yet allow CORS from this domain — that's the next step.

---

## Step 4 — connect the two

Go back to your Hugging Face Space → **Settings** → **Variables and secrets**, and set:

- `RED_ROOM_CORS_ORIGINS` = the Vercel URL from Step 3 (e.g. `https://red-room-abc123.vercel.app`)

Restart the Space (or it auto-restarts on secret change). Wait 30 seconds.

Now go back to Vercel → your project → **Settings** → **Environment Variables** and set:

- `NEXT_PUBLIC_SITE_URL` = your Vercel URL (e.g. `https://red-room-abc123.vercel.app`)

Redeploy the frontend (in Vercel: **Deployments** → top deployment → "•••" → **Redeploy**).

---

## Step 5 — try it

Open your Vercel URL in an incognito window so you're a fresh visitor:

1. The masthead loads.
2. The tutorial pops up automatically.
3. Run a review. The sidebar fills with notes within ~30 seconds.
4. Paste the Vercel URL in Slack — it should preview with the OG image (italic *Red Room* masthead + agent chips).

If it works, you're live. Share away.

---

## Adding a custom domain (optional, ~$10/year)

1. Buy a domain (Namecheap, Cloudflare Registrar, Porkbun, etc.).
2. In Vercel → your project → **Settings** → **Domains**, add the domain. Vercel gives you the DNS records to point at it.
3. Go to your registrar's DNS panel and add the records Vercel showed you.
4. After ~5 minutes you can open `https://yourdomain.com` and the site loads.
5. Update `RED_ROOM_CORS_ORIGINS` on the HF Space to include your custom domain (comma-separated with the Vercel URL).
6. Update `NEXT_PUBLIC_SITE_URL` on Vercel to your custom domain. Redeploy.

---

## Troubleshooting

**Run review returns "We can't reach the review service."**
The frontend can't reach the backend. Two likely causes:
- `NEXT_PUBLIC_BACKEND_URL` on Vercel is wrong or missing. Should be the HF Spaces URL with no trailing slash.
- The HF Space is sleeping (Spaces sleep after inactivity on the free tier). Open `https://<your-space>.hf.space/health` once in a browser to wake it.

**"Run review couldn't be started (error 403)" or CORS errors in the browser console.**
`RED_ROOM_CORS_ORIGINS` on the HF Space doesn't include your frontend URL. Set it exactly to the Vercel URL, including `https://`, no trailing slash.

**"Authentication failed."**
The `ANTHROPIC_API_KEY` secret on the HF Space is missing or invalid.

**The OG share preview shows the wrong URL or no image.**
Set `NEXT_PUBLIC_SITE_URL` on Vercel to your frontend URL and redeploy. Then re-fetch the preview in [Twitter Cards Validator](https://cards-dev.twitter.com/validator) or [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) (Twitter and LinkedIn cache aggressively; you may need to force a re-scrape).

---

## What it costs

- **Vercel free**: enough for unlimited personal projects.
- **Hugging Face Spaces free**: CPU basic, sleeps after ~30 minutes idle, wakes on first request.
- **Anthropic API**: ~$0.05 per warm review (six agents, ~1500 words). 100 reviews ≈ $5. **This is the only real bill** and goes to your account because the API key is yours.

If the site catches on and the API bill starts to bother you, the realistic next step is to switch to a "bring your own API key" model: have visitors paste their own Anthropic key into a settings panel, so each user pays for their own usage. Easy to add later; ask me when you want it.

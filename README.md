# GI Report Typing Tool

EGD（上消化道內視鏡）報告輔助工具 — Chi Mei Medical Center, GI Division

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

Open `http://localhost:5173` — default password: `chimei2026`

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your GitHub repo
3. In Vercel dashboard → Settings → Environment Variables, add:
   - `VITE_APP_PASSWORD` = your preferred password
4. Deploy — done!

## Change Password

- **Local dev:** edit `.env` file → `VITE_APP_PASSWORD=yourpassword`
- **Production (Vercel):** Settings → Environment Variables → update `VITE_APP_PASSWORD`

## Note

This is a **front-end only** password gate — it prevents casual access but is not a secure authentication system. Since this tool does not handle patient data (only generates report templates), this level of protection is sufficient.

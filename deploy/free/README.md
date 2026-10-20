# Zero-cost deployment

Live setup for this project:

| What | Where |
|---|---|
| API + worker + models + **farmer web app** | Hugging Face Space `barath80/Project` -> https://barath80-project.hf.space |
| Database | Supabase project `mvutuwjehidquifrfycd` (Tokyo) |
| Admin dashboard | Vercel (import the GitHub repo, root `admin`, env `AGRISMART_API_URL=https://barath80-project.hf.space`) |
| Android APK | https://github.com/barath80/AgriSmart/releases/download/apk-latest/AgriSmart.apk (built free by GitHub Actions; rebuild from the repo's Actions tab -> "Build Android APK" -> Run workflow, and type a different API address if it changes) |

The Space serves the farmer web app at `/` and the API at `/api/v1`, so the web app needs no CORS setup.
Admin login: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` secrets on the Space.

If the Space shows "Quota exceeded for flavor cpu-basic", the Hugging Face account has no free CPU
quota yet: verify the e-mail address and check Settings -> Billing, then press **Restart** on the Space.

The sections below explain each step in general.

Every piece runs on a free tier. No credit card is needed for the four below.

| Piece | Host | Free limits to know |
|---|---|---|
| Database | [Supabase](https://supabase.com) | 500 MB; pauses after 7 days idle |
| API + worker + models | [Hugging Face Docker Space](https://huggingface.co/new-space) | 2 vCPU, 16 GB RAM; sleeps after 48 h idle and wakes on the next request |
| Admin dashboard | [Vercel](https://vercel.com) (Hobby) | non-commercial use |
| Farmer app (web) | Vercel or Cloudflare Pages | static files |
| Farmer app (Android APK) | [EAS Build](https://expo.dev) free plan | ~30 builds a month |

## 1. Database (Supabase)

Create a project, click **Connect**, copy the **Session pooler** string, and change the start to
`postgresql+asyncpg://`. This is `DATABASE_URL`.

## 2. API + worker (Hugging Face Space)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\free\build-space.ps1   # makes deploy\free\space
```

Create a **Docker** Space (blank template), then push that folder to it:

```bash
cd deploy/free/space
git init && git lfs install && git add -A && git commit -m "AgriSmart"
git remote add space https://huggingface.co/spaces/<you>/<space-name>
git push --force space HEAD:main
```

In the Space's **Settings → Variables and secrets** add:

| Name | Value |
|---|---|
| `DATABASE_URL` (secret) | from step 1 |
| `JWT_SECRET` (secret) | any random 40+ characters |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` (secret) | your admin login; password 12+ characters |
| `CORS_ORIGINS` | the admin and web-app URLs from steps 3 and 4, comma-separated |
| `PUBLIC_BASE_URL` | `https://<you>-<space-name>.hf.space` |
| `DEMO_LOGIN` | `true` (see the warning below) |
| `MARKET_PROVIDER` | `agmarknet` (no key). Add `DATA_GOV_IN_API_KEY` as a backup |
| `VOICE_PROVIDER`, `SARVAM_API_KEY`, `GEMINI_API_KEY`, `LLM_PROVIDER` | optional; see `backend/.env.example` |

The container migrates the database, loads the crop/disease/pest/scheme data, activates the
bundled models and creates the admin on every start. Nothing else to run. Check
`https://<you>-<space-name>.hf.space/ready`.

**Login codes.** SMS costs money. `DEMO_LOGIN=true` returns the login code in the response and
the app shows it, so **anyone can sign in as any phone number**. Fine for a demo with test
data. For real farmers set `SMS_PROVIDER=twilio` (with its keys) and remove `DEMO_LOGIN`.

## 3. Admin (Vercel)

Import the repo, set the root directory to `admin`, and add the environment variable
`AGRISMART_API_URL=https://<you>-<space-name>.hf.space`.

## 4. Farmer app

Web: from `mobile`, run
`$env:EXPO_PUBLIC_API_URL="https://<you>-<space-name>.hf.space"; npx expo export --platform web`
and upload `dist` to Vercel or Cloudflare Pages.

Android: `npx eas build -p android --profile preview` (profiles are in `mobile/eas.json`) after
setting the same `EXPO_PUBLIC_API_URL` in the profile's `env`.

## Keeping it awake

The Space and Supabase sleep when idle. A free [UptimeRobot](https://uptimerobot.com) monitor on
`/ready` every 5 minutes keeps both active. The worker runs inside the Space, so alerts only go
out while it is awake.

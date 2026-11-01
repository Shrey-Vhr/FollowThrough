# FollowThrough – frontend

Next.js app for FollowThrough. See the [root README](../README.md) for the full setup.

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_USE_MOCKS=true runs on mock data, no backend needed
npm run dev                  # http://localhost:3000
```

Set `NEXT_PUBLIC_USE_MOCKS=false` and `NEXT_PUBLIC_API_URL=http://localhost:8001` to use the real backend.

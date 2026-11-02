# Diecast Vault

Diecast Vault is a responsive collection manager for Hot Wheels collectors. It uses Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Postgres/Storage, and a browser-based ZXing barcode scanner.

## Current state

The app includes email/password sign-in and reset-link requests, an owner-isolated Supabase schema, collection add/edit/soft-delete and quantity/favourite updates, private photo uploads, a ZXing camera scanner, barcode/manual entry, duplicate review, wishlist and series management, collection analytics, and responsive garage filters. With no Supabase environment variables, it shows labeled example data and keeps changes in memory only; refresh clears preview changes.

## Local development

Requirements: Node.js 20.19 or later and npm. Install packages and start the development server:

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Use `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` to validate changes. Camera access requires HTTPS outside localhost and a camera permission grant.

## Supabase setup

1. Create a Supabase project and copy its Project URL and publishable/anon key from the API settings.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never add a service-role key to this app.
3. Apply `supabase/migrations/202611020001_initial_schema.sql` in the Supabase SQL editor or with the Supabase CLI (`supabase db push`). The migration creates the schema, owner policies, private `diecast-images` bucket, and signup starter series.
4. In Authentication settings, enable email/password and configure the site URL and redirect allowlist for local development and the production domain. The signup flow may require email confirmation depending on the project settings.
5. The storage bucket is private. Image object paths must begin with the authenticated user's UUID; RLS policies enforce ownership.

## Vercel deployment

1. Push this repository to GitHub and import it in Vercel.
2. Set the project runtime to Node.js 22.x in Vercel settings.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Vercel environment groups used for Preview and Production.
4. Add the Vercel production URL and preview URLs to Supabase Auth redirect/site URL configuration.
5. Deploy from the connected Git repository. Vercel handles application deployment; GitHub Actions only validates changes.
6. Verify signup/sign-in, database access, private image upload, and camera permissions on the HTTPS deployment.

## Mobile camera checks

- iPhone Safari: open the HTTPS app, grant camera permission, scan a retail barcode, then add casting details manually.
- Android Chrome: grant camera permission and test rear-camera scanning and manual UPC/EAN entry.
- Desktop Chrome or Edge: grant camera access or enter a barcode in the scanner dialog.

## Validation

GitHub Actions runs lint, type checking, unit tests, and a production build on pull requests and pushes to `main`. Collection analytics use recorded data only, not market estimates.

## Current limitations

- The scanner supports live UPC/EAN decoding and manual entry. Camera switching and flashlight controls are not implemented.
- Photos support up to five compressed uploads and a signed primary image. Cropping, rotation, and a multi-image detail gallery are not implemented.
- Wishlist images and an acquired/removal lifecycle are not implemented; “Move to collection” prefills the add form.
- The dashboard is a single-page shell. Dedicated car detail routes, pagination, and a service worker/offline cache are not included.
- Automated tests currently cover validation, barcode normalization, and duplicate identity rules. Auth, database isolation, camera, and upload integration need a configured Supabase project for end-to-end testing.
- The forms use controlled inputs with Zod validation; React Hook Form is installed but not yet used.
- Password reset email requests are implemented; the password-change callback screen is not.
- The visual controls are project-specific Tailwind components rather than shadcn/ui. The app currently uses a fixed dark appearance; next-themes and Sonner are installed but not wired into the UI.

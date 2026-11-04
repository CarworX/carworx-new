# 4. Google sign-in on this computer (O-5)

**Why:** acceptance test A3 needs a real Google sign-in, both on staging and on this computer (B1). Staging is set up: on 2026-11-04 Claude confirmed through Supabase's public settings that Google and email sign-in are on in the project "CarworX App". Claude can't see the Google Cloud console, and a provider switched on is not yet a tested login.

On this computer, sign-in runs through the **local** Supabase stack, which needs three things:
1. the same Google client to accept the local return address
2. the client ID and secret given to the local stack, without the secret entering Git
3. the app's own local address allowed as a place to come back to

**When:** before T3. Steps 1 and 2 can be done now. Step 3 is done with Claude during T1/T3, because the files it uses are created in T1.

## Step 1: add the local return address in Google Cloud

1. Go to <https://console.cloud.google.com/>, and pick the project that holds the CarworX OAuth client.
2. Open **APIs & Services → Credentials** (in newer consoles: **Google Auth Platform → Clients**). Click the CarworX **Web application** client.
3. Under **Authorised redirect URIs**, check that the staging address is there:
   `https://gdiyrdqfkthtcglgqnts.supabase.co/auth/v1/callback`
4. Click **Add URI** and add the local one exactly:
   `http://127.0.0.1:54321/auth/v1/callback`
5. Click **Save**. Google says changes can take a few minutes to apply.

This address is from Supabase's official Google guide for local development.

## Step 2: keep the secret ready, not shared

- Note where the **Client ID** is shown on that page. The ID isn't secret, and you can tell Claude it.
- The **Client secret** is secret. Don't paste it into chat, email or any file in the repository.
- In T1, Claude creates a local file called `.env` that Git ignores, with an empty line for the secret. Claude tells you the exact line name then, for example `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=`. You open that file yourself and paste the secret after the `=`. The local Supabase settings read it from there.

## Step 3: allow the app's local address (with Claude, in T1/T3)

The local Supabase settings list the addresses the app may return to after sign-in, for example `http://localhost:5173`. Claude writes that list in T1, and you don't need to do anything for it. If T3's test sign-in fails with *redirect not allowed*, tell Claude the exact message.

## Check

- **After step 1:** the client shows both redirect URIs.
- **In T3:** you click *Continue with Google* on the local app, pick your Google account, and land back in the app signed in. That test is the proof; the settings alone aren't.

## Tell Claude

"Local redirect URI added", and later "secret pasted into .env". Never the secret itself.

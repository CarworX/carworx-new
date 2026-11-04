# 1. Make room on C:, start Docker, check pnpm (O-4)

**Why:** Phase 1 runs the database, sign-in and file storage on this computer through Supabase's local stack, which runs inside Docker. pnpm installs the app's packages. Without these, T1 can't start.

**Time:** about 30 minutes, plus any cleaning up.

## Step 1: free at least 20 GB on C:

On 2026-11-04, C: had **2.6 GB free of 238 GB**. Docker and the Supabase images need several gigabytes, and builds need room to work. Aim for **20 GB free**.

1. Press the Windows key, type **Storage settings**, and open it. It shows what takes the space.
2. Empty the **Recycle Bin**, and clear **Temporary files** there. Tick only the items you recognise.
3. Look in **Downloads** and **Videos** for large files you no longer need. Move them to an external drive, or delete them.
4. Check the free space again in **File Explorer → This PC**.

Claude deletes nothing on your computer without your OK.

## Step 2: start Docker Desktop

1. Open **Docker Desktop** from the Start menu.
2. Wait until the bottom-left corner says **Engine running** (green). The first start can take a few minutes.
3. To have it start by itself: **Settings (gear) → General → Start Docker Desktop when you sign in**. This is optional.

**Check:** open **Windows Terminal** or **PowerShell** and run:

```bash
docker info
```

It should print a long list starting with `Client:` and `Server:`. If it says `failed to connect to the docker API`, the engine isn't running yet: go back to step 2.

## Step 3: check pnpm, and turn it on only if it's missing

Run:

```bash
pnpm --version
```

- **A number appears** (for example `10.x`): done, change nothing.
- **"not recognized" or "not found"**: turn it on with Corepack, which ships with Node. Open PowerShell **as administrator** (right-click → *Run as administrator*) and run:

```bash
corepack enable pnpm
```

Then close that window, open a normal one, and run `pnpm --version` again. On 2026-11-04 pnpm was not on the PATH, and Corepack 0.34.6 was present.

## Tell Claude

"Docker is running, pnpm shows version …, and C: has … GB free." Claude rechecks with `docker info` and `pnpm --version` before T1.

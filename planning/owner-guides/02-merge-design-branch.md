# 2. Merge the design branch into main (O-3)

**Why:** all the planning and design work is on the branch `planning/design-motion-toolkit`. Phase 1 code starts from `main`, so the branch must be merged first. Only you merge (D-038, D-058).

**When:** only after Codex's design review (X-c) says the design baseline is signed off. Don't merge before that.

## Steps

1. **Open the pull request.** Go to <https://github.com/CarworX/carworx-new>. If a yellow bar says *planning/design-motion-toolkit had recent pushes*, click **Compare & pull request**. Otherwise click **Pull requests → New pull request**, set **base: main** and **compare: planning/design-motion-toolkit**, then click **Create pull request**.
   - You can ask Claude to open the pull request for you instead. Claude only opens it; it never merges.
2. **Read the summary.** The pull request page lists the commits and files. Check that the newest Codex review says the design baseline is signed off.
3. **Merge.** Click **Merge pull request**, then **Confirm merge**. Choose plain *Create a merge commit* if GitHub asks; it keeps the full history both agents wrote.
4. **Keep the branch.** Don't click *Delete branch* yet. The agents may still need it for reference. You can delete it later.

## Check

On the repository's main page, with the branch selector on **main**, the latest commit should be the merge.

## Tell Claude

"I merged the design branch." Claude then starts T1 on a new branch from `main`.

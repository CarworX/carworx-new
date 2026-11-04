# 3. Check GitHub Actions minutes (O-6)

**Why:** K1 adds automatic checks (tests, the secret scan) that run on GitHub every time code changes. On a private repository they use the organisation's monthly Actions minutes. If the minutes run out, the checks stop, and nothing can be merged safely.

**Time:** 5 minutes. Nothing is bought.

## Steps

1. Go to <https://github.com/CarworX>, click **Settings** (you need to be an owner of the organisation), then **Billing and licensing** (on some accounts it's **Billing and plans**).
2. Find **Usage** or **Actions**. Note:
   - the plan's included minutes per month
   - the minutes used so far this month
   - whether a **spending limit** is set. For now it should be **$0**, so nothing can be charged without your decision.
3. Check that Actions are allowed: repository **carworx-new → Settings → Actions → General**. *Actions permissions* should allow actions. Codex's K1 pull request lists exactly which ones it uses.

## Check

You can see the included minutes, the amount used, and a $0 spending limit.

## Tell Codex

The included minutes, the minutes used, and that the spending limit is $0 (or what it is). Codex sizes K1's checks to fit. Raising the limit is a spending decision for you, not for an agent.

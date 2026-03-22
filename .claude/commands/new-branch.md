Create a new `claude/` feature branch from `origin/main`.

## Steps

1. Parse `$ARGUMENTS` as the branch suffix (e.g. "fix-button-color").
   - If empty, ask the user what to name the branch.
2. Run `git fetch origin`.
3. Run `git checkout -b claude/$SUFFIX origin/main` **with the sandbox
   disabled** (git checkout needs to write `.claude/` files that the sandbox
   denies).
4. Run `git status --short` and check for unexpected modifications in
   `.claude/`.
   - If `.claude/` files appear modified or deleted, the checkout was
     incomplete. Tell the user: "Checkout couldn't fully update `.claude/` files
     due to sandbox restrictions. Please run `! git checkout claude/$SUFFIX` to
     fix."
5. Confirm the new branch name and that it's up to date with origin/main.

# Publish Bishopric App to GitHub (step-by-step)

## 1. Make BishopricApp its own Git repo

Right now Git is tracking the parent folder (`C:\repos`). To publish only this app as a new GitHub project, use a repo that lives **inside** the BishopricApp folder.

**In PowerShell (or Terminal), from the BishopricApp folder:**

```powershell
cd c:\repos\BishopricApp
git init
```

This creates a new `.git` inside BishopricApp. All commands below are run from `c:\repos\BishopricApp`.

---

## 2. Stage and commit everything

```powershell
git add .
git status
```

Check that you see the app files (e.g. `src/`, `package.json`, `index.html`) and **not** `node_modules/` or `dist/` (they’re in `.gitignore`).

Then create the first commit:

```powershell
git commit -m "Initial commit: Bishopric PWA"
```

---

## 3. Create a new repository on GitHub

1. Open [https://github.com/new](https://github.com/new).
2. **Repository name:** e.g. `BishopricApp` or `bishopric-app`.
3. **Description (optional):** e.g. "Perry Park Ward bishopric PWA – interviews, messages, contacts."
4. Choose **Public** or **Private**.
5. **Do not** check "Add a README", "Add .gitignore", or "Choose a license" (you already have a local repo and .gitignore).
6. Click **Create repository**.

---

## 4. Connect your local repo to GitHub

GitHub will show commands under "…or push an existing repository from the command line." Use your actual repo URL.

**If you use HTTPS:**

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

**If you use SSH:**

```powershell
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and the repo name you chose (e.g. `jake/BishopricApp`).

---

## 5. Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

- `git branch -M main` renames the current branch to `main` (if it isn’t already).
- `git push -u origin main` uploads your commits and sets `origin/main` as the upstream for `main`.

If GitHub prompts for login, use a **Personal Access Token** (HTTPS) or ensure your SSH key is added to GitHub (SSH).

---

## 6. Confirm on GitHub

Refresh the repo page on GitHub. You should see:

- All project files (e.g. `src/`, `package.json`, `index.html`, `README.md`).
- No `node_modules/` or `dist/` (thanks to `.gitignore`).

---

## Quick reference (all commands from `c:\repos\BishopricApp`)

| Step | Command |
|------|---------|
| Init repo | `git init` |
| Stage all | `git add .` |
| First commit | `git commit -m "Initial commit: Bishopric PWA"` |
| Add remote | `git remote add origin https://github.com/USER/REPO.git` |
| Push | `git branch -M main` then `git push -u origin main` |

---

## Troubleshooting

- **"Permission denied" or "Authentication failed"**  
  Use a [Personal Access Token](https://github.com/settings/tokens) instead of your password (HTTPS), or set up [SSH keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

- **"Repository not found"**  
  Check the remote URL: `git remote -v`. Fix with:  
  `git remote set-url origin https://github.com/USER/REPO.git`

- **You already have a parent repo in `C:\repos`**  
  Having `BishopricApp` as its own repo with its own `.git` is fine. The parent repo will just see `BishopricApp` as a folder (or you can add it as a submodule later if you want).

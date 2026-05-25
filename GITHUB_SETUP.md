# GitHub Setup Checklist

This project is ready to publish to GitHub with the following files in place:

- `.gitignore` to exclude build artifacts and secrets
- `.env.example` as the safe environment template
- `README.md` for project overview
- `VERCEL_DEPLOYMENT_GUIDE.md` for deployment steps

## Initialize the repository

If this folder is not yet a git repository:

```bash
git init
```

## First commit flow

```bash
git add .
git commit -m "Initial commit: RIETS platform"
```

## Connect to GitHub

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Before pushing

- Make sure `.env` is never committed
- Keep `DATABASE_URL` only in your local environment or deployment secrets
- Update `.env.example` if you add new environment variables
- Confirm `npm run build` works before release

## Recommended GitHub settings

- Add a repository description
- Enable branch protection on `main`
- Add topics like `react`, `vite`, `express`, `postgresql`, `tailwindcss`

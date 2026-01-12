# Security Remediation Guide

This document provides step-by-step instructions for rotating credentials that may have been exposed in git history and implementing preventive measures against future credential leaks.

**CRITICAL**: Complete ALL steps in this guide. Partial rotation leaves your application vulnerable.

---

## Table of Contents

1. [Git History Cleanup](#1-git-history-cleanup)
2. [Credential Rotation Checklist](#2-credential-rotation-checklist)
3. [Verification Steps](#3-verification-steps)
4. [Prevention Measures](#4-prevention-measures)

---

## 1. Git History Cleanup

If `.env.local` or any file containing secrets was committed to git history, you must remove it completely. Even if the file is now in `.gitignore`, the secrets remain in git history.

### 1.1 Remove Files from Git Cache (Current State Only)

If the file is currently tracked but should not be:

```bash
# Remove .env.local from git tracking (keeps local file)
git rm --cached .env.local

# Commit the removal
git commit -m "Remove .env.local from tracking"
```

**WARNING**: This only removes from current state, NOT from history.

### 1.2 Complete History Rewrite with BFG Repo Cleaner (Recommended)

BFG is faster and simpler than git-filter-branch.

**Step 1: Install BFG**

```bash
# macOS
brew install bfg

# Windows (download JAR)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Linux
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
alias bfg='java -jar bfg-1.14.0.jar'
```

**Step 2: Create a backup**

```bash
# Clone a fresh copy for cleaning
git clone --mirror https://github.com/YOUR_USERNAME/sp-skill.git sp-skill-backup.git
```

**Step 3: Remove sensitive files from history**

```bash
# Navigate to the mirror clone
cd sp-skill-backup.git

# Remove .env files from all history
bfg --delete-files .env.local
bfg --delete-files .env
bfg --delete-files ".env*"

# Alternative: Remove files containing specific patterns
bfg --replace-text passwords.txt  # File containing patterns to redact
```

**Step 4: Clean up and force push**

```bash
# Expire and prune old references
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to remote
git push --force
```

### 1.3 Alternative: git-filter-repo (If BFG Unavailable)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env.local from all history
git filter-repo --path .env.local --invert-paths

# Force push
git push origin --force --all
git push origin --force --tags
```

### 1.4 Team Coordination Warning

**IMPORTANT**: Before force pushing, coordinate with your team:

1. Notify all team members that a force push is coming
2. Have everyone commit and push their current work
3. After force push, all team members must:
   ```bash
   # Delete local repo and re-clone
   cd ..
   rm -rf sp-skill
   git clone https://github.com/YOUR_USERNAME/sp-skill.git

   # OR reset to remote
   git fetch origin
   git reset --hard origin/main
   ```

---

## 2. Credential Rotation Checklist

Rotate ALL credentials, even if you are unsure whether they were exposed. Assume compromise.

### 2.1 Google Gemini API Key

**Dashboard**: https://aistudio.google.com/app/apikey

**Steps**:
1. Go to Google AI Studio
2. Click on "Get API Key" in the left sidebar
3. Find your existing key (it may be listed under a project)
4. Click the trash icon to delete the old key
5. Click "Create API Key" to generate a new one
6. Select your Google Cloud project (or create one)
7. Copy the new key immediately (it will not be shown again)

**Update locations**:
- Vercel Dashboard: Settings > Environment Variables > `GEMINI_API_KEY`
- Local `.env.local` file

**Revocation verification**:
```bash
# Test that old key no longer works
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=OLD_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}'

# Should return: "API key not valid"
```

---

### 2.2 Clerk Authentication Keys

**Dashboard**: https://dashboard.clerk.com/

**Steps for CLERK_SECRET_KEY**:
1. Log in to Clerk Dashboard
2. Select your application
3. Go to "API Keys" in the left sidebar
4. Under "Secret keys", click "Regenerate"
5. Confirm the regeneration
6. Copy the new secret key

**Steps for CLERK_WEBHOOK_SECRET**:
1. Go to "Webhooks" in the left sidebar
2. Select your webhook endpoint
3. Click "Reveal signing secret" then "Regenerate"
4. Update your environment with the new secret

**Steps for VITE_CLERK_PUBLISHABLE_KEY**:
1. The publishable key is public and does not need rotation
2. However, if you want to regenerate, create a new Clerk application

**Update locations**:
- Vercel Dashboard: Settings > Environment Variables
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET`
- Local `.env.local` file

---

### 2.3 Neon PostgreSQL (POSTGRES_URL)

**Dashboard**: https://console.neon.tech/

**Steps**:
1. Log in to Neon Console
2. Select your project
3. Go to "Settings" > "Connection Details"
4. Click "Reset password" under the connection string
5. Confirm password reset
6. Copy the new connection string

**Alternative - Create new role**:
1. Go to "Roles" in the left sidebar
2. Click "New Role"
3. Create a new role with appropriate permissions
4. Update connection string to use new role
5. Delete the old role after confirming new one works

**Update locations**:
- Vercel Dashboard: Settings > Environment Variables > `POSTGRES_URL`
- Local `.env.local` file

**Connection string format**:
```
postgresql://username:password@host.neon.tech:5432/database?sslmode=require
```

---

### 2.4 Upstash Redis (Vercel KV)

**Dashboard**: https://console.upstash.com/

**Steps**:
1. Log in to Upstash Console
2. Select your Redis database
3. Go to "Details" tab
4. Click "Reset Token" or "Rotate Token"
5. Confirm the rotation
6. Copy both `KV_REST_API_URL` and `KV_REST_API_TOKEN`

**If using Vercel KV integration**:
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Storage" tab
4. Select your KV store
5. Click "Settings" > "Rotate Token"
6. Vercel will automatically update the environment variables

**Update locations**:
- Vercel Dashboard: Settings > Environment Variables
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`
- Local `.env.local` file

---

### 2.5 Resend Email API

**Dashboard**: https://resend.com/api-keys

**Steps**:
1. Log in to Resend Dashboard
2. Go to "API Keys" in the left sidebar
3. Click "Create API Key"
4. Give it a descriptive name (e.g., "sp-skill-prod-2024-01")
5. Select appropriate permissions (typically "Full access" or "Sending access")
6. Copy the new API key
7. Delete the old API key

**Update locations**:
- Vercel Dashboard: Settings > Environment Variables > `RESEND_API_KEY`
- Local `.env.local` file

---

### 2.6 Migration Token (Custom Secret)

Generate a cryptographically secure random token:

**Using Node.js**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using OpenSSL**:
```bash
openssl rand -hex 32
```

**Using Python**:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Update locations**:
- Vercel Dashboard: Settings > Environment Variables > `MIGRATION_TOKEN`
- Local `.env.local` file

---

## 3. Verification Steps

### 3.1 Verify New Credentials Work

**Test locally first**:

```bash
# Create or update .env.local with new credentials
# Then run the development server
npm run dev:api

# Test the API endpoint
curl http://localhost:3001/api/health

# Test database connection
npm run db:verify

# Test Gemini API
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "test pattern"}'
```

### 3.2 Update Vercel Environment Variables

**Dashboard**: https://vercel.com/[your-username]/sp-skill/settings/environment-variables

**Steps**:
1. Go to your project in Vercel Dashboard
2. Navigate to Settings > Environment Variables
3. For each credential:
   - Click the edit (pencil) icon
   - Paste the new value
   - Click "Save"
4. **IMPORTANT**: After updating, redeploy:
   ```bash
   vercel --prod
   ```

**Variables to update**:
- `GEMINI_API_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `POSTGRES_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `RESEND_API_KEY`
- `MIGRATION_TOKEN` (if applicable)

### 3.3 Verify Old Credentials Are Revoked

For each service, attempt to use the old credentials:

**Gemini API**:
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=OLD_GEMINI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}'
# Expected: 400 or 401 error
```

**PostgreSQL**:
```bash
psql "postgresql://user:OLD_PASSWORD@host.neon.tech/db" -c "SELECT 1"
# Expected: authentication failure
```

**Redis**:
```bash
curl "https://your-kv-url/get/test" \
  -H "Authorization: Bearer OLD_TOKEN"
# Expected: 401 Unauthorized
```

### 3.4 Production Verification

After deploying with new credentials:

```bash
# Check production health
curl https://sp-skill.vercel.app/api/health

# Test a simple API call
curl -X POST https://sp-skill.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'
```

---

## 4. Prevention Measures

### 4.1 Pre-commit Hook with detect-secrets

**Install detect-secrets**:
```bash
pip install detect-secrets
```

**Initialize baseline**:
```bash
detect-secrets scan > .secrets.baseline
```

**Create pre-commit hook** (`.git/hooks/pre-commit`):
```bash
#!/bin/bash

# Run detect-secrets
detect-secrets-hook --baseline .secrets.baseline $(git diff --staged --name-only)

if [ $? -ne 0 ]; then
    echo "ERROR: Potential secrets detected in staged files!"
    echo "Review the files and either:"
    echo "  1. Remove the secrets"
    echo "  2. Add false positives to .secrets.baseline"
    exit 1
fi
```

**Make executable**:
```bash
chmod +x .git/hooks/pre-commit
```

### 4.2 Pre-commit Hook with gitleaks

**Install gitleaks**:
```bash
# macOS
brew install gitleaks

# Windows (download from releases)
# https://github.com/gitleaks/gitleaks/releases

# Linux
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
```

**Create pre-commit hook** (`.git/hooks/pre-commit`):
```bash
#!/bin/bash

echo "Running gitleaks..."
gitleaks protect --staged --verbose

if [ $? -ne 0 ]; then
    echo "ERROR: gitleaks detected secrets in staged changes!"
    echo "Please remove secrets before committing."
    exit 1
fi

echo "No secrets detected."
```

### 4.3 Using pre-commit Framework

**Install pre-commit**:
```bash
pip install pre-commit
```

**Create `.pre-commit-config.yaml`**:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

**Install the hooks**:
```bash
pre-commit install
```

### 4.4 GitHub Secret Scanning

**Enable for your repository**:

1. Go to your repository on GitHub
2. Navigate to Settings > Security > Code security and analysis
3. Enable:
   - **Dependency graph**: On
   - **Dependabot alerts**: On
   - **Dependabot security updates**: On
   - **Secret scanning**: On
   - **Push protection**: On (blocks pushes containing secrets)

**For organization-wide settings**:
1. Go to Organization Settings
2. Navigate to Code security and analysis
3. Enable for all repositories

### 4.5 Additional .gitignore Entries

Ensure your `.gitignore` includes:

```gitignore
# Environment files
.env
.env.local
.env.*.local
.env.development
.env.production
*.env

# Credential files
credentials.json
service-account.json
*.pem
*.key
*_rsa
*_dsa
*_ecdsa
*_ed25519

# IDE files that might cache secrets
.idea/
.vscode/settings.json

# OS files
.DS_Store
Thumbs.db
```

### 4.6 Environment Variable Best Practices

1. **Never hardcode secrets** in source code
2. **Use environment variables** exclusively for secrets
3. **Use secret managers** for production (Vercel handles this)
4. **Rotate credentials regularly** (every 90 days recommended)
5. **Use least privilege** - create service-specific API keys with minimal permissions
6. **Monitor for leaks** - set up alerts in each service's dashboard
7. **Document rotation procedures** - keep this guide updated

---

## Quick Reference: Service Dashboards

| Service | Dashboard URL | What to Rotate |
|---------|---------------|----------------|
| Google Gemini | https://aistudio.google.com/app/apikey | API Key |
| Clerk | https://dashboard.clerk.com/ | Secret Key, Webhook Secret |
| Neon PostgreSQL | https://console.neon.tech/ | Database Password |
| Upstash Redis | https://console.upstash.com/ | REST Token |
| Resend | https://resend.com/api-keys | API Key |
| Vercel | https://vercel.com/dashboard | Environment Variables |

---

## Emergency Contacts

If you suspect active exploitation of leaked credentials:

1. **Immediately disable** the compromised service/key
2. **Check audit logs** in each service dashboard
3. **Review Vercel deployment logs** for unauthorized access
4. **Check database** for unauthorized data access or modifications
5. **Notify team members** and stakeholders

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-12 | Security Audit | Initial document creation |

---

**REMINDER**: After completing all steps, delete any local files or notes containing old credentials. Clear your terminal history if credentials were pasted:

```bash
# Clear bash history
history -c && history -w

# Clear PowerShell history (Windows)
Remove-Item (Get-PSReadlineOption).HistorySavePath
```

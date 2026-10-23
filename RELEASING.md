# Releasing

Pushing to GitHub doesn't update the Chrome Web Store. Each release has to be uploaded to the store and pass Google's review. After Google approves it, Chrome updates installed copies on its own, usually within a few hours.

The store item ID is `eihlcchoakpglfpkipmbdaeihehoafdm`.

When an agent ships a Better Canvas change for Ali, it also does steps 1 to 4, so the new version waits in the store as a draft. Ali reviews it and clicks Submit for review himself. Agents never click Submit for review or Publish.

## Steps

1. Raise `version` in both `manifest.json` and `manifest.firefox.json`. The store rejects a package whose version isn't higher than the published one. Update the version in the README title and the archive names under Install, and add `docs/release-<version>.txt`.
2. Test and build:
   ```powershell
   npm ci
   npm test
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```
   This writes `dist/Better-Canvas-<version>-Chromium.zip`.
3. Upload that zip to the store item. On LIGHT-VM, use the helper below. By hand, open the developer dashboard, then Better Canvas, Package and Upload new package.
4. If the release adds a permission or a host, write its justification on the Privacy tab. If it changes what data the extension reads, stores or sends, update `PRIVACY.md` and the data boxes on that tab too. Chrome can turn the extension off for existing users until they accept a new permission.
5. Ali submits for review.

## Uploading from LIGHT-VM

The VM keeps a Chrome profile signed in to the publisher account, and scripts that drive it, in `C:\AgentWork\better-canvas-store`. Those files stay out of this repo. Run:

```bash
cd /c/AgentWork/better-canvas-store
bash run-step.sh steps/upload-package.js
```

- The helper waits for the VM desktop lease and then opens that Chrome. It uploads `dist/Better-Canvas-<version>-Chromium.zip` from `C:\Users\alitl\Better-Canvas`, using the version in that checkout's `manifest.json`. If you built somewhere else, set `ZIP` to the zip's full path.
- It prints the zip's version, the draft version before and after the upload, anything that would block submitting, and whether Submit for review is enabled. Then it closes Chrome and releases the lease.
- It exits with 0 only when the draft shows the zip's version. A missing zip, a rejected or stalled upload, or a lost desktop lease exits with 1.
- While a version is in review, the store disables uploads. The helper then exits with 1 and changes nothing.
- If Google has signed the profile out, the helper exits with 2. Run `node signin-viewer.mjs` in that folder and send Ali the link it prints. Google blocks sign-in in automated browsers, so he signs in through that page from his Mac. The page shows a normal Chrome window running on the VM. When the dashboard loads, the viewer closes its Chrome, releases the desktop and exits. It also exits after 30 minutes. Then run the upload again.

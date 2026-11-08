# Cricket Live — Android starter project

A no-login, black-background cricket scores app built with Expo / React Native and a small FastAPI companion backend.

## What's included

- Android-first Expo app with a pure black interface.
- Live / Upcoming / Results tabs.
- Pull-to-refresh and 45-second automatic refresh.
- Match detail view that requests the score endpoint.
- No account, database, or login.
- FastAPI backend with a match-list scraper and score proxy.

## Important data limitation

The linked `mskian/live-cricket-score-api` repository documents a score endpoint for a **known match ID** (`/?score=150294`). It does not document a complete live/upcoming/recent match-list endpoint. This project adds an experimental Cricbuzz HTML match-discovery route. Cricbuzz can change its markup or restrict automated requests, so match discovery may need selector updates and is not guaranteed. The original repository itself states that it is unofficial and intended for educational/personal development use.

The list scraper currently discovers match links and titles; the score API is used to retrieve score details. If the page markup changes, the app will show an honest empty/error state rather than fake scores.

## 1. Deploy backend on Render

1. Create a GitHub repository and upload the contents of this project.
2. In Render, create a **Web Service** and connect the repository.
3. Set the **Root Directory** to `backend`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Choose the Free instance.
7. Deploy and copy the service URL.

### Original score API

The score-detail route proxies the original API. Deploy your own fork of:
https://github.com/mskian/live-cricket-score-api

Use its documented Render start command:
`uvicorn app:app --host 0.0.0.0 --port $PORT`

Then add this environment variable to the companion backend on Render:

`SCORE_API_URL=https://YOUR-ORIGINAL-SCORE-API.onrender.com`

If you deploy both services, the first request after free-tier sleep may take a while.

## 2. Configure the mobile app

1. Open `mobile/src/config.js`.
2. Replace `https://YOUR-BACKEND.onrender.com` with the companion backend URL.
3. Save.

## 3. Run on Android

Install Node.js LTS, then:

```bash
cd mobile
npm install
npx expo start
```

Install **Expo Go** on your Android phone and scan the QR code while your computer and phone are on the same Wi-Fi network.

## 4. Build an installable APK

Install EAS CLI:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

If prompted, use an APK build profile. A typical `eas.json` is:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

When the build finishes, download the APK from the EAS build page and share it with your friend. The app itself does not require sign-in. EAS may require an Expo account to run cloud builds.

## Notes

- This is a starter implementation, not a verified production release.
- Live match discovery and Cricbuzz scraping are dependent on third-party markup and access.
- Review Cricbuzz's terms and usage restrictions before sharing or distributing the app.
- Render free services can sleep when idle. First request after sleep can be slow.

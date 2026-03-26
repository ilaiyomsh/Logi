# 📦 לוג׳י — ניהול לוגיסטיקה פלוגתית

אפליקציה לניהול דרישות אספקה ומשימות לוגיסטיות, עם סנכרון realtime בין כל אנשי הצוות.

## מבנה

- **תצוגת איסוף** — פריטים מקובצים לפי מקור (מאיפה לאסוף)
- **תצוגת חלוקה** — פריטים מקובצים לפי יעד (לאן לחלק)
- **משימות** — פריטים ללא מקור/יעד (מופיעים תמיד למעלה)
- **סטטוסים** — טרם נאסף → נאסף → בוצע (עם מטא-דאטה: מי ומתי)

-----

## התקנה — 3 שלבים

### שלב 1: Firebase

1. היכנס ל-[Firebase Console](https://console.firebase.google.com/)
1. לחץ **Add project** → תן שם (למשל `logi`) → צור
1. בתפריט הצדדי: **Build → Realtime Database → Create Database**
1. בחר מיקום (europe-west1 מומלץ) → **Start in test mode** → Enable
1. בתפריט הצדדי: **Project settings** (גלגל השיניים) → גלול למטה → **Add app** → בחר Web (אייקון `</>`)
1. תן שם (למשל `logi-web`) → **Register app**
1. תקבל בלוק `firebaseConfig` — **שמור את הערכים**, תצטרך אותם בשלב הבא

#### אבטחה (אופציונלי אבל מומלץ)

ב-Realtime Database → Rules, החלף את ה-rules ב:

```json
{
  "rules": {
    "logistics": {
      ".read": true,
      ".write": true
    }
  }
}
```

> ⚠️ `test mode` פתוח לכולם ופג תוקף אחרי 30 יום. לשימוש ממושך, שקול להוסיף Authentication.

### שלב 2: Vercel

1. העלה את הפרויקט ל-GitHub (ריפו חדש)
1. היכנס ל-[Vercel](https://vercel.com) → **Add New Project** → ייבא את הריפו
1. לפני Deploy, ב-**Environment Variables** הוסף את הערכים מ-Firebase:

|Variable                           |ערך              |
|-----------------------------------|-----------------|
|`VITE_FIREBASE_API_KEY`            |מה-firebaseConfig|
|`VITE_FIREBASE_AUTH_DOMAIN`        |מה-firebaseConfig|
|`VITE_FIREBASE_DATABASE_URL`       |מה-firebaseConfig|
|`VITE_FIREBASE_PROJECT_ID`         |מה-firebaseConfig|
|`VITE_FIREBASE_STORAGE_BUCKET`     |מה-firebaseConfig|
|`VITE_FIREBASE_MESSAGING_SENDER_ID`|מה-firebaseConfig|
|`VITE_FIREBASE_APP_ID`             |מה-firebaseConfig|

1. לחץ **Deploy**

### שלב 3: שימוש

שתף את ה-URL שקיבלת מ-Vercel עם הצוות. כל אחד נכנס עם השם שלו ורואה את אותם נתונים ב-realtime.

-----

## פיתוח מקומי

```bash
# התקנה
npm install

# צור קובץ .env מהדוגמה והוסף את ערכי Firebase
cp .env.example .env

# הרצה
npm run dev
```

-----

## מבנה קבצים

```
├── index.html          # HTML ראשי
├── package.json
├── vite.config.js
├── .env.example        # תבנית environment variables
├── .gitignore
└── src/
    ├── main.jsx        # Entry point
    ├── firebase.js     # Firebase init + read/write
    └── App.jsx         # כל הלוגיקה וה-UI
```

## טכנולוגיות

- **React 18** + **Vite** — פרונטאנד
- **Firebase Realtime Database** — סנכרון נתונים
- **Vercel** — hosting

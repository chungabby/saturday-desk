# It’s saturday 工作台

品牌內部用的工作台：今日日期、嗨老闆每日一句，以及常用連結捷徑。分成老闆版和員工版，都要用 Google 帳號登入。

- 老闆版：只有 `chungabb4@gmail.com` 可以登入，可以編輯老闆版和員工版。
- 員工版：`its.saturday.2021@gmail.com` 可以看（不能編輯）；老闆也能進來管理。

---

## 安全設計

這個網站放在 GitHub Pages，**程式碼是公開的**，所以程式碼裡不放任何捷徑連結。

1. 所有捷徑存在 Firebase Firestore 雲端資料庫。
2. `firestore.rules` 規定只有上面兩個 Google 帳號讀得到，且員工只能讀員工版。這道門鎖在 Google 的伺服器上，改網頁程式碼也繞不過去。
3. 登入畫面會再檢查一次帳號，不符合的帳號會被立刻登出。
4. 網頁加了內容安全政策（CSP），只允許載入 Google/Firebase 與字型的資源。
5. `private-seed/` 裡的初始資料含有連結，已列在 `.gitignore`，**不要上傳到 GitHub**。

> 提醒：工作台只決定「看得到哪些捷徑」。Google 試算表、雲端資料夾本身的分享權限，還是要在各自的共用設定裡管理。只要員工拿到網址又有檔案權限，就打得開。

---

## 上線步驟（第一次，約 20 分鐘）

### 1. 建立 Firebase 專案
1. 到 https://console.firebase.google.com ，用 `chungabb4@gmail.com` 登入。
2. 「新增專案」，名稱例如 `saturday-desk`。Google Analytics 可以關掉。
3. 免費的 Spark 方案就夠用。

### 2. 開啟 Google 登入
1. 左側「建構 → Authentication」→「開始使用」。
2. 「登入方式」→ 選「Google」→ 啟用 → 專案支援電子郵件選 `chungabb4@gmail.com` → 儲存。

### 3. 加入授權網域
1. Authentication →「設定」→「授權網域」→「新增網域」。
2. 輸入 `chungabby.github.io` → 新增。

### 4. 建立資料庫
1. 左側「建構 → Firestore Database」→「建立資料庫」。
2. 位置選 `asia-east1 (台灣)`。
3. 選「**以正式版模式啟動**」（預設全部拒絕）。
4. 建立後切到「規則」分頁，把 `firestore.rules` 的內容整份貼上，按「發布」。

### 5. 取得設定值
1. 左上齒輪 →「專案設定」→「一般」→ 下方「你的應用程式」→ 點網頁圖示 `</>`。
2. 暱稱填 `saturday-desk`，**不用**勾 Firebase Hosting → 註冊。
3. 會看到一段 `const firebaseConfig = { ... }`，把裡面的值照著填進 `firebase-config.js`。

### 6. 上傳到 GitHub
1. 到 https://github.com/new ，Repository name 填 `saturday-desk`，選 Public → Create。
2. 點「uploading an existing file」，把以下檔案拖進去（**不要**拖 `private-seed` 資料夾）：
   - `index.html`、`styles.css`、`app.js`、`firebase-config.js`、`firestore.rules`、`README.md`、`.gitignore`
3. Commit changes。
4. 到 repo 的「Settings → Pages」→ Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾 `/ (root)` → Save。
5. 等 1～2 分鐘，網址會是：**https://chungabby.github.io/saturday-desk/**

### 7. 匯入捷徑（只要做一次）
1. 打開網址，選「老闆」→ 用 `chungabb4@gmail.com` 登入。
2. 畫面會顯示「這個版本還沒有捷徑」→「選擇檔案匯入」→ 選 `private-seed/boss.json`。
3. 左側切到「員工版」→ 同樣匯入 `private-seed/staff.json`。
4. 完成後，`private-seed` 可以刪掉或存在自己電腦就好。

如果你在預覽版上已經調整過捷徑，想沿用那份：到預覽版按右上設定 →「複製備份」，再到正式網站的設定裡貼上 →「匯入」。

### 8. 測試
- 用員工帳號選「員工」登入 → 應該只看到員工版，沒有編輯按鈕。
- 用員工帳號選「老闆」登入 → 應該被擋下並自動登出。
- 用其他 Google 帳號登入 → 應該被擋下。

---

## 加強防護（建議，選做）

**A. 關閉新帳號註冊**
兩個帳號都各登入過一次後，到 Authentication →「設定」→「使用者動作」，取消勾選「啟用建立（註冊）」。之後除了這兩個帳號，任何人都無法在這個專案建立帳號。

**B. 限制 API 金鑰只能從你的網站使用**
1. 到 https://console.cloud.google.com/apis/credentials ，上方選擇同一個專案。
2. 點「Browser key (auto created by Firebase)」。
3. 「應用程式限制」選「網站」，加入：
   - `https://chungabby.github.io/*`
   - `https://你的專案ID.firebaseapp.com/*`
4. 儲存。設定後如果登入失敗，先檢查這裡的網址有沒有打錯。

**C. 檢查 Google 檔案的共用權限**
把只給老闆看的試算表（會計、發票、薪資、廣告）設為「限制」，只分享給需要的人。

---

## 日常使用

- 老闆可以在任何裝置登入，修改會即時同步到所有已登入的裝置。
- 老闆在左側可切換「老闆版 / 員工版」，員工版的捷徑也是由老闆編輯。
- 設定裡的「複製備份」可以把目前版本的捷徑存一份起來，建議偶爾備份。

## 以後要改帳號

換 Email 時，兩個地方都要改，而且要一致：
1. `firestore.rules` 裡的 Email → 貼回 Firebase 規則頁並發布。
2. `app.js` 最上方的 `BOSS_EMAIL`、`STAFF_EMAIL` → 上傳到 GitHub。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面結構與登入畫面 |
| `styles.css` | 樣式 |
| `app.js` | 登入、權限判斷、雲端同步與工作台功能 |
| `firebase-config.js` | Firebase 專案設定（要自己填） |
| `firestore.rules` | 資料庫安全規則（貼到 Firebase） |
| `private-seed/` | 初始捷徑資料，**不上傳** |

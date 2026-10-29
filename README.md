# dailyReminder

毎日決まった時刻に、当日のリマインダーをDiscordのチャンネルへ送るCloudflare Workersのアプリ。リマインダーの設定は暗号化して、Workerのシークレットに保存する。

## 特徴

- 毎日、日本時間の午前3時に、当日が対象のリマインダーをDiscordのWebhookで送る。対象のリマインダーが無い日は「本日のリマインド事項はありません」を送る
- 繰り返しは6種類: カウントダウン・毎年・毎月・毎週・第n週・最終週
- `/manual-trigger`にPOSTすると、実行した日の分をすぐに送る
- GitHub Actionsで、`main`へのpushのたびにデプロイする

## 必要なもの

- Cloudflareのアカウント
- 自分のGitHubの空のリポジトリ
- 送り先のチャンネルのWebhook URL
- Node.js 20.18.1以上と、ログイン済みのGitHub CLI(`gh`)

## セットアップ

1. cloneして、pushする先を自分のリポジトリに変え、依存を入れる

   ```bash
   git clone https://github.com/ycookiey/dailyReminder.git
   cd dailyReminder
   git remote set-url origin <自分のリポジトリのURL>
   npm install
   ```

2. `.env.example`を`.env`に、`reminders.example.json`を`reminders.json`にコピーする。`.env`に次の値を書く

   - `DISCORD_WEBHOOK_URL`: 送り先のWebhook URL
   - `MANUAL_TRIGGER_SECRET_KEY`: 手動で送るときの認証に使う、推測されにくい文字列
   - `ENCRYPTION_SECRET_KEY`: 設定の暗号化の鍵。`npm run encrypt`を`ENCRYPTION_SECRET_KEY`の環境変数なしで実行すると、新しい鍵を表示する
   - `CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`: GitHub Actionsからデプロイするための、CloudflareのAPIトークンとアカウントID
   - `WORKER_URL`: デプロイした後のWorkerのURL。最初のデプロイまでは空のままにする

3. `npx wrangler login`でCloudflareにログインし、`npm run setup-secrets`で`.env`の値をGitHubのリポジトリのシークレットに登録する
4. `npm run deploy`を実行する。`reminders.json`を暗号化して`encrypted-reminders.json`に保存し、Workerのシークレットと、GitHubのリポジトリのシークレットを更新してから、commitしてpushする。pushを受けて、GitHub ActionsがWorkerをデプロイする
5. 最初のデプロイの後、`.env`に`WORKER_URL`を書き、もう一度`npm run setup-secrets`を実行する。`WORKER_URL`を登録すると、GitHub Actionsはデプロイの後に`/health`の応答を確認する

## 使い方

### リマインダーの設定

`reminders.json`に書く。形式は`schemas/reminders.schema.json`、例は`reminders.example.json`を参照。書き換えた後は`npm run deploy`で反映する。

| キー | 送る日 | 必須の項目 |
|---|---|---|
| `countdowns` | `targetDate`の前日まで毎日。下の注意を参照 | `name`・`targetDate` |
| `yearlyTasks` | 毎年`month`月`day`日 | `name`・`month`・`day` |
| `monthlyTasks` | 毎月`day`日。`day`日が無い月は月末 | `name`・`day` |
| `weeklyTasks` | `dayOfWeek`の配列にある曜日 | `name`・`dayOfWeek` |
| `specificWeekTasks` | 毎月`week`回目の`dayOfWeek`曜日。`week`回目が無い月は最後の`dayOfWeek`曜日 | `name`・`week`・`dayOfWeek` |
| `lastWeekTasks` | 毎月最後の`dayOfWeek`曜日 | `name`・`dayOfWeek` |

- 6つのキーはすべて書く。使わないキーは空の配列`[]`にする。キーが1つでも無いと、`npm run deploy`は暗号化の検証で失敗する
- `targetDate`は`2025-03-31`の形で書く
- `dayOfWeek`は0が日曜、6が土曜
- `enabled`: `false`にすると送らない。既定は`true`
- `message`: 送る文。省くと`name`から作った既定の文を送る。`countdowns`では、`{days}`を残りの日数に置き換える

### 手動で送る

`.env`に`WORKER_URL`を書いてから実行する。

```bash
npm run test-production
```

`curl`で送る場合:

```bash
curl -X POST https://daily-reminder.<サブドメイン>.workers.dev/manual-trigger \
  -H "Authorization: Bearer <MANUAL_TRIGGER_SECRET_KEY>"
```

### ログ

```bash
npx wrangler tail
```

## 注意

- 当日かどうかは日本時間の日付で決める。送る時刻は`wrangler.toml`の`crons`で変更できる。`crons`の時刻はUTCで書く
- カウントダウンの残りの日数は、実際より1日少なく出る。目標日の前日に「本日が〜です！」を送り、目標日の当日は送らない
- `npm run deploy`は`encrypted-reminders.json`と`src/`の変更をcommitし、`origin`の`main`にpushする。公開のリポジトリでは、コードと同じく暗号化した設定も公開される。このリポジトリをGitHubでforkした場合、forkは非公開にできない
- リポジトリにある`encrypted-reminders.json`は作者の設定で、自分の鍵では復号できない。最初の`npm run deploy`より前にpushすると、GitHub Actionsの設定の検証で失敗する
- `ENCRYPTION_SECRET_KEY`は先頭の32文字だけを使う。32文字より短い鍵は、末尾を`0`で埋めて使う
- Workerはリマインダーの内容をログに出力する。`wrangler.toml`で`observability`を有効にしているため、ログはCloudflareに残る
- 処理に失敗すると、エラーの文をDiscordのチャンネルに送る

## アンインストール

1. `npx wrangler delete`でWorkerを削除する
2. Discordのチャンネルの設定から、Webhookを削除する
3. GitHubのリポジトリのシークレットを削除し、CloudflareのAPIトークンを無効にする

## ビルド

```bash
npm ci
npx wrangler deploy --dry-run
```

手元で動かすときは、シークレットを`--var`で渡す。`<暗号文>`は`encrypted-reminders.json`の`encrypted`の値。

```bash
npx wrangler dev --test-scheduled \
  --var DISCORD_WEBHOOK_URL:<Webhook URL> \
  --var ENCRYPTION_SECRET_KEY:<鍵> \
  --var ENCRYPTED_REMINDERS_CONFIG:<暗号文> \
  --var MANUAL_TRIGGER_SECRET_KEY:<文字列>
curl "http://localhost:8787/__scheduled?cron=0+18+*+*+*"
```

## ライセンス

[MIT License](LICENSE)

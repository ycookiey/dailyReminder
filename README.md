# Daily Reminder System

毎日定刻にDiscordの特定チャンネルへリマインダーを自動通知するシステムです。Cloudflare Workersで動作し、暗号化された設定ファイルで安全にリマインダーを管理できます。

## 特徴

- **毎日 午前3時（日本時間）** に自動実行
- **Discord Webhook** による通知
- **暗号化された設定ファイル** でセキュアな設定管理
- **GitHub Actions** による自動デプロイ
- **手動実行機能** でデバッグ・テストが可能
- 6種類のリマインダータイプをサポート

## リマインダータイプ

### 1. カウントダウン
指定した目標日に向けて、残日数を毎日通知。目標日を過ぎたリマインダーは自動的に通知対象外。

### 2. 毎年のタスク
毎年決まった日付にタスクや記念日を通知。

### 3. 毎月のタスク
毎月決まった日にタスクを通知。指定した日が存在しない月では、その月の最終日に通知。

### 4. 毎週のタスク
毎週決まった曜日にタスクを通知。

### 5. 特定週のタスク
「第n週目のm曜日」といった指定でタスクを通知。指定した週が存在しない月では、その月の最終の該当曜日に通知。

### 6. 最終週のタスク
「毎月最終金曜日」のように、月の最終週の特定の曜日にタスクを通知。

## セットアップ

### 1. 必要なアカウント・サービス

- [Cloudflare](https://cloudflare.com) アカウント
- [GitHub](https://github.com) アカウント
- Discord Webhook URL

### 2. リポジトリの準備

```bash
git clone <this-repository>
cd daily-reminder
npm install
```

### 3. 環境変数の設定

`.env.example` を `.env` にコピーして編集：

```bash
cp .env.example .env
```

```env
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
MANUAL_TRIGGER_SECRET_KEY="your-strong-secret-key-for-manual-trigger"
ENCRYPTION_SECRET_KEY="your-strong-encryption-key-32-chars-long"
```

### 4. リマインダー設定

`reminders.example.json` を `reminders.json` にコピーして編集：

```bash
cp reminders.example.json reminders.json
```

### 5. Cloudflare Workers の設定

```bash
# Wranglerにログイン
npx wrangler login
```

### 6. GitHub Secrets の設定

#### 自動設定（推奨）

```bash
# GitHub CLI (gh) がインストール済みで、認証が完了している場合
npm run setup-secrets
```

#### 手動設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`  
- `DISCORD_WEBHOOK_URL`
- `MANUAL_TRIGGER_SECRET_KEY`
- `ENCRYPTION_SECRET_KEY`
- `WORKER_URL` (デプロイ後のWorker URL)

## デプロイ

```bash
# 通常のデプロイ
npm run deploy

# Cloudflare Workers Secretsを強制更新してデプロイ
npm run deploy:force
```

このコマンドで以下の処理が自動実行されます：

1. `.env` ファイルの読み込み
2. `reminders.json` の暗号化
3. Cloudflare Workers Secrets の更新
4. GitHubへのプッシュ
5. GitHub Actions による自動デプロイ

**注意**: `deploy:force` は既存のCloudflare Workers Secretsを強制的に更新します。通常は `npm run deploy` を使用してください。

## 本番環境テスト

### 本番リマインダーの手動実行

デプロイ済みのCloudflare Workerを手動でテスト実行できます：

```bash
# 本番環境フルテスト（ヘルスチェック + リマインダー実行）
npm run test-production

# ヘルスチェックをスキップしてリマインダー実行
npm run test-production -- --skip-health

# ヘルスチェック失敗でも強制実行
npm run test-production -- --force

# ヘルプ表示
npm run test-production -- --help
```

**テスト内容:**
1. Worker URL自動取得（.env または GitHub Secrets から）
2. Worker ヘルスチェック（`/health` エンドポイント）
3. 本番リマインダー実行（今日の日付で実行）
4. 実行結果表示とDiscord通知確認案内

**必要な設定:**
- `MANUAL_TRIGGER_SECRET_KEY`: .envファイルに設定済み
- `WORKER_URL`: .envまたはGitHub Secretsに設定（オプション、未設定時は案内表示）

### 直接cURLでの実行

スクリプトを使わずに直接実行する場合：

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/manual-trigger \
  -H "Authorization: Bearer your-manual-trigger-secret-key"
```

## スクリプト

- `npm run deploy` - フルデプロイプロセスの実行
- `npm run deploy:force` - Cloudflare Workers Secretsを強制更新してデプロイ
- `npm run encrypt` - 設定ファイルの暗号化のみ実行
- `npm run validate` - 設定ファイルの検証
- `npm run setup-secrets` - GitHub Secretsの自動設定
- `npm run force-update-secrets` - Cloudflare Workers Secretsの強制更新
- `npm run test-production` - 本番環境リマインダーテスト実行
- `npm run dev` - ローカル開発モード
- `npm test` - テストの実行

## トラブルシューティング

### よくある問題

1. **暗号化キーエラー**
   - `ENCRYPTION_SECRET_KEY` が正しく設定されているか確認
   - キーは32文字以上である必要があります

2. **Discord通知が届かない**
   - Webhook URLが正しいか確認
   - Discordサーバーの権限設定を確認

3. **デプロイエラー**
   - GitHub Secretsが正しく設定されているか確認
   - Cloudflare API トークンの権限を確認
   - Cloudflare Workers Secretsの更新に失敗した場合は `npm run force-update-secrets` を実行

### ログの確認

```bash
# Cloudflare Workers のログを確認
npx wrangler tail

# GitHub Actions のログはリポジトリのActionsタブで確認
```

## 設定ファイルの例

詳細な設定例は `reminders.example.json` を参照してください。

各リマインダーには以下のオプション設定が可能です：

- `enabled`: 通知の有効/無効（デフォルト: true）
- `message`: カスタムメッセージ（指定がない場合はデフォルトメッセージ）

## ライセンス

MIT License
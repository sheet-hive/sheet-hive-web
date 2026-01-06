# Sheet-hive Web

Sheet-hive は、業務で頻発する  
「表データの入力・検証・加工」を安全に行うためのツールです。

単純な自動化ではなく、
- 入力ミスを防ぐ
- 後工程で壊れないデータを作る  
ことを重視しています。

## Design Policy

本プロジェクトでは、以下を重視して設計しています。

- UI / 入力検証 / データアクセスの責務分離
- 実運用を想定した「壊れにくさ」
- 自動生成コードを前提とせず、設計とレビューを重視

## Tech Stack

- Next.js (App Router)
- TypeScript
- Firebase Authentication
- Google Sheets API

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install (monorepo)

このリポジトリ構成では `web/` が `shared/` を参照します。

```bash
cd web
npm ci
npm ci --prefix ../shared
```

### Run (local)

```bash
cd web
npm run dev
```

- Dev server: http://localhost:3005

### Build

```bash
cd web
npm run build
```

## Demo Mode

デモ用途では外部サービス接続なしで動作させます。

- Environment variable: `NEXT_PUBLIC_APP_MODE=demo`
- 特徴:
	- 認証なし（デモユーザー）
	- Google Sheets / Firebase などの外部依存なし
	- データは `localStorage` ベース
	- `/api/sheets/*` の API ルートは demo では利用しません（404 を返します）

## Environment Variables

### Web (Firebase client)

本番/開発で Firebase を使う場合は以下を設定します（`.env.local` など）。

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`（任意）

### Server (Firebase Admin)

Google Sheets API を叩く `/api/sheets/*` を本番で利用する場合、サーバー側に Firebase Admin の設定が必要です。

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`（`\n` を含む場合があるので注意）

# ローカル開発環境セットアップ

このファイルは eholo.acti-dev.net 環境専用の設定です。

## セットアップ手順

1. SSL証明書を生成:

```bash
mkdir -p .cert
openssl req -x509 -newkey rsa:2048 -keyout .cert/key.pem -out .cert/cert.pem -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Development/CN=eholo.acti-dev.net"
```

2. `vite.config.local.js` をコピーして作成（既に.gitignoreに含まれています）

3. ローカル開発サーバーを起動:

```bash
npm run dev:local
```

## ドメイン設定

eholo.acti-dev.net ドメインでアクセスする場合:
- サーバーは `0.0.0.0:5173` でリッスンします
- **HTTPS** で動作します（自己署名証明書）
- 外部からのアクセスが可能です

## 注意事項

- `vite.config.local.js` と `.cert/` ディレクトリはGitリポジトリには含まれません
- 自己署名証明書のため、ブラウザで警告が表示されます（開発環境では無視してOK）
- 本番デプロイには標準の `vite.config.js` が使用されます

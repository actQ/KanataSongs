# ローカル開発環境セットアップ

このファイルは eholo.acti-dev.net 環境専用の設定です。

## セットアップ手順

1. `vite.config.local.js` をコピーして作成（既に.gitignoreに含まれています）
2. ローカル開発サーバーを起動:

```bash
npm run dev:local
```

## ドメイン設定

eholo.acti-dev.net ドメインでアクセスする場合:
- サーバーは `0.0.0.0:5173` でリッスンします
- 外部からのアクセスが可能です

## 注意事項

- `vite.config.local.js` はGitリポジトリには含まれません
- 本番デプロイには標準の `vite.config.js` が使用されます

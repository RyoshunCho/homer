# config編集機能追加指示書



## 前提

- 本プロジェクトは remote repository に push されると自動的に edgeone pages にデプロイされることになっている。

  - Cloudflare pages にはデプロイしていない。

- ドメインは https://nav.lodgegeek.com

- \public\assets\config.yml について現在 couldflare R2上で管理している。

  - R2_ACCESS_KEY_ID: 8d620a37d3948a50a013ff9bbe858893

  - R2_SECRET_ACCESS_KEY: f3e0e9fd2a09ca853ad66301c91c7bd7d8b479695465c8dbb3cc5f3aa0d47673

  - R2 Account ID: 8051337e46fa041f11d59bbff3ea3f8f

  - S3 API 互換のR2 API endpoint: https://8051337e46fa041f11d59bbff3ea3f8f.r2.cloudflarestorage.com

  - R2 Bucket 名: [homer-config](https://dash.cloudflare.com/8051337e46fa041f11d59bbff3ea3f8f/r2/default/buckets/homer-config)

  - [config.yml](https://dash.cloudflare.com/8051337e46fa041f11d59bbff3ea3f8f/r2/default/buckets/homer-config/objects/config.yml/details)のパブリック開発 URL: https://pub-40e4e971626a41c7848a9726fd3fad92.r2.dev/config.yml

    

- この方式をけっこう気に入っているから、今後もずっとこうする。

  - KVに保存するかどうかという議論はあったが、KVに保存しないことにします。



## config編集機能追加要件

- Monaco Editor を導入し、オンラインでcouldflare R2上で管理しているconfig.yml を編集可能とする。

- Monaco Editor でSaveボタンを押下することで、couldflare R2上で管理しているconfig.yml を最新状態で保存する。

  - 旧バージョンはバックアップとして、同じR2 Bucket に別名で保存する。

- Monaco Editor を開けるユーザはadmin user （複数可）とする。

  - admin userについては、環境変数にその enterprise emailを保存し、ログインユーザのemail (enterprise_email)と照らし合わせて、判定する。

    

## Coding上の注意点

- 特定のソースコードファイルを肥大化しないでください。
- 適切にリファクタリングしてください。
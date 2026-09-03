# POCHO LAB v0.8.1

- v0.8で `seedInitialBoard()` の呼び出しが抜け、`initializingBoard` が true のまま残って全接触判定が停止していた不具合を修正。
- 初期7体をイベント登録後に生成・安定化し、その後に反応判定を有効化。
- 自動シミュレーションと観察モードの両方に同修正が適用される。
- キャッシュ回避のため `lab_v081.js` / `observer_v081.js` を使用。

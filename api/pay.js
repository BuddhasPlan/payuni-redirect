const crypto = require('crypto');

module.exports = function handler(req, res) {
  try {
    const {
      name   = '',
      email  = '',
      amount = '0',
      tradeNo,
      itemDesc = '活動票券'
    } = req.query;

    const MER_ID   = process.env.PAYUNI_MER_ID;
    const HASH_KEY = process.env.PAYUNI_HASH_KEY;
    const HASH_IV  = process.env.PAYUNI_HASH_IV;
    const RETURN_URL = process.env.RETURN_URL || 'https://nine-raver-797.notion.site/2026-Night-Live-TalkShow-35046ba8111f8067b62ecd80d21dd879';
    const NOTIFY_URL = process.env.NOTIFY_URL || '';

    // ── 組合要加密的參數 ──
    const tradeParams = {
      MerID:     MER_ID,
      TradeNo:   tradeNo,
      Timestamp: Math.floor(Date.now() / 1000).toString(),
      UniAmt:    parseInt(amount),
      ItemDesc:  itemDesc,
      ReturnURL: RETURN_URL,
      Email:     email,
      PayerName: name,
    };
    if (NOTIFY_URL) tradeParams.NotifyURL = NOTIFY_URL;

    // ── AES-256-GCM 加密 ──
    const key    = Buffer.from(HASH_KEY.padEnd(32).slice(0, 32), 'utf8');
    const iv     = Buffer.from(HASH_IV.padEnd(16).slice(0, 16),  'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const jsonStr = JSON.stringify(tradeParams);
    const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
cipher.getAuthTag(); // 仍需呼叫，但不納入 EncryptInfo
// 只傳密文，不含 auth tag（符合 PAYUNi PHP SDK 格式）
const encryptInfo = encrypted.toString('base64');

    // ── HashInfo：SHA256(HashKey + EncryptInfo + HashIV) ──
const hashInfo = crypto
  .createHash('sha256')
  .update(HASH_KEY + encryptInfo + HASH_IV)
  .digest('hex')
  .toUpperCase();
     

    // ── 回傳自動提交的 HTML 表單 ──
    const payuniUrl = 'https://api.payuni.com.tw/api/upp';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>跳轉付款中...</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 60px 20px; color: #555; }
    .loader { border: 4px solid #f3f3f3; border-top: 4px solid #e85d04;
              border-radius: 50%; width: 40px; height: 40px;
              animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader"></div>
  <p>正在跳轉到付款頁面，請稍候...</p>
  <form id="payForm" method="POST" action="${payuniUrl}">
  <input type="hidden" name="MerID"       value="${MER_ID}">
  <input type="hidden" name="Version"     value="1.0">
  <input type="hidden" name="EncryptInfo" value="${encryptInfo}">
  <input type="hidden" name="HashInfo"    value="${hashInfo}">
</form>
  <script>
    window.onload = function() { document.getElementById('payForm').submit(); };
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);

  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
};

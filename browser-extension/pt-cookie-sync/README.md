# PT Cookie Sync Extension

Chrome / Edge MV3 extension used by this project to sync cookies from the current PT site back to the local backend.

## Load extension

1. Open `chrome://extensions` or `edge://extensions`
2. Enable developer mode
3. Click `Load unpacked`
4. Select this folder:

```text
browser-extension/pt-cookie-sync
```

## Configure

Open the extension options page and fill in:

- `Server URL`
  - Example: `http://127.0.0.1:5173/api/extension/site-cookie-sync`
- `Sync Key`
  - Copy it from `站点设置 -> 浏览器扩展接入`

## Use

1. Add the PT site in `站点设置`
2. Make sure the site URL matches the real PT domain
3. Log in to the PT site in the browser
4. Click the extension and run `同步当前站点`
5. Return to `我的数据` and click refresh

## Notes

- The backend matches sites by hostname
- The extension only uploads cookies for the current tab URL
- If the backend cannot match a configured site, sync will fail with `No configured site matched this URL`

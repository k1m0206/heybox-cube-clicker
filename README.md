# 盒子点点乐

基于 Vue 3、TypeScript、Vite 和小黑盒小程序 SDK 的点击养成小游戏。

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm test
npm run typecheck
npm run build
```

`npm run deploy` 会调用小黑盒 SDK 的远端发布能力，请仅在已登录且明确准备发布时执行。

## 小黑盒排行榜配置

在小黑盒开放平台为本小程序创建排行榜：

- Key：`cube_clicker_level`
- 排序：降序（等级越高，排名越靠前）
- 建议展示上限：100

榜单分数为玩家等级，附加信息包含 `level`、`nickname` 和 `avatar`。

## 许可证与素材

项目代码使用 [MIT License](LICENSE)。第三方依赖和素材遵循各自许可证；素材来源及适用范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。小黑盒表情素材不包含在 MIT 授权范围内，公开分发或再利用前需自行确认平台授权。

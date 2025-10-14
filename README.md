# Solara Apple Music Web Player

高仿 Apple Music iPad 播放界面的云端播放器，基于 [Vite](https://vite.dev/) + React + TypeScript 构建，默认使用 [GD Studio 音乐平台 API](https://music-api.gdstudio.xyz/api.php) 作为曲库来源，可直接部署到 Cloudflare Pages。

## ✨ 功能概览

- 🎵 Apple Music 风格的沉浸式播放界面：双列布局、玻璃拟态与动态背景
- 🔍 实时搜索网易云等音乐源的歌曲（默认 `netease`，可扩展）
- ▶️ 音乐播放控制：播放 / 暂停、上一首 / 下一首、进度条、音量调节
- 📃 同步歌词：高亮当前行，支持原文 + 翻译
- 🖼️ 自动拉取专辑封面，并用于动态背景模糊
- ☁️ 针对 Cloudflare Pages 优化的静态构建与缓存策略

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 本地开发（默认 http://localhost:5173 ）
npm run dev

# 生产构建
npm run build

# 构建产物预览
npm run preview
```

## 🧠 重要约定

- **音乐源**：默认使用 `netease`，可在 `src/App.tsx` 中修改常量 `DEFAULT_SOURCE`
- **API 频率限制**：GD Studio 限定 5 分钟内不超过 60 次请求，建议避免频繁触发搜索
- **歌词解析**：支持原文与翻译的 LRC 时间轴，位置见 `src/utils/lyrics.ts`

## ☁️ 部署到 Cloudflare Pages

1. 将本仓库推送到自己的 GitHub/GitLab
2. 在 Cloudflare Pages 中新建项目并选择该仓库
3. 构建命令设置为 `npm run build`
4. 构建输出目录设置为 `dist`
5. 其余保持默认即可，部署完成后即可在自定义域名访问

## 🛠️ 项目结构

```
├── public/              # 静态资源
├── src/
│   ├── App.tsx          # 主界面与播放器逻辑
│   ├── App.css          # Apple Music 风格样式
│   ├── index.tsx        # 入口文件
│   ├── index.css        # 全局基础样式
│   └── utils/
│       └── lyrics.ts    # LRC 解析与合并工具
├── vite.config.ts       # Vite 配置
├── package.json
└── README.md
```

## 🧾 开源许可

本项目基于 MIT License 发布。使用第三方 API 时请遵守其使用条款，并尊重版权。

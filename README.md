# Gemini Question Navigator

在 Gemini 聊天页右侧显示提问导航栏，长对话中快速定位任意一次提问。

## 安装（收到 zip 的用户）

1. 解压 zip 到任意文件夹
2. 双击 `install.bat`，选择你的浏览器
3. 浏览器扩展页会自动打开，按屏幕提示：
   - 打开「开发人员模式」
   - 点击「加载解压缩的扩展」
   - 选择你解压出来的这个文件夹
4. 打开 gemini.google.com，侧栏自动出现

## 功能

- 右侧导航栏：序号 + 提问前缀 + 相对时间
- 点击跳转到对应提问，悬停实时高亮
- 搜索框过滤提问，收藏重要提问（★）
- `Ctrl+Shift+Q` 快捷键切换侧栏
- 新消息自动追加，长对话虚拟渲染

## 打包分发（开发者）

双击 `build.bat`，会在上层目录生成 `Gemini-Question-Navigator.zip`，直接发给别人即可。

## 说明

如识别不到提问，在 `src/utils/selectors.js` 的 `DIRECT_USER_SELECTORS` 数组中补充选择器。

# Auto Editor (MVP)

一个本地离线的自动剪辑脚本，面向 16:9、1-5 分钟成片，支持多种风格：
`fast`（节奏快切片）、`narration`（解说型）、`tutorial`（教程型）、`montage`（混剪型）。

## 依赖

- 已安装 `ffmpeg`（包含 `ffprobe`），并已加入系统 PATH
- Python 3.9+

## 快速开始

在仓库根目录执行：

```
python auto-editor/auto_editor.py --input "C:\path\video1.mp4" --style fast --output "C:\path\out.mp4"
```

带脚本自动出字幕：

```
python auto-editor/auto_editor.py --input "C:\path\video1.mp4" --style narration --script "C:\path\script.txt" --output "C:\path\out.mp4"
```

仅用脚本生成视频（自动配背景 + 字幕 + 可选配音）：

```
python auto-editor/auto_editor.py --script "C:\path\script.txt" --tts --output "C:\path\out.mp4"
```

仅用脚本 + 自动配图 + BGM：

```
python auto-editor/auto_editor.py --script "C:\path\script.txt" --bg-dir "C:\path\images" --bgm "C:\path\bgm.mp3" --output "C:\path\out.mp4"
```

更智能配图（同义词/关键词词典）：

```
python auto-editor/auto_editor.py --script "C:\path\script.txt" --bg-dir "C:\path\images" --keyword-dict "C:\path\keywords.json" --output "C:\path\out.mp4"
```

`keywords.json` 示例：

```json
{
  "游戏": { "syn": ["电竞", "游戏实况", "steam", "switch"], "weight": 2, "category": "game" },
  "教程": { "syn": ["教学", "步骤", "指南"], "weight": 1.5, "category": "tutorial" },
  "手机": ["iPhone", "安卓", "Android"]
}
```

`categories.json` 示例：

```json
{
  "game": ["游戏", "电竞", "实况"],
  "tutorial": ["教程", "教学", "步骤", "指南"],
  "tech": ["手机", "电脑", "相机"]
}
```

`image-tags.json` 示例（key 用图片文件名）：

```json
{
  "gameplay_01.jpg": ["游戏", "电竞", "实况"],
  "iphone_closeup.png": ["手机", "开箱", "科技"],
  "tutorial_step.webp": ["教程", "步骤", "教学"]
}
```

自动生成标签（从图片路径/文件名提取）：

```
python auto-editor/auto_editor.py --script "C:\path\script.txt" --bg-dir "C:\path\images" --auto-tag --auto-tag-out "C:\path\image-tags.auto.json" --output "C:\path\out.mp4"
```

## 常用参数

- `--style`：`fast | narration | tutorial | montage`
- `--target-min` / `--target-max`：目标时长秒数（默认 60~300）
- `--resolution`：输出分辨率，默认 `1920x1080`
- `--scene-threshold`：场景切分阈值（越大越少切点）
- `--script`：脚本文本路径（会自动生成并烧录字幕）
- `--subtitle-max-len`：单行字幕最大字数（默认 22）
- `--subtitle-style`：字幕样式（ffmpeg ASS 风格）
- `--cps`：脚本配速（每秒字数，默认 6）
- `--tts`：仅脚本模式下自动 TTS 配音（Windows）
- `--voice`：指定 Windows TTS 声音名称
- `--bg-color`：脚本模式背景色（默认 black）
- `--bg-image`：脚本模式背景图路径（可选）
- `--bg-dir`：脚本模式背景图目录（会按脚本文字自动匹配/随机）
- `--keyword-dict`：智能配图关键词词典 JSON（可做同义词匹配）
- `--category-map`：分类词典 JSON（将关键词归类到场景）
- `--category-boost`：命中分类后的加权分（默认 2.0）
- `--image-tags`：图片标签映射 JSON（按图片名匹配）
- `--tag-boost`：命中图片标签加权分（默认 2.0）
- `--auto-tag`：自动从图片路径生成标签
- `--auto-tag-out`：自动标签输出 JSON 路径
- `--auto-tag-min-len`：自动标签最小长度（默认 2）
- `--bgm`：背景音乐文件或目录（随机挑一首）
- `--bgm-volume`：背景音乐音量（默认 0.3）
- `--voice-volume`：TTS 音量（默认 1.0）
- `--dry-run`：只打印选中片段，不输出文件

## 说明

这个版本不依赖 AI，基于场景变化自动切分并按风格选片段。后续可以加入：

- 语音转写 + 摘要分段
- 高能片段检测（音量/节奏/画面变化）
- 模板化转场/字幕/BGM

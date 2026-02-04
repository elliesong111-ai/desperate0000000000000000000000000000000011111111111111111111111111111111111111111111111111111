# Editopia Web (MVP)

本地或服务器运行的在线剪辑服务，提供脚本输入与素材上传，生成视频后下载。

## 依赖

- Python 3.9+
- FFmpeg 已安装并加入 PATH

## 运行

在仓库根目录执行：

```
python -m venv .venv
.\.venv\Scripts\activate
pip install -r webapp\requirements.txt
python webapp\app.py
```

打开浏览器访问：

```
http://localhost:8080
```

## 说明

- 目前为 MVP：脚本输入 + 可选背景图/BGM + 字幕。
- 生成依赖本机 `ffmpeg`，确保能在命令行里运行 `ffmpeg`。
- 若需公网在线服务，部署到带有 FFmpeg 的服务器即可。

import io
import json
import os
import subprocess
import tempfile
import zipfile

from flask import Flask, Response, render_template, request, send_file


app = Flask(__name__)


def run_cmd(cmd):
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    out, err = proc.communicate()
    return proc.returncode, out, err


def save_upload(file_storage, target_path):
    file_storage.save(target_path)
    return target_path


def extract_zip(zip_path, target_dir):
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(target_dir)


def write_json_file(file_storage, target_path):
    content = file_storage.read().decode("utf-8")
    json.loads(content)
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(content)
    file_storage.stream.seek(0)


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/api/generate", methods=["POST"])
def generate():
    script_text = request.form.get("script_text", "").strip()
    if not script_text:
        return Response("script_text is required", status=400)

    bg_color = request.form.get("bg_color", "black").strip()
    cps = request.form.get("cps", "6").strip()
    bgm_volume = request.form.get("bgm_volume", "0.3").strip()
    voice_volume = request.form.get("voice_volume", "1.0").strip()
    category_boost = request.form.get("category_boost", "2.0").strip()
    tag_boost = request.form.get("tag_boost", "2.0").strip()
    subtitle_max_len = request.form.get("subtitle_max_len", "22").strip()

    bg_zip = request.files.get("bg_zip")
    bg_image = request.files.get("bg_image")
    bgm_file = request.files.get("bgm_file")
    keyword_dict = request.files.get("keyword_dict")
    category_map = request.files.get("category_map")
    image_tags = request.files.get("image_tags")

    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = os.path.join(tmpdir, "script.txt")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(script_text)

        cmd = [
            os.environ.get("PYTHON", "python"),
            os.path.join("auto-editor", "auto_editor.py"),
            "--script",
            script_path,
            "--bg-color",
            bg_color,
            "--cps",
            cps,
            "--subtitle-max-len",
            subtitle_max_len,
            "--bgm-volume",
            bgm_volume,
            "--voice-volume",
            voice_volume,
            "--category-boost",
            category_boost,
            "--tag-boost",
            tag_boost,
        ]

        if bg_zip and bg_zip.filename:
            zip_path = os.path.join(tmpdir, "images.zip")
            save_upload(bg_zip, zip_path)
            img_dir = os.path.join(tmpdir, "images")
            os.makedirs(img_dir, exist_ok=True)
            extract_zip(zip_path, img_dir)
            cmd += ["--bg-dir", img_dir]

        if bg_image and bg_image.filename:
            img_path = os.path.join(tmpdir, bg_image.filename)
            save_upload(bg_image, img_path)
            cmd += ["--bg-image", img_path]

        if bgm_file and bgm_file.filename:
            bgm_path = os.path.join(tmpdir, bgm_file.filename)
            save_upload(bgm_file, bgm_path)
            cmd += ["--bgm", bgm_path]

        if keyword_dict and keyword_dict.filename:
            keyword_path = os.path.join(tmpdir, "keywords.json")
            write_json_file(keyword_dict, keyword_path)
            cmd += ["--keyword-dict", keyword_path]

        if category_map and category_map.filename:
            category_path = os.path.join(tmpdir, "categories.json")
            write_json_file(category_map, category_path)
            cmd += ["--category-map", category_path]

        if image_tags and image_tags.filename:
            tags_path = os.path.join(tmpdir, "image-tags.json")
            write_json_file(image_tags, tags_path)
            cmd += ["--image-tags", tags_path]

        output_path = os.path.join(tmpdir, "output.mp4")
        cmd += ["--output", output_path]

        code, _, err = run_cmd(cmd)
        if code != 0 or not os.path.exists(output_path):
            return Response(f"generation failed: {err}", status=500)

        with open(output_path, "rb") as f:
            data = f.read()

    return send_file(
        io.BytesIO(data),
        mimetype="video/mp4",
        as_attachment=True,
        download_name="editopia.mp4",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)

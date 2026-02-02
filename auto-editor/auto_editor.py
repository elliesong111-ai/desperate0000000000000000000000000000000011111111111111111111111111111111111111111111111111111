import argparse
import json
import os
import random
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class Segment:
    source: str
    start: float
    end: float
    score: float

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


def run_cmd(cmd: List[str]) -> Tuple[int, str, str]:
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    out, err = proc.communicate()
    return proc.returncode, out, err


def ffprobe_duration(path: str) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        path,
    ]
    code, out, err = run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"ffprobe failed for {path}: {err.strip()}")
    data = json.loads(out)
    return float(data["format"]["duration"])


def detect_scene_changes(path: str, threshold: float) -> List[float]:
    # Use ffmpeg scene detection with showinfo timestamps.
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-i",
        path,
        "-vf",
        f"select='gt(scene,{threshold})',showinfo",
        "-f",
        "null",
        "-",
    ]
    _, _, err = run_cmd(cmd)
    times = []
    for line in err.splitlines():
        if "showinfo" not in line:
            continue
        # Example: n:  23 pts:12345 pts_time:0.987 ...
        if "pts_time:" in line:
            try:
                parts = line.split("pts_time:")[1].split()
                times.append(float(parts[0]))
            except (ValueError, IndexError):
                continue
    times = sorted(set(t for t in times if t > 0))
    return times


def build_segments(
    source: str,
    duration: float,
    scene_times: List[float],
    min_len: float,
    max_len: float,
    skip_start: float,
    skip_end: float,
) -> List[Segment]:
    start_time = max(0.0, skip_start)
    end_time = max(start_time, duration - skip_end)
    cut_points = [t for t in scene_times if start_time < t < end_time]
    cut_points = [start_time] + cut_points + [end_time]

    segments: List[Segment] = []
    i = 0
    while i < len(cut_points) - 1:
        seg_start = cut_points[i]
        seg_end = cut_points[i + 1]
        # Merge if too short; extend until it meets min_len.
        while seg_end - seg_start < min_len and i + 2 < len(cut_points):
            i += 1
            seg_end = cut_points[i + 1]
        if seg_end - seg_start > max_len:
            # Split long segments into chunks.
            chunk_start = seg_start
            while chunk_start < seg_end:
                chunk_end = min(chunk_start + max_len, seg_end)
                segments.append(Segment(source, chunk_start, chunk_end, 0.0))
                chunk_start = chunk_end
        else:
            segments.append(Segment(source, seg_start, seg_end, 0.0))
        i += 1
    return [s for s in segments if s.duration >= min_len]


def score_segments(
    segments: List[Segment], scene_times: List[float], style: str
) -> List[Segment]:
    for seg in segments:
        scenes_in_seg = sum(1 for t in scene_times if seg.start <= t <= seg.end)
        scene_rate = scenes_in_seg / max(seg.duration, 0.1)
        if style == "fast":
            seg.score = scene_rate + (1.0 / max(seg.duration, 1.0))
        elif style == "montage":
            seg.score = scene_rate + (0.5 / max(seg.duration, 1.0))
        elif style == "narration":
            seg.score = max(0.0, 1.0 - abs(seg.duration - 8.0) / 8.0) + scene_rate
        elif style == "tutorial":
            seg.score = max(0.0, 1.0 - abs(seg.duration - 12.0) / 12.0)
        else:
            seg.score = scene_rate
    return segments


def pick_target_duration(target_min: float, target_max: float) -> float:
    target_min = max(10.0, target_min)
    target_max = max(target_min, target_max)
    default = 180.0
    if target_min <= default <= target_max:
        return default
    return (target_min + target_max) / 2.0


def select_segments(
    segments: List[Segment],
    target_min: float,
    target_max: float,
    style: str,
    seed: int,
) -> List[Segment]:
    if not segments:
        return []
    target = pick_target_duration(target_min, target_max)
    random.seed(seed)

    if style in {"fast", "montage"}:
        ranked = sorted(segments, key=lambda s: s.score, reverse=True)
        picked = []
        total = 0.0
        for seg in ranked:
            if total + seg.duration > target_max:
                continue
            picked.append(seg)
            total += seg.duration
            if total >= target:
                break
        picked = sorted(picked, key=lambda s: (s.source, s.start))
        return picked

    # narration/tutorial: keep chronological order
    total = 0.0
    picked = []
    for seg in sorted(segments, key=lambda s: (s.source, s.start)):
        if total + seg.duration > target_max:
            break
        picked.append(seg)
        total += seg.duration
        if total >= target_min:
            break
    return picked


def write_concat_file(segments: List[Segment], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"file '{seg.source}'\n")
            f.write(f"inpoint {seg.start:.3f}\n")
            f.write(f"outpoint {seg.end:.3f}\n")


def run_concat(
    concat_path: str,
    output: str,
    width: int,
    height: int,
    subtitle_path: Optional[str],
    subtitle_style: str,
) -> None:
    vf = (
        f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
    )
    if subtitle_path:
        vf = f"{vf},subtitles='{subtitle_path}':force_style='{subtitle_style}'"
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_path,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        output,
    ]
    code, _, err = run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"ffmpeg concat failed: {err.strip()}")


def run_script_video(
    output: str,
    width: int,
    height: int,
    duration: float,
    subtitle_path: Optional[str],
    subtitle_style: str,
    bg_color: str,
    bg_image: Optional[str],
    image_concat: Optional[str],
    audio_path: Optional[str],
    bgm_path: Optional[str],
    bgm_volume: float,
    voice_volume: float,
) -> None:
    if duration <= 0:
        raise RuntimeError("Duration must be greater than 0.")
    if image_concat:
        vf = (
            f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        )
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            image_concat,
        ]
    elif bg_image:
        vf = (
            f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        )
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-loop",
            "1",
            "-i",
            bg_image,
            "-t",
            f"{duration:.3f}",
        ]
    else:
        vf = f"scale=w={width}:h={height}:force_original_aspect_ratio=decrease," f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c={bg_color}:s={width}x{height}:d={duration:.3f}",
        ]

    if subtitle_path:
        vf = f"{vf},subtitles='{subtitle_path}':force_style='{subtitle_style}'"

    audio_inputs = []
    filter_complex = None
    audio_map = None

    if bgm_path:
        audio_inputs += ["-stream_loop", "-1", "-i", bgm_path]
    if audio_path:
        audio_inputs += ["-i", audio_path]

    if bgm_path and audio_path:
        bgm_idx = 1
        tts_idx = 2
        filter_complex = (
            f"[{bgm_idx}:a]volume={bgm_volume}[bgm];"
            f"[{tts_idx}:a]volume={voice_volume}[tts];"
            "[bgm][tts]amix=inputs=2:duration=shortest:dropout_transition=2[aout]"
        )
        audio_map = "[aout]"
    elif bgm_path:
        bgm_idx = 1
        filter_complex = f"[{bgm_idx}:a]volume={bgm_volume}[aout]"
        audio_map = "[aout]"
    elif audio_path:
        tts_idx = 1
        filter_complex = f"[{tts_idx}:a]volume={voice_volume}[aout]"
        audio_map = "[aout]"
    else:
        audio_map = None

    cmd += audio_inputs
    cmd += ["-vf", vf]
    if filter_complex:
        cmd += ["-filter_complex", filter_complex, "-map", "0:v:0", "-map", audio_map]
    else:
        cmd += ["-map", "0:v:0"]
    if audio_map:
        cmd += ["-shortest"]
    else:
        cmd += ["-an"]
    cmd += [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
    ]
    if audio_map:
        cmd += [
            "-c:a",
            "aac",
            "-b:a",
            "160k",
        ]
    cmd += ["-movflags", "+faststart", output]
    code, _, err = run_cmd(cmd)
    if code != 0:
        raise RuntimeError(f"ffmpeg script video failed: {err.strip()}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Auto editor: generate 16:9 edits in multiple styles."
    )
    parser.add_argument("--input", nargs="*", help="Input video paths (optional for script-only)")
    parser.add_argument("--style", choices=["fast", "narration", "tutorial", "montage"], default="fast")
    parser.add_argument("--target-min", type=float, default=60, help="Min target duration (seconds)")
    parser.add_argument("--target-max", type=float, default=300, help="Max target duration (seconds)")
    parser.add_argument("--resolution", default="1920x1080", help="Output resolution WxH")
    parser.add_argument("--scene-threshold", type=float, default=0.3, help="Scene detect threshold")
    parser.add_argument("--min-len", type=float, default=2.0, help="Min segment length")
    parser.add_argument("--max-len", type=float, default=12.0, help="Max segment length")
    parser.add_argument("--skip-start", type=float, default=2.0, help="Skip at start (seconds)")
    parser.add_argument("--skip-end", type=float, default=2.0, help="Skip at end (seconds)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--script", help="Text script file path for subtitles")
    parser.add_argument("--tts", action="store_true", help="Generate TTS audio from script (Windows)")
    parser.add_argument("--voice", help="TTS voice name (Windows)")
    parser.add_argument("--bg-color", default="black", help="Background color for script-only")
    parser.add_argument("--bg-image", help="Background image for script-only")
    parser.add_argument("--bg-dir", help="Background image directory for script-only")
    parser.add_argument("--bgm", help="Background music file or directory")
    parser.add_argument("--bgm-volume", type=float, default=0.3, help="BGM volume (0-1)")
    parser.add_argument("--voice-volume", type=float, default=1.0, help="TTS volume (0-1)")
    parser.add_argument("--keyword-dict", help="JSON keyword dict for smarter image matching")
    parser.add_argument("--category-map", help="JSON category map for image matching")
    parser.add_argument("--category-boost", type=float, default=2.0, help="Boost if image path hits category")
    parser.add_argument("--image-tags", help="JSON mapping image file -> tags list")
    parser.add_argument("--tag-boost", type=float, default=2.0, help="Boost if image tags hit keyword")
    parser.add_argument("--auto-tag", action="store_true", help="Auto-generate image tags from paths")
    parser.add_argument("--auto-tag-out", default="image-tags.auto.json", help="Auto tag output JSON path")
    parser.add_argument("--auto-tag-min-len", type=int, default=2, help="Min length for auto tags")
    parser.add_argument("--cps", type=float, default=6.0, help="Characters per second for script timing")
    parser.add_argument(
        "--subtitle-style",
        default="FontName=Arial,FontSize=28",
        help="ASS subtitle style for ffmpeg subtitles filter",
    )
    parser.add_argument(
        "--subtitle-max-len",
        type=int,
        default=22,
        help="Max characters per subtitle line",
    )
    parser.add_argument("--dry-run", action="store_true", help="Only print selected segments")
    parser.add_argument("--output", default="output.mp4", help="Output path")
    return parser.parse_args()


def style_defaults(args: argparse.Namespace) -> None:
    if args.style == "fast":
        args.min_len = min(args.min_len, 2.0)
        args.max_len = min(args.max_len, 6.0)
    elif args.style == "narration":
        args.min_len = max(args.min_len, 4.0)
        args.max_len = max(args.max_len, 10.0)
    elif args.style == "tutorial":
        args.min_len = max(args.min_len, 6.0)
        args.max_len = max(args.max_len, 16.0)
    elif args.style == "montage":
        args.min_len = min(args.min_len, 3.0)
        args.max_len = min(args.max_len, 10.0)


def read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def split_script(text: str, max_len: int) -> List[str]:
    if not text:
        return []
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    separators = set("。！？.!?\n")
    chunks: List[str] = []
    buff = []
    for ch in text:
        buff.append(ch)
        if ch in separators:
            chunk = "".join(buff).strip()
            if chunk:
                chunks.append(chunk)
            buff = []
    tail = "".join(buff).strip()
    if tail:
        chunks.append(tail)

    lines: List[str] = []
    for chunk in chunks:
        if len(chunk) <= max_len:
            lines.append(chunk)
        else:
            start = 0
            while start < len(chunk):
                lines.append(chunk[start : start + max_len])
                start += max_len
    return [line.strip() for line in lines if line.strip()]


def seconds_to_srt_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}".replace(".", ",")


def write_srt(lines: List[str], total_duration: float, path: str) -> None:
    if not lines:
        raise RuntimeError("Script is empty after splitting.")
    per = max(0.5, total_duration / len(lines))
    current = 0.0
    with open(path, "w", encoding="utf-8") as f:
        for idx, line in enumerate(lines, start=1):
            start = current
            end = min(total_duration, current + per)
            f.write(f"{idx}\n")
            f.write(f"{seconds_to_srt_time(start)} --> {seconds_to_srt_time(end)}\n")
            f.write(f"{line}\n\n")
            current = end


def normalize_subtitle_path(path: str) -> str:
    abs_path = os.path.abspath(path)
    ff_path = abs_path.replace("\\", "/")
    return ff_path.replace(":", "\\:")


def compute_line_durations(
    lines: List[str],
    cps: float,
    total_duration: Optional[float] = None,
    min_sec: float = 1.0,
    max_sec: float = 6.0,
) -> Tuple[List[float], float]:
    if not lines:
        return [], 0.0
    cps = max(1.0, cps)
    raw = []
    for line in lines:
        sec = max(min_sec, min(max_sec, len(line) / cps))
        raw.append(sec)
    total_raw = sum(raw)
    if total_duration and total_raw > 0:
        scale = total_duration / total_raw
        durations = [d * scale for d in raw]
        return durations, total_duration
    return raw, total_raw


def write_srt_with_durations(lines: List[str], durations: List[float], path: str) -> None:
    if not lines or not durations or len(lines) != len(durations):
        raise RuntimeError("Subtitle lines and durations mismatch.")
    current = 0.0
    with open(path, "w", encoding="utf-8") as f:
        for idx, (line, dur) in enumerate(zip(lines, durations), start=1):
            start = current
            end = current + max(0.2, dur)
            f.write(f"{idx}\n")
            f.write(f"{seconds_to_srt_time(start)} --> {seconds_to_srt_time(end)}\n")
            f.write(f"{line}\n\n")
            current = end


def generate_tts_wav(script_text: str, output_path: str, voice: Optional[str]) -> None:
    # Windows SAPI via PowerShell
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8") as tf:
        tf.write(script_text)
        text_path = tf.name
    voice_cmd = f"$speak.SelectVoice('{voice}');" if voice else ""
    ps_script = (
        "Add-Type -AssemblyName System.Speech; "
        "$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"{voice_cmd} "
        f"$text = Get-Content -Raw -Path '{text_path}'; "
        f"$speak.SetOutputToWaveFile('{output_path}'); "
        "$speak.Speak($text); "
        "$speak.Dispose();"
    )
    cmd = ["powershell", "-NoProfile", "-Command", ps_script]
    code, _, err = run_cmd(cmd)
    try:
        os.remove(text_path)
    except OSError:
        pass
    if code != 0:
        raise RuntimeError(f"TTS generation failed: {err.strip()}")


def collect_images(bg_dir: str) -> List[str]:
    images = []
    for root, _, files in os.walk(bg_dir):
        for name in files:
            if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                images.append(os.path.join(root, name))
    return images


def extract_keywords(line: str) -> List[str]:
    tokens = re.findall(r"[A-Za-z0-9\u4e00-\u9fff]+", line)
    return [t for t in tokens if len(t) >= 2]


def tokenize_path(path: str) -> List[str]:
    parts = re.split(r"[/\\._\-\s]+", path.lower())
    return [p for p in parts if p]


def auto_generate_image_tags(images: List[str], min_len: int) -> dict:
    tags = {}
    for img in images:
        tokens = tokenize_path(img)
        cleaned = [t for t in tokens if len(t) >= min_len]
        key = os.path.basename(img).lower()
        if key not in tags:
            tags[key] = []
        for t in cleaned:
            if t not in tags[key]:
                tags[key].append(t)
    return tags


def merge_image_tags(base: dict, extra: dict) -> dict:
    merged = {k: list(v) for k, v in base.items()}
    for key, tags in extra.items():
        if not isinstance(tags, list):
            continue
        key_l = key.lower()
        if key_l not in merged:
            merged[key_l] = []
        for t in tags:
            t = str(t).lower()
            if t not in merged[key_l]:
                merged[key_l].append(t)
    return merged


def load_keyword_dict(path: Optional[str]) -> dict:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise RuntimeError("keyword dict must be a JSON object.")
    return data


def load_category_map(path: Optional[str]) -> dict:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise RuntimeError("category map must be a JSON object.")
    return data


def load_image_tags(path: Optional[str]) -> dict:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise RuntimeError("image tags must be a JSON object.")
    normalized = {}
    for key, tags in data.items():
        if not isinstance(key, str):
            continue
        if isinstance(tags, list):
            normalized[key.lower()] = [str(t).lower() for t in tags]
    return normalized


def expand_keywords(
    keywords: List[str], keyword_dict: dict
) -> List[Tuple[str, float, Optional[str]]]:
    expanded: List[Tuple[str, float, Optional[str]]] = []
    for kw in keywords:
        weight = 1.0
        category = None
        expanded.append((kw.lower(), weight, category))
        if kw in keyword_dict:
            vals = keyword_dict.get(kw)
            syns: List[str] = []
            if isinstance(vals, list):
                syns = [v for v in vals if isinstance(v, str)]
            elif isinstance(vals, dict):
                raw_syns = vals.get("syn") or vals.get("synonyms") or []
                if isinstance(raw_syns, list):
                    syns = [v for v in raw_syns if isinstance(v, str)]
                weight = float(vals.get("weight", 1.0))
                category = vals.get("category")
                if category is not None:
                    category = str(category).lower()
            for s in syns:
                expanded.append((s.lower(), weight, category))
    return expanded


def match_categories(
    keywords: List[str], category_map: dict, keyword_entries: List[Tuple[str, float, Optional[str]]]
) -> List[str]:
    categories = set()
    for _, _, cat in keyword_entries:
        if cat:
            categories.add(cat)
    for cat, kws in category_map.items():
        if not isinstance(kws, list):
            continue
        for kw in keywords:
            if kw in kws:
                categories.add(str(cat).lower())
                break
    return list(categories)


def pick_image_for_line(
    images: List[str],
    line: str,
    seed: int,
    keyword_dict: dict,
    category_map: dict,
    category_boost: float,
    image_tags: dict,
    tag_boost: float,
) -> str:
    if not images:
        raise RuntimeError("No images found in bg directory.")
    keywords = extract_keywords(line)
    expanded = expand_keywords(keywords, keyword_dict)
    categories = match_categories(keywords, category_map, expanded)
    if not expanded:
        random.seed(seed)
        return random.choice(images)
    scored = []
    for img in images:
        tokens = tokenize_path(img)
        score = 0.0
        for kw, weight, _ in expanded:
            if kw in tokens:
                score += weight
        for cat in categories:
            if cat in tokens:
                score += category_boost
        img_key = os.path.basename(img).lower()
        tags = image_tags.get(img_key, [])
        if tags:
            for kw, weight, _ in expanded:
                if kw in tags:
                    score += max(weight, tag_boost)
            for cat in categories:
                if cat in tags:
                    score += category_boost
        scored.append((score, img))
    scored.sort(key=lambda x: x[0], reverse=True)
    if scored[0][0] == 0:
        random.seed(seed)
        return random.choice(images)
    return scored[0][1]


def normalize_concat_path(path: str) -> str:
    return os.path.abspath(path).replace("\\", "/")


def write_image_concat_file(
    lines: List[str],
    durations: List[float],
    images: List[str],
    path: str,
    seed: int,
    keyword_dict: dict,
    category_map: dict,
    category_boost: float,
    image_tags: dict,
    tag_boost: float,
) -> None:
    if not lines or not durations:
        raise RuntimeError("No script lines to map images.")
    with open(path, "w", encoding="utf-8") as f:
        for idx, (line, dur) in enumerate(zip(lines, durations)):
            img = pick_image_for_line(
                images,
                line,
                seed + idx,
                keyword_dict,
                category_map,
                category_boost,
                image_tags,
                tag_boost,
            )
            f.write(f"file '{normalize_concat_path(img)}'\n")
            f.write(f"duration {max(0.2, dur):.3f}\n")
        # Repeat last image to ensure concat honors final duration.
        last_img = pick_image_for_line(
            images,
            lines[-1],
            seed + len(lines),
            keyword_dict,
            category_map,
            category_boost,
            image_tags,
            tag_boost,
        )
        f.write(f"file '{normalize_concat_path(last_img)}'\n")


def pick_bgm(bgm_path: str, seed: int) -> str:
    if os.path.isdir(bgm_path):
        audio_files = []
        for root, _, files in os.walk(bgm_path):
            for name in files:
                if name.lower().endswith((".mp3", ".wav", ".aac", ".m4a", ".ogg")):
                    audio_files.append(os.path.join(root, name))
        if not audio_files:
            raise RuntimeError("No audio files found in bgm directory.")
        random.seed(seed)
        return random.choice(audio_files)
    return bgm_path


def main() -> int:
    args = parse_args()
    style_defaults(args)
    width, height = [int(x) for x in args.resolution.lower().split("x")]

    if not args.input:
        if not args.script:
            raise RuntimeError("Script-only mode requires --script.")
        script_text = read_text_file(args.script)
        lines = split_script(script_text, args.subtitle_max_len)
        durations, total_duration = compute_line_durations(lines, args.cps)
        if args.dry_run:
            for line, dur in zip(lines, durations):
                print(f"{dur:.2f}s: {line}")
            return 0
        with tempfile.TemporaryDirectory() as tmpdir:
            srt_path = os.path.join(tmpdir, "subtitles.srt")
            write_srt_with_durations(lines, durations, srt_path)
            subtitle_path = normalize_subtitle_path(srt_path)
            audio_path = None
            bgm_path = None
            if args.tts:
                audio_path = os.path.join(tmpdir, "tts.wav")
                generate_tts_wav(script_text, audio_path, args.voice)
            if args.bgm:
                bgm_path = pick_bgm(args.bgm, args.seed)
            image_concat = None
            if args.bg_dir:
                images = collect_images(args.bg_dir)
                image_concat = os.path.join(tmpdir, "images.txt")
                keyword_dict = load_keyword_dict(args.keyword_dict)
                category_map = load_category_map(args.category_map)
                image_tags = load_image_tags(args.image_tags)
                if args.auto_tag:
                    auto_tags = auto_generate_image_tags(images, args.auto_tag_min_len)
                    image_tags = merge_image_tags(image_tags, auto_tags)
                    with open(args.auto_tag_out, "w", encoding="utf-8") as f:
                        json.dump(image_tags, f, ensure_ascii=False, indent=2)
                write_image_concat_file(
                    lines,
                    durations,
                    images,
                    image_concat,
                    args.seed,
                    keyword_dict,
                    category_map,
                    args.category_boost,
                    image_tags,
                    args.tag_boost,
                )
            run_script_video(
                args.output,
                width,
                height,
                total_duration,
                subtitle_path,
                args.subtitle_style,
                args.bg_color,
                args.bg_image,
                image_concat,
                audio_path,
                bgm_path,
                args.bgm_volume,
                args.voice_volume,
            )
        return 0

    all_segments: List[Segment] = []
    for source in args.input:
        if not os.path.exists(source):
            raise FileNotFoundError(source)
        duration = ffprobe_duration(source)
        scene_times = detect_scene_changes(source, args.scene_threshold)
        segments = build_segments(
            source,
            duration,
            scene_times,
            args.min_len,
            args.max_len,
            args.skip_start,
            args.skip_end,
        )
        scored = score_segments(segments, scene_times, args.style)
        all_segments.extend(scored)

    selected = select_segments(
        all_segments, args.target_min, args.target_max, args.style, args.seed
    )
    if not selected:
        raise RuntimeError("No segments selected. Try adjusting thresholds.")

    if args.dry_run:
        for seg in selected:
            print(f"{seg.source}: {seg.start:.2f}-{seg.end:.2f} ({seg.duration:.2f}s)")
        return 0

    with tempfile.TemporaryDirectory() as tmpdir:
        concat_path = os.path.join(tmpdir, "concat.txt")
        write_concat_file(selected, concat_path)
        subtitle_path = None
        if args.script:
            script_text = read_text_file(args.script)
            lines = split_script(script_text, args.subtitle_max_len)
            total_duration = sum(seg.duration for seg in selected)
            durations, _ = compute_line_durations(lines, args.cps, total_duration=total_duration)
            srt_path = os.path.join(tmpdir, "subtitles.srt")
            write_srt_with_durations(lines, durations, srt_path)
            subtitle_path = normalize_subtitle_path(srt_path)
        run_concat(concat_path, args.output, width, height, subtitle_path, args.subtitle_style)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

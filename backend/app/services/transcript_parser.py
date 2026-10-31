import re

MARKER = re.compile(r"^<<<.*>>>$")
CUE_TIME = re.compile(r"^(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?\s*-->")
VTT_VOICE = re.compile(r"^<v\s+([^>]+)>")
LINE = re.compile(
    r"^(?:\[(?P<ts>(?:\d{1,2}:)?\d{1,2}:\d{2})\]\s*)?(?P<speaker>[^:]{1,60}):\s*(?P<text>.+)$"
)


def _to_seconds(ts: str):
    ts = re.split(r"[.,]", ts.strip())[0]
    parts = [int(p) for p in ts.split(":")]
    seconds = 0
    for p in parts:
        seconds = seconds * 60 + p
    return seconds


def parse_transcript(raw: str) -> list[dict]:
    segments: list[dict] = []
    current_ts = None
    for line in raw.splitlines():
        line = line.strip()
        if not line or line == "WEBVTT" or MARKER.match(line) or line.isdigit():
            continue
        if CUE_TIME.match(line):
            current_ts = _to_seconds(line.split("-->")[0])
            continue
        line = VTT_VOICE.sub(r"\1: ", line).replace("</v>", "")
        m = LINE.match(line)
        if m:
            ts = _to_seconds(m["ts"]) if m["ts"] else current_ts
            segments.append({
                "speaker": m["speaker"].strip(),
                "text": m["text"].strip(),
                "ts_seconds": ts,
            })
        elif segments:
            segments[-1]["text"] += " " + line
    return segments
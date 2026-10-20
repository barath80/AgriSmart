"""Audio format conversion between app recordings, telephony streams and speech providers.

Internally everything is mono 16-bit PCM held in NumPy arrays.
"""

import asyncio
import io
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

from app.core.errors import InvalidInput, ServiceUnavailable

SPEECH_SAMPLE_RATE = 16_000
TELEPHONY_SAMPLE_RATE = 8_000


def is_wav(data: bytes) -> bool:
    return data[:4] == b"RIFF" and data[8:12] == b"WAVE"


def read_wav(data: bytes) -> tuple[np.ndarray, int]:
    try:
        with wave.open(io.BytesIO(data)) as wav:
            if wav.getsampwidth() != 2:
                raise InvalidInput("Only 16-bit WAV is supported", code="invalid_audio")
            frames = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
            channels, rate = wav.getnchannels(), wav.getframerate()
    except (wave.Error, EOFError) as exc:
        raise InvalidInput("Unreadable WAV audio", code="invalid_audio") from exc
    if channels > 1:
        frames = frames.reshape(-1, channels).mean(axis=1).astype(np.int16)
    return frames, rate


def write_wav(samples: np.ndarray, sample_rate: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.astype("<i2").tobytes())
    return buffer.getvalue()


def resample(samples: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    """Linear-interpolation resampling — adequate for speech-band audio."""
    if source_rate == target_rate or samples.size == 0:
        return samples
    duration = samples.size / source_rate
    target_length = max(1, round(duration * target_rate))
    positions = np.linspace(0, samples.size - 1, target_length)
    return np.interp(positions, np.arange(samples.size), samples).astype(np.int16)


def find_ffmpeg() -> str | None:
    """FFMPEG_PATH, then a system ffmpeg, then the static binary shipped by imageio-ffmpeg
    (a dev dependency, so Windows laptops work without installing ffmpeg)."""
    configured = os.environ.get("FFMPEG_PATH")
    if configured and Path(configured).exists():
        return configured
    if found := shutil.which("ffmpeg"):
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _ffmpeg_blocking(ffmpeg: str, source: str, stdin_data: bytes | None, rate: int) -> bytes:
    command = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin" if stdin_data is None else "-y",
        "-i", source, "-f", "s16le", "-ac", "1", "-ar", str(rate), "pipe:1",
    ]  # fmt: skip
    try:
        result = subprocess.run(  # noqa: S603 - fixed argv, no shell
            command,
            input=stdin_data,
            stdin=None if stdin_data is not None else subprocess.DEVNULL,
            capture_output=True,
            timeout=20,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise InvalidInput("Audio took too long to decode", code="invalid_audio") from exc
    return result.stdout if result.returncode == 0 else b""


async def _run_ffmpeg(ffmpeg: str, source: str, stdin_data: bytes | None, rate: int) -> bytes:
    # A worker thread, not asyncio subprocesses: Windows' selector event loop (used by
    # `uvicorn --workers`) cannot spawn processes, and a thread keeps the loop free anyway.
    return await asyncio.to_thread(_ffmpeg_blocking, ffmpeg, source, stdin_data, rate)


async def decode_to_pcm(data: bytes, target_rate: int = SPEECH_SAMPLE_RATE) -> np.ndarray:
    """Decode an uploaded recording (WAV, or AAC/M4A/WebM/OGG/MP3 via ffmpeg) to mono PCM16."""
    if is_wav(data):
        samples, rate = read_wav(data)
        return resample(samples, rate, target_rate)
    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        raise ServiceUnavailable(
            "ffmpeg is required to decode compressed audio", code="audio_decoder_missing"
        )
    pcm = await _run_ffmpeg(ffmpeg, "pipe:0", data, target_rate)
    if not pcm:
        # Some MP4/M4A files keep their index at the end, which ffmpeg cannot read from a
        # pipe. A temporary file is seekable, so retry once that way.
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "recording"
            path.write_bytes(data)
            pcm = await _run_ffmpeg(ffmpeg, str(path), None, target_rate)
    if not pcm:
        raise InvalidInput("Unreadable audio", code="invalid_audio")
    return np.frombuffer(pcm, dtype="<i2")


# --- G.711 μ-law (telephony) -------------------------------------------------------------

_MU = 255
_MULAW_BIAS = 0x84
_MULAW_CLIP = 32635


def mulaw_decode(data: bytes) -> np.ndarray:
    encoded = ~np.frombuffer(data, dtype=np.uint8)
    sign = encoded & 0x80
    exponent = (encoded >> 4) & 0x07
    mantissa = encoded & 0x0F
    magnitude = (((mantissa.astype(np.int32) << 3) + _MULAW_BIAS) << exponent) - _MULAW_BIAS
    return np.where(sign != 0, -magnitude, magnitude).astype(np.int16)


def mulaw_encode(samples: np.ndarray) -> bytes:
    pcm = samples.astype(np.int32)
    sign = np.where(pcm < 0, 0x80, 0x00)
    magnitude = np.minimum(np.abs(pcm), _MULAW_CLIP) + _MULAW_BIAS
    exponent = np.floor(np.log2(magnitude)).astype(np.int32) - 7
    exponent = np.clip(exponent, 0, 7)
    mantissa = (magnitude >> (exponent + 3)) & 0x0F
    encoded = ~(sign | (exponent << 4) | mantissa) & 0xFF
    return encoded.astype(np.uint8).tobytes()


def rms(samples: np.ndarray) -> float:
    return float(np.sqrt(np.mean(samples.astype(np.float32) ** 2))) if samples.size else 0.0

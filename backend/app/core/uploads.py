import mimetypes

from fastapi import UploadFile

from app.core.errors import InvalidInput

_GENERIC_TYPES = {"", "application/octet-stream", "binary/octet-stream"}
# Extensions the standard library maps differently (or not at all) on some systems.
_EXTENSION_TYPES = {".m4a": "audio/mp4", ".aac": "audio/aac", ".heic": "image/heic"}


def declared_type(upload: UploadFile) -> str:
    """The upload's MIME type without parameters. Some phone uploaders send none, or a
    generic one; then the file name's extension decides, as the client meant it."""
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type not in _GENERIC_TYPES or not upload.filename:
        return content_type
    extension = "." + upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else ""
    guessed = _EXTENSION_TYPES.get(extension) or mimetypes.guess_type(upload.filename)[0]
    return guessed or content_type


async def read_limited(upload: UploadFile, max_bytes: int, allowed_types: set[str]) -> bytes:
    """Read an upload without ever buffering more than `max_bytes + 1`.

    The declared content type is only a first filter; decoders validate the real content.
    """
    content_type = declared_type(upload)
    if content_type not in allowed_types:
        raise InvalidInput(
            f"Unsupported file type {content_type}", code="unsupported_media_type"
        )
    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise InvalidInput(
            f"File is larger than {max_bytes // (1024 * 1024)} MB", code="file_too_large"
        )
    if not data:
        raise InvalidInput("File is empty", code="empty_file")
    return data

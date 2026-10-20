from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin


class TranslationCache(IdMixin, TimestampMixin, Base):
    """Machine translations of English knowledge content, so each text is translated once."""

    __tablename__ = "translation_cache"
    __table_args__ = (
        UniqueConstraint("source_hash", "target_lang", name="uq_translation_cache_entry"),
    )

    source_hash: Mapped[str] = mapped_column(String(64))
    target_lang: Mapped[str] = mapped_column(String(8))
    text: Mapped[str] = mapped_column(String(4000))
    provider: Mapped[str] = mapped_column(String(32))

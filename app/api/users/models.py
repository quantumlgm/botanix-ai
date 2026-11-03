

from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.services.postgres import Base, Timestamp, UuidId


class User(Base, UuidId, Timestamp):
    __tablename__ = "users"

    telegram_id: Mapped[int | None] = mapped_column(type_=BigInteger, unique=True, nullable=True, default=None)
    username: Mapped[str | None]
    first_name: Mapped[str]

    chats: Mapped[list["Chat"]] = relationship(back_populates="user")
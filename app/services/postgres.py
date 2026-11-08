import datetime
import uuid

from sqlalchemy import create_engine, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import settings


class Base(DeclarativeBase):
    pass


class Timestamp:
    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(
        onupdate=func.now(), server_default=func.now()
    )


class UuidId:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


engine = create_async_engine(
    settings.pg_asyncpg_dsn,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
)
sync_engine = create_engine(
    settings.pg_psycopg_dsn,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
)


sessionmaker = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session():
    async with sessionmaker() as session:
        yield session

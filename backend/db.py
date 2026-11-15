import os
from datetime import datetime
from sqlalchemy import create_engine, String, JSON, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def database_url():
    url = os.environ.get('DATABASE_URL', 'postgresql+psycopg://postgres:test@127.0.0.1:55432/mysteryai')
    if url.startswith(('postgres://', 'postgresql://')):
        url = 'postgresql+psycopg://' + url.split('://', 1)[1]
    return url


engine = create_engine(database_url(), pool_pre_ping=True)
Session = sessionmaker(engine)


class Base(DeclarativeBase):
    pass


class Campaign(Base):
    __tablename__ = 'campaigns'
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    config: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default='draft')
    rubric_version: Mapped[str] = mapped_column(String(64), default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Trial(Base):
    __tablename__ = 'trials'
    id: Mapped[str] = mapped_column(String(360), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey('campaigns.id'), index=True)
    data: Mapped[dict] = mapped_column(JSON)


class Event(Base):
    __tablename__ = 'events'
    __table_args__ = (UniqueConstraint('trial_id', 'provider_id'),)
    id: Mapped[str] = mapped_column(String(480), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey('trials.id'), index=True)
    provider_id: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict] = mapped_column(JSON)

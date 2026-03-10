from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base


class User(Base):
    """
    User model for authentication.
    Stores user credentials and basic information.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<User(username={self.username}, email={self.email})>"


class IntegrationSettings(Base):
    """
    Integration credentials/settings stored in DB.
    One row per provider: prestashop / woocommerce / baselinker.
    """
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), unique=True, index=True, nullable=False)
    base_url = Column(String(255), nullable=False)
    api_key = Column(String(255), nullable=True)
    consumer_key = Column(String(255), nullable=True)
    consumer_secret = Column(String(255), nullable=True)
    access_token_secret = Column(String(255), nullable=True)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

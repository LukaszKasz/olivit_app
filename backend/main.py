from datetime import timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import engine, get_db, Base, SessionLocal
from models import User, IntegrationSettings
from auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from services.prestashop import (
    prestashop_client,
    PRESTASHOP_URL,
    PRESTASHOP_API_KEY,
)
from services.baselinker import (
    baselinker_client,
    BASELINKER_URL,
    BASELINKER_API_KEY,
)
from services.woocommerce import (
    woocommerce_client,
    WOOCOMMERCE_URL,
    WOOCOMMERCE_CONSUMER_KEY,
    WOOCOMMERCE_CONSUMER_SECRET,
    WOOCOMMERCE_VERIFY_SSL,
)
from services.shopify import (
    shopify_client,
    SHOPIFY_URL,
    SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET,
    SHOPIFY_VERIFY_SSL,
)
from services.magento import (
    magento_client,
    MAGENTO_URL,
    MAGENTO_ACCESS_TOKEN,
    MAGENTO_CONSUMER_KEY,
    MAGENTO_CONSUMER_SECRET,
    MAGENTO_ACCESS_TOKEN_SECRET,
    MAGENTO_VERIFY_SSL,
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="App Start Auth API",
    description="Authentication API - Base Template",
    version="1.0.0",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3300", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    username: str
    password: str


class PrestashopSettingsDTO(BaseModel):
    base_url: str
    api_key: str


class WooCommerceSettingsDTO(BaseModel):
    base_url: str
    consumer_key: str
    consumer_secret: str
    verify_ssl: bool


class BaselinkerSettingsDTO(BaseModel):
    base_url: str
    api_key: str


class ShopifySettingsDTO(BaseModel):
    base_url: str
    access_token: str
    api_key: str
    api_secret: str
    verify_ssl: bool


class MagentoSettingsDTO(BaseModel):
    base_url: str
    consumer_key: str
    consumer_secret: str
    access_token: str
    access_token_secret: str
    verify_ssl: bool


class IntegrationSettingsResponseDTO(BaseModel):
    prestashop: PrestashopSettingsDTO
    woocommerce: WooCommerceSettingsDTO
    baselinker: BaselinkerSettingsDTO
    shopify: ShopifySettingsDTO
    magento: MagentoSettingsDTO


class PrestashopSettingsUpdateDTO(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None


class WooCommerceSettingsUpdateDTO(BaseModel):
    base_url: Optional[str] = None
    consumer_key: Optional[str] = None
    consumer_secret: Optional[str] = None
    verify_ssl: Optional[bool] = None


class BaselinkerSettingsUpdateDTO(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None


class ShopifySettingsUpdateDTO(BaseModel):
    base_url: Optional[str] = None
    access_token: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    verify_ssl: Optional[bool] = None


class MagentoSettingsUpdateDTO(BaseModel):
    base_url: Optional[str] = None
    consumer_key: Optional[str] = None
    consumer_secret: Optional[str] = None
    access_token: Optional[str] = None
    access_token_secret: Optional[str] = None
    verify_ssl: Optional[bool] = None


class IntegrationSettingsUpdateDTO(BaseModel):
    prestashop: Optional[PrestashopSettingsUpdateDTO] = None
    woocommerce: Optional[WooCommerceSettingsUpdateDTO] = None
    baselinker: Optional[BaselinkerSettingsUpdateDTO] = None
    shopify: Optional[ShopifySettingsUpdateDTO] = None
    magento: Optional[MagentoSettingsUpdateDTO] = None


def ensure_integration_settings_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("integration_settings")}
    except Exception:
        return

    if "access_token_secret" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE integration_settings ADD COLUMN access_token_secret VARCHAR(255)"))


def ensure_integration_settings_seed(db: Session) -> None:
    defaults = {
        "prestashop": {
            "base_url": PRESTASHOP_URL,
            "api_key": PRESTASHOP_API_KEY,
            "verify_ssl": True,
        },
        "woocommerce": {
            "base_url": WOOCOMMERCE_URL,
            "consumer_key": WOOCOMMERCE_CONSUMER_KEY,
            "consumer_secret": WOOCOMMERCE_CONSUMER_SECRET,
            "verify_ssl": WOOCOMMERCE_VERIFY_SSL,
        },
        "baselinker": {
            "base_url": BASELINKER_URL,
            "api_key": BASELINKER_API_KEY,
            "verify_ssl": True,
        },
        "shopify": {
            "base_url": SHOPIFY_URL,
            "api_key": SHOPIFY_ACCESS_TOKEN,
            "consumer_key": SHOPIFY_API_KEY,
            "consumer_secret": SHOPIFY_API_SECRET,
            "verify_ssl": SHOPIFY_VERIFY_SSL,
        },
        "magento": {
            "base_url": MAGENTO_URL,
            "api_key": MAGENTO_ACCESS_TOKEN,
            "consumer_key": MAGENTO_CONSUMER_KEY,
            "consumer_secret": MAGENTO_CONSUMER_SECRET,
            "access_token_secret": MAGENTO_ACCESS_TOKEN_SECRET,
            "verify_ssl": MAGENTO_VERIFY_SSL,
        },
    }

    any_updates = False
    for provider, values in defaults.items():
        existing = db.query(IntegrationSettings).filter(IntegrationSettings.provider == provider).first()
        if existing:
            if provider == "magento":
                magento_backfilled = False
                if not (existing.base_url or "").strip():
                    existing.base_url = values.get("base_url")
                    any_updates = True
                    magento_backfilled = True
                elif (
                    existing.base_url in ("https://localhost:8444/rest", "http://localhost:8444/rest")
                    and "host.docker.internal" in (values.get("base_url") or "")
                ):
                    existing.base_url = values.get("base_url")
                    any_updates = True
                    magento_backfilled = True
                if not (existing.api_key or "").strip():
                    existing.api_key = values.get("api_key")
                    any_updates = True
                    magento_backfilled = True
                if not (existing.consumer_key or "").strip():
                    existing.consumer_key = values.get("consumer_key")
                    any_updates = True
                    magento_backfilled = True
                if not (existing.consumer_secret or "").strip():
                    existing.consumer_secret = values.get("consumer_secret")
                    any_updates = True
                    magento_backfilled = True
                if not (getattr(existing, "access_token_secret", "") or "").strip():
                    existing.access_token_secret = values.get("access_token_secret")
                    any_updates = True
                    magento_backfilled = True
                if magento_backfilled:
                    existing.verify_ssl = values.get("verify_ssl", existing.verify_ssl)
                    any_updates = True
                elif (
                    existing.base_url == values.get("base_url")
                    and existing.api_key == values.get("api_key")
                    and existing.consumer_key == values.get("consumer_key")
                    and existing.consumer_secret == values.get("consumer_secret")
                    and getattr(existing, "access_token_secret", None) == values.get("access_token_secret")
                    and existing.verify_ssl != values.get("verify_ssl", existing.verify_ssl)
                ):
                    existing.verify_ssl = values.get("verify_ssl", existing.verify_ssl)
                    any_updates = True
                elif values.get("verify_ssl") is False and existing.verify_ssl is True:
                    existing.verify_ssl = False
                    any_updates = True
            continue

        db.add(
            IntegrationSettings(
                provider=provider,
                base_url=values["base_url"],
                api_key=values.get("api_key"),
                consumer_key=values.get("consumer_key"),
                consumer_secret=values.get("consumer_secret"),
                access_token_secret=values.get("access_token_secret"),
                verify_ssl=values.get("verify_ssl", True),
            )
        )

    db.commit()


def get_integration_settings_map(db: Session) -> dict:
    ensure_integration_settings_schema()
    ensure_integration_settings_seed(db)
    rows = db.query(IntegrationSettings).all()
    return {row.provider: row for row in rows}


def apply_runtime_integration_settings(db: Session) -> None:
    settings = get_integration_settings_map(db)

    prestashop = settings.get("prestashop")
    if prestashop:
        prestashop_client.configure(
            base_url=prestashop.base_url,
            api_key=prestashop.api_key or "",
        )

    woocommerce = settings.get("woocommerce")
    if woocommerce:
        woocommerce_client.configure(
            base_url=woocommerce.base_url,
            consumer_key=woocommerce.consumer_key or "",
            consumer_secret=woocommerce.consumer_secret or "",
            verify_ssl=bool(woocommerce.verify_ssl),
        )

    baselinker = settings.get("baselinker")
    if baselinker:
        baselinker_client.configure(
            base_url=baselinker.base_url,
            api_key=baselinker.api_key or "",
        )

    shopify = settings.get("shopify")
    if shopify:
        shopify_client.configure(
            base_url=shopify.base_url,
            access_token=shopify.api_key or "",
            api_key=shopify.consumer_key or "",
            api_secret=shopify.consumer_secret or "",
            verify_ssl=bool(shopify.verify_ssl),
        )

    magento = settings.get("magento")
    if magento:
        magento_client.configure(
            base_url=magento.base_url,
            access_token=magento.api_key or "",
            consumer_key=magento.consumer_key or "",
            consumer_secret=magento.consumer_secret or "",
            access_token_secret=getattr(magento, "access_token_secret", "") or "",
            verify_ssl=bool(magento.verify_ssl),
        )


def build_settings_response(db: Session) -> IntegrationSettingsResponseDTO:
    settings = get_integration_settings_map(db)

    return IntegrationSettingsResponseDTO(
        prestashop=PrestashopSettingsDTO(
            base_url=settings["prestashop"].base_url,
            api_key=settings["prestashop"].api_key or "",
        ),
        woocommerce=WooCommerceSettingsDTO(
            base_url=settings["woocommerce"].base_url,
            consumer_key=settings["woocommerce"].consumer_key or "",
            consumer_secret=settings["woocommerce"].consumer_secret or "",
            verify_ssl=bool(settings["woocommerce"].verify_ssl),
        ),
        baselinker=BaselinkerSettingsDTO(
            base_url=settings["baselinker"].base_url,
            api_key=settings["baselinker"].api_key or "",
        ),
        shopify=ShopifySettingsDTO(
            base_url=settings["shopify"].base_url,
            access_token=settings["shopify"].api_key or "",
            api_key=settings["shopify"].consumer_key or "",
            api_secret=settings["shopify"].consumer_secret or "",
            verify_ssl=bool(settings["shopify"].verify_ssl),
        ),
        magento=MagentoSettingsDTO(
            base_url=settings["magento"].base_url,
            consumer_key=settings["magento"].consumer_key or "",
            consumer_secret=settings["magento"].consumer_secret or "",
            access_token=settings["magento"].api_key or "",
            access_token_secret=getattr(settings["magento"], "access_token_secret", "") or "",
            verify_ssl=bool(settings["magento"].verify_ssl),
        ),
    )


@app.on_event("startup")
def startup_seed_settings():
    db = SessionLocal()
    try:
        ensure_integration_settings_schema()
        ensure_integration_settings_seed(db)
    finally:
        db.close()


@app.get("/")
def read_root():
    """
    Root endpoint - API health check.
    """
    return {
        "message": "App Start Auth API is running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user.
    """
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Login endpoint - returns JWT token.
    """
    # Find user by username
    user = db.query(User).filter(User.username == login_data.username).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    Protected endpoint - requires valid JWT token.
    """
    return current_user


@app.get("/api/integrations/settings", response_model=IntegrationSettingsResponseDTO)
def get_integration_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current integration credentials/settings from DB.
    Protected endpoint - requires valid JWT token.
    """
    _ = current_user
    return build_settings_response(db)


@app.put("/api/integrations/settings", response_model=IntegrationSettingsResponseDTO)
def update_integration_settings(
    payload: IntegrationSettingsUpdateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update integration credentials/settings and save them to DB.
    Protected endpoint - requires valid JWT token.
    """
    _ = current_user
    settings = get_integration_settings_map(db)

    if payload.prestashop:
        row = settings["prestashop"]
        if payload.prestashop.base_url is not None:
            row.base_url = payload.prestashop.base_url
        if payload.prestashop.api_key is not None:
            row.api_key = payload.prestashop.api_key

    if payload.woocommerce:
        row = settings["woocommerce"]
        if payload.woocommerce.base_url is not None:
            row.base_url = payload.woocommerce.base_url
        if payload.woocommerce.consumer_key is not None:
            row.consumer_key = payload.woocommerce.consumer_key
        if payload.woocommerce.consumer_secret is not None:
            row.consumer_secret = payload.woocommerce.consumer_secret
        if payload.woocommerce.verify_ssl is not None:
            row.verify_ssl = payload.woocommerce.verify_ssl

    if payload.baselinker:
        row = settings["baselinker"]
        if payload.baselinker.base_url is not None:
            row.base_url = payload.baselinker.base_url
        if payload.baselinker.api_key is not None:
            row.api_key = payload.baselinker.api_key

    if payload.shopify:
        row = settings["shopify"]
        if payload.shopify.base_url is not None:
            row.base_url = payload.shopify.base_url
        if payload.shopify.access_token is not None:
            row.api_key = payload.shopify.access_token
        if payload.shopify.api_key is not None:
            row.consumer_key = payload.shopify.api_key
        if payload.shopify.api_secret is not None:
            row.consumer_secret = payload.shopify.api_secret
        if payload.shopify.verify_ssl is not None:
            row.verify_ssl = payload.shopify.verify_ssl

    if payload.magento:
        row = settings["magento"]
        if payload.magento.base_url is not None:
            row.base_url = payload.magento.base_url
        if payload.magento.consumer_key is not None:
            row.consumer_key = payload.magento.consumer_key
        if payload.magento.consumer_secret is not None:
            row.consumer_secret = payload.magento.consumer_secret
        if payload.magento.access_token is not None:
            row.api_key = payload.magento.access_token
        if payload.magento.access_token_secret is not None:
            row.access_token_secret = payload.magento.access_token_secret
        if payload.magento.verify_ssl is not None:
            row.verify_ssl = payload.magento.verify_ssl

    db.commit()
    apply_runtime_integration_settings(db)
    return build_settings_response(db)


@app.get("/api/orders")
async def get_all_orders(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch the latest orders from Prestashop, Baselinker, WooCommerce, Shopify, and Magento API.
    Protected endpoint - requires valid JWT token.
    """
    _ = current_user
    apply_runtime_integration_settings(db)

    try:
        presta_orders = await prestashop_client.get_latest_orders(1)
    except Exception as e:
        print(f"Prestashop fetch error: {e}")
        presta_orders = []

    try:
        bl_orders = await baselinker_client.get_latest_orders()
    except Exception as e:
        print(f"Baselinker fetch error: {e}")
        bl_orders = []

    try:
        woo_orders = await woocommerce_client.get_latest_orders(limit=1)
    except Exception as e:
        print(f"WooCommerce fetch error: {e}")
        woo_orders = []

    try:
        shopify_orders = await shopify_client.get_latest_orders(limit=5)
    except Exception as e:
        print(f"Shopify fetch error: {e}")
        shopify_orders = []

    try:
        magento_orders = await magento_client.get_latest_orders(limit=5)
    except Exception as e:
        print(f"Magento fetch error: {e}")
        magento_orders = []

    # Dla potrzeb POC (Proof of Concept) nie sortujemy ogólnie po dacie,
    # tylko zawsze dodajemy listę z Baselinkera bezpośrednio pod listą z PrestaShop.
    all_orders = woo_orders + shopify_orders + magento_orders + presta_orders[:1] + bl_orders[:limit]
    return all_orders


@app.get("/api/orders/{order_id}/details")
async def get_all_order_details(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch the details (products) of a specific order.
    Protected endpoint - requires valid JWT token.
    """
    _ = current_user
    apply_runtime_integration_settings(db)

    if str(order_id).startswith("BL-"):
        return await baselinker_client.get_order_details(order_id)
    if str(order_id).startswith("WC-"):
        return await woocommerce_client.get_order_details(order_id)
    if str(order_id).startswith("SH-"):
        return await shopify_client.get_order_details(order_id)
    if str(order_id).startswith("MG-"):
        return await magento_client.get_order_details(order_id)

    real_id = str(order_id).replace("PS-", "")
    return await prestashop_client.get_order_details(int(real_id))


@app.get("/health")
def health_check():
    """
    Health check endpoint for Docker.
    """
    return {"status": "healthy"}

import os
import json
from json import JSONDecodeError
from datetime import timedelta
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import DateTime, inspect, or_, text
from sqlalchemy.orm import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from database import engine, get_db, Base, SessionLocal
from main_product_orders_api import MainProductTestOrderCreate, MainProductTestOrderResponse
from main_products_api import MainProductResponse, ProductDetailedParameterResponse
from main_products_seed import MAIN_PRODUCTS
from models import (
    User,
    IntegrationSettings,
    MainProduct,
    MainProductTestOrder,
    VariantProduct,
    VariantProductBatchTestOrder,
    VariantProductBatchTestOrderArchive,
    VariantProductFinishedProductControl,
    ProductDetailedParameter,
)
from variant_products_api import VariantProductResponse, VariantProductsPageResponse
from variant_product_batch_orders_api import (
    VariantProductBatchArchiveRequest,
    VariantProductBatchCoARequest,
    VariantProductBatchTestOrderCreate,
    VariantProductBatchTestOrderResponse,
)
from variant_product_finished_product_controls_api import (
    VariantProductFinishedProductControlCreate,
    VariantProductFinishedProductControlResponse,
)
from variant_products_seed import load_variant_products_seed
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

MAIN_PRODUCT_NUMBERS = sorted({project_number for project_number, _ in MAIN_PRODUCTS}, key=len, reverse=True)
PDF_FONT_NAME = "DejaVuSans"
PDF_FONT_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")

if PDF_FONT_PATH.exists() and PDF_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
    pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, str(PDF_FONT_PATH)))


def get_project_number_from_variant_sku(sku: str) -> str | None:
    value = (sku or "").strip()
    for project_number in MAIN_PRODUCT_NUMBERS:
        if value.startswith(project_number):
            return project_number
    return None


def serialize_variant_product(product: VariantProduct) -> dict:
    return {
        "id": product.id,
        "sku": product.sku,
        "project_number": get_project_number_from_variant_sku(product.sku),
        "name": product.name,
        "ean": product.ean,
        "order_index": product.order_index,
    }


def serialize_variant_batch_row(row: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive) -> dict:
    return {
        "id": row.id,
        "sku": row.sku,
        "project_number": get_project_number_from_variant_sku(row.sku),
        "name": row.name,
        "ean": row.ean,
        "laboratory_name": row.laboratory_name,
        "batch_number": row.batch_number,
        "batch_added_at": row.batch_added_at,
        "ordered_at": row.ordered_at,
        "printed_material_type": row.printed_material_type,
        "product_name": row.product_name,
        "product_project_number": row.product_project_number,
        "product_ean_number": row.product_ean_number,
        "product_batch_number": row.product_batch_number,
        "product_expiry_date": row.product_expiry_date,
        "control_date": row.control_date,
        "market_label_version": row.market_label_version,
        "active_substances_match_pds": row.active_substances_match_pds,
        "label_version_matches_used_version": row.label_version_matches_used_version,
        "has_printing_errors": row.has_printing_errors,
        "has_graphic_design_errors": row.has_graphic_design_errors,
        "print_correctness": row.print_correctness,
        "has_labeling_errors": row.has_labeling_errors,
        "cap_is_correct": row.cap_is_correct,
        "induction_seal_weld_correct": row.induction_seal_weld_correct,
        "induction_seal_opening_correct": row.induction_seal_opening_correct,
        "package_is_dirty": row.package_is_dirty,
        "package_is_damaged": row.package_is_damaged,
        "qr_code_is_active": row.qr_code_is_active,
        "package_contents_match_card": row.package_contents_match_card,
        "product_verified": row.product_verified,
        "comment": row.comment,
        "control_saved_at": row.control_saved_at,
        "archived_at": getattr(row, "archived_at", None),
    }


def serialize_database_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def parse_database_value(value, column):
    if value is None:
        return None
    if isinstance(column.type, DateTime) and isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nieprawidlowa data w tabeli {column.table.name}, kolumna {column.name}.",
            ) from exc
    return value


def build_database_export() -> dict:
    payload = {
        "format": "olivit-database-export",
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tables": {},
    }

    with engine.connect() as connection:
        for table in Base.metadata.sorted_tables:
            rows = connection.execute(table.select().order_by(table.c.id if "id" in table.c else text("1"))).mappings().all()
            payload["tables"][table.name] = {
                "columns": [column.name for column in table.columns],
                "rows": [
                    {column.name: serialize_database_value(row[column.name]) for column in table.columns}
                    for row in rows
                ],
            }

    return payload


def import_database_export(payload: dict) -> dict:
    if payload.get("format") != "olivit-database-export":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="To nie jest plik eksportu bazy danych Olivit.",
        )

    tables_payload = payload.get("tables")
    if not isinstance(tables_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plik importu nie zawiera sekcji tables.",
        )

    metadata_tables = {table.name: table for table in Base.metadata.sorted_tables}
    unknown_tables = sorted(set(tables_payload) - set(metadata_tables))
    if unknown_tables:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plik zawiera nieznane tabele: {', '.join(unknown_tables)}.",
        )

    missing_tables = sorted(set(metadata_tables) - set(tables_payload))
    if missing_tables:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plik nie zawiera wszystkich tabel: {', '.join(missing_tables)}.",
        )

    imported_counts: dict[str, int] = {}
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())

        for table in Base.metadata.sorted_tables:
            table_payload = tables_payload.get(table.name, {})
            rows = table_payload.get("rows", [])
            if not isinstance(rows, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nieprawidlowe dane rows dla tabeli {table.name}.",
                )

            table_columns = {column.name: column for column in table.columns}
            parsed_rows = []
            for row in rows:
                if not isinstance(row, dict):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Nieprawidlowy wiersz w tabeli {table.name}.",
                    )

                unknown_columns = sorted(set(row) - set(table_columns))
                if unknown_columns:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Tabela {table.name} zawiera nieznane kolumny: {', '.join(unknown_columns)}.",
                    )

                parsed_rows.append({
                    column_name: parse_database_value(value, table_columns[column_name])
                    for column_name, value in row.items()
                })

            if parsed_rows:
                connection.execute(table.insert(), parsed_rows)
            imported_counts[table.name] = len(parsed_rows)

            if "id" in table.c:
                connection.execute(
                    text(
                        "SELECT setval("
                        "pg_get_serial_sequence(:table_name, 'id'), "
                        "COALESCE((SELECT MAX(id) FROM " + table.name + "), 1), "
                        "COALESCE((SELECT MAX(id) FROM " + table.name + "), 0) > 0"
                        ")"
                    ),
                    {"table_name": table.name},
                )

    return imported_counts


def format_date_for_pdf(value: datetime | str | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%d.%m.%Y")
    return str(value)


def build_coa_pdf(rows: list[VariantProductBatchTestOrder], details: list[ProductDetailedParameter], project_number: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    base_style = ParagraphStyle(
        "Base",
        parent=styles["BodyText"],
        fontName=PDF_FONT_NAME,
        fontSize=9,
        leading=12,
        spaceAfter=0,
    )
    title_style = ParagraphStyle("Title", parent=base_style, fontSize=16, leading=20, alignment=1)
    heading_style = ParagraphStyle("Heading", parent=base_style, fontSize=10, leading=13, alignment=1)
    section_style = ParagraphStyle("Section", parent=base_style, fontSize=10, leading=13)
    tiny_style = ParagraphStyle("Tiny", parent=base_style, fontSize=8, leading=10)

    story = [
        Paragraph("CERTIFICATE OF ANALYSIS / CERTYFIKAT ANALIZY", title_style),
        Spacer(1, 8 * mm),
        Paragraph(f"<b>CERTIFICATE ISSUE DATE</b><br/>{datetime.now().strftime('%d.%m.%Y')}", section_style),
        Spacer(1, 6 * mm),
    ]

    product_table_data = [[
        Paragraph("<b>PRODUCT NUMBER</b>", tiny_style),
        Paragraph("<b>NAME OF PRODUCT</b>", tiny_style),
        Paragraph("<b>LOT NUMBER</b>", tiny_style),
        Paragraph("<b>BEST BEFORE END</b>", tiny_style),
    ]]
    for row in rows:
        product_table_data.append([
            Paragraph(row.sku, base_style),
            Paragraph(row.name, base_style),
            Paragraph(row.batch_number, base_style),
            Paragraph(row.product_expiry_date or "", base_style),
        ])

    product_table = Table(product_table_data, colWidths=[34 * mm, 86 * mm, 28 * mm, 32 * mm], repeatRows=1)
    product_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), PDF_FONT_NAME),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([product_table, Spacer(1, 10 * mm)])

    parameter_table_data = [[
        Paragraph("<b>Parameters / Parametry</b>", tiny_style),
        Paragraph("<b>Requirement / Wymaganie</b>", tiny_style),
        Paragraph("<b>Method / Metoda</b>", tiny_style),
        Paragraph("<b>Confirmation / Potwierdzenie</b>", tiny_style),
    ]]
    group_row_indexes: list[int] = []
    current_group = None
    for detail in details:
        group_label = f"{detail.parameter_type_en} / {detail.parameter_type_pl}"
        if group_label != current_group:
            group_row_indexes.append(len(parameter_table_data))
            parameter_table_data.append([
                Paragraph(f"<b>{group_label}</b>", base_style),
                Paragraph("", base_style),
                Paragraph("", base_style),
                Paragraph("", base_style),
            ])
            current_group = group_label

        parameter_table_data.append([
            Paragraph(f"{detail.parameter_name_en} / {detail.parameter_name_pl}", base_style),
            Paragraph(f"{detail.requirement_en} / {detail.requirement_pl}", base_style),
            Paragraph(f"{detail.method_en} / {detail.method_pl}", base_style),
            Paragraph(f"{detail.confirmation_en or ''} / {detail.confirmation_pl or ''}".strip(" /"), base_style),
        ])

    parameter_table = Table(parameter_table_data, colWidths=[72 * mm, 40 * mm, 38 * mm, 30 * mm], repeatRows=1)
    parameter_table_style_commands = [
        ("FONTNAME", (0, 0), (-1, -1), PDF_FONT_NAME),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row_index in group_row_indexes:
        parameter_table_style_commands.extend([
            ("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#fcd34d")),
            ("TEXTCOLOR", (0, row_index), (-1, row_index), colors.HexColor("#78350f")),
            ("SPAN", (0, row_index), (-1, row_index)),
        ])

    parameter_table.setStyle(TableStyle(parameter_table_style_commands))
    story.extend([parameter_table, Spacer(1, 8 * mm)])

    story.extend([
        Paragraph("<b>LINKED DOCUMENTS / DOKUMENTY ZWIĄZANE:</b>", section_style),
        Spacer(1, 8 * mm),
        Paragraph("<b>CONCLUSION / WNIOSEK:</b>", section_style),
        Spacer(1, 2 * mm),
        Paragraph(
            (
                f"The product meets the requirements of the product specification in accordance with the product sheet {project_number}.<br/>"
                f"Produkt spełnia wymagania specyfikacji produktu zgodnie z kartą produktu {project_number}."
            ),
            base_style,
        ),
    ])

    doc.build(story)
    return buffer.getvalue()

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Olivit zarządzanie jakością API",
    description="API for the Olivit zarządzanie jakością application",
    version="1.0.0",
)

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3300",
    "http://localhost:5173",
    "http://localhost:8080",
]


def get_allowed_origins():
    configured_origins = os.getenv("CORS_ALLOW_ORIGINS")
    if not configured_origins:
        return DEFAULT_CORS_ORIGINS

    return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]


# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
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


def ensure_main_products_seed(db: Session) -> None:
    if db.query(MainProduct.id).first():
        return

    db.add_all([
        MainProduct(project_number=project_number, name=name, order_index=index)
        for index, (project_number, name) in enumerate(MAIN_PRODUCTS, start=1)
    ])
    db.commit()


def ensure_variant_products_seed(db: Session) -> None:
    if db.query(VariantProduct.id).first():
        return

    rows = load_variant_products_seed()
    db.add_all([
        VariantProduct(sku=sku, name=name, ean=ean, order_index=index)
        for index, (sku, name, ean) in enumerate(rows, start=1)
    ])
    db.commit()


def ensure_integration_settings_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("integration_settings")}
    except Exception:
        return

    if "access_token_secret" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE integration_settings ADD COLUMN access_token_secret VARCHAR(255)"))


def ensure_main_product_test_orders_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("main_product_test_orders")}
    except Exception:
        return

    if "batch_number" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE main_product_test_orders ADD COLUMN batch_number VARCHAR(255)"))

    if "laboratory_name" in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE main_product_test_orders ALTER COLUMN laboratory_name DROP NOT NULL"))


def ensure_variant_product_batch_test_orders_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("variant_product_batch_test_orders")}
    except Exception:
        return

    statements: list[str] = []
    if "laboratory_name" in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ALTER COLUMN laboratory_name DROP NOT NULL")
    if "ordered_at" in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ALTER COLUMN ordered_at DROP NOT NULL")

    extra_columns = {
        "batch_added_at": "TIMESTAMP WITH TIME ZONE",
        "printed_material_type": "VARCHAR(100)",
        "product_name": "VARCHAR(255)",
        "product_project_number": "VARCHAR(100)",
        "product_ean_number": "VARCHAR(255)",
        "product_batch_number": "VARCHAR(255)",
        "product_expiry_date": "VARCHAR(50)",
        "control_date": "VARCHAR(50)",
        "market_label_version": "VARCHAR(255)",
        "active_substances_match_pds": "VARCHAR(50)",
        "label_version_matches_used_version": "VARCHAR(10)",
        "has_printing_errors": "VARCHAR(10)",
        "has_graphic_design_errors": "VARCHAR(10)",
        "print_correctness": "VARCHAR(10)",
        "has_labeling_errors": "VARCHAR(10)",
        "cap_is_correct": "VARCHAR(20)",
        "induction_seal_weld_correct": "VARCHAR(20)",
        "induction_seal_opening_correct": "VARCHAR(20)",
        "package_is_dirty": "VARCHAR(10)",
        "package_is_damaged": "VARCHAR(10)",
        "qr_code_is_active": "VARCHAR(20)",
        "package_contents_match_card": "VARCHAR(10)",
        "product_verified": "VARCHAR(10)",
        "comment": "VARCHAR(2000)",
        "control_saved_at": "TIMESTAMP WITH TIME ZONE",
    }

    for column_name, column_type in extra_columns.items():
        if column_name not in columns:
            statements.append(f"ALTER TABLE variant_product_batch_test_orders ADD COLUMN {column_name} {column_type}")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

    if "batch_added_at" not in columns:
        with engine.begin() as connection:
            connection.execute(text("UPDATE variant_product_batch_test_orders SET batch_added_at = COALESCE(ordered_at, NOW()) WHERE batch_added_at IS NULL"))


def ensure_variant_product_finished_product_controls_schema() -> None:
    inspector = inspect(engine)
    try:
        inspector.get_columns("variant_product_finished_product_controls")
    except Exception:
        return


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
        ensure_main_product_test_orders_schema()
        ensure_variant_product_batch_test_orders_schema()
        ensure_variant_product_finished_product_controls_schema()
        ensure_integration_settings_seed(db)
        ensure_main_products_seed(db)
        ensure_variant_products_seed(db)
    finally:
        db.close()


@app.get("/")
def read_root():
    """
    Root endpoint - API health check.
    """
    return {
        "message": "Olivit zarządzanie jakością API is running",
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


@app.get("/api/database/export")
def export_database(current_user: User = Depends(get_current_user)):
    _ = current_user

    payload = build_database_export()
    data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"olivit-database-export-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/database/import")
async def import_database(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    try:
        content = await file.read()
        payload = json.loads(content.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plik importu musi byc zapisany jako UTF-8.",
        ) from exc
    except JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plik importu nie jest poprawnym plikiem JSON.",
        ) from exc

    imported_counts = import_database_export(payload)

    db = SessionLocal()
    try:
        apply_runtime_integration_settings(db)
    finally:
        db.close()

    return {
        "message": "Import zakonczony.",
        "tables": imported_counts,
    }


@app.get("/api/main-products", response_model=list[MainProductResponse])
def get_main_products(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    query = db.query(MainProduct)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                MainProduct.project_number.ilike(pattern),
                MainProduct.name.ilike(pattern),
            )
        )

    return query.order_by(MainProduct.order_index.asc()).all()


@app.get("/api/main-products/{product_id}/details", response_model=list[ProductDetailedParameterResponse])
def get_main_product_details(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    product = db.query(MainProduct).filter(MainProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if product.id_szczegolow_produktu is None:
        return []

    return (
        db.query(ProductDetailedParameter)
        .filter(ProductDetailedParameter.id_szczegolow_produktu == product.id_szczegolow_produktu)
        .order_by(ProductDetailedParameter.id.asc())
        .all()
    )


@app.get("/api/variant-products/projects/{project_number}/details", response_model=list[ProductDetailedParameterResponse])
def get_variant_project_details(
    project_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    product = db.query(MainProduct).filter(MainProduct.project_number == project_number).first()
    if not product or product.id_szczegolow_produktu is None:
        return []

    return (
        db.query(ProductDetailedParameter)
        .filter(ProductDetailedParameter.id_szczegolow_produktu == product.id_szczegolow_produktu)
        .order_by(ProductDetailedParameter.id.asc())
        .all()
    )


@app.get("/api/variant-products", response_model=VariantProductsPageResponse)
def get_variant_products(
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    page = max(page, 1)
    page_size = max(1, min(page_size, 100))

    query = db.query(VariantProduct)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                VariantProduct.sku.ilike(pattern),
                VariantProduct.name.ilike(pattern),
                VariantProduct.ean.ilike(pattern),
            )
        )

    total = query.count()
    items = (
        query.order_by(VariantProduct.order_index.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return VariantProductsPageResponse(
        items=[serialize_variant_product(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@app.get("/api/main-products/ordered-tests", response_model=list[MainProductTestOrderResponse])
def get_main_product_test_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return db.query(MainProductTestOrder).order_by(MainProductTestOrder.ordered_at.desc(), MainProductTestOrder.id.desc()).all()


@app.post("/api/main-products/ordered-tests", response_model=MainProductTestOrderResponse, status_code=status.HTTP_201_CREATED)
def create_main_product_test_order(
    payload: MainProductTestOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    project_number = payload.project_number.strip()
    name = payload.name.strip()
    laboratory_name = (payload.laboratory_name or "").strip()
    batch_number = payload.batch_number.strip()

    if not project_number or not name or not batch_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_number, name and batch_number are required",
        )

    order = MainProductTestOrder(
        project_number=project_number,
        name=name,
        laboratory_name=laboratory_name,
        batch_number=batch_number,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.get("/api/variant-products/batches/ordered-tests", response_model=list[VariantProductBatchTestOrderResponse])
def get_variant_product_batch_test_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    rows = (
        db.query(VariantProductBatchTestOrder)
        .order_by(VariantProductBatchTestOrder.batch_added_at.desc(), VariantProductBatchTestOrder.id.desc())
        .all()
    )
    return [serialize_variant_batch_row(row) for row in rows]


@app.get("/api/variant-products/batches/archive", response_model=list[VariantProductBatchTestOrderResponse])
def get_variant_product_batch_test_archive(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    rows = (
        db.query(VariantProductBatchTestOrderArchive)
        .order_by(VariantProductBatchTestOrderArchive.archived_at.desc(), VariantProductBatchTestOrderArchive.id.desc())
        .all()
    )
    return [serialize_variant_batch_row(row) for row in rows]


@app.post("/api/variant-products/batches/ordered-tests", response_model=VariantProductBatchTestOrderResponse, status_code=status.HTTP_201_CREATED)
def create_variant_product_batch_test_order(
    payload: VariantProductBatchTestOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    sku = payload.sku.strip()
    name = payload.name.strip()
    ean = payload.ean.strip()
    laboratory_name = (payload.laboratory_name or "").strip()
    batch_number = payload.batch_number.strip()

    if not sku or not name or not ean or not batch_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sku, name, ean and batch_number are required",
        )

    order = VariantProductBatchTestOrder(
        sku=sku,
        name=name,
        ean=ean,
        laboratory_name=laboratory_name or None,
        batch_number=batch_number,
        batch_added_at=datetime.now(timezone.utc),
        ordered_at=datetime.now(timezone.utc) if laboratory_name else None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return serialize_variant_batch_row(order)


@app.post("/api/variant-products/batches/archive", status_code=status.HTTP_201_CREATED)
def archive_variant_product_batch_test_orders(
    payload: VariantProductBatchArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    ids = sorted(set(payload.ids))
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ids are required",
        )

    rows = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.id.in_(ids))
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No rows found to archive",
        )

    for row in rows:
        db.add(
            VariantProductBatchTestOrderArchive(
                sku=row.sku,
                name=row.name,
                ean=row.ean,
                laboratory_name=row.laboratory_name,
                batch_number=row.batch_number,
                batch_added_at=row.batch_added_at,
                ordered_at=row.ordered_at,
                printed_material_type=row.printed_material_type,
                product_name=row.product_name,
                product_project_number=row.product_project_number,
                product_ean_number=row.product_ean_number,
                product_batch_number=row.product_batch_number,
                product_expiry_date=row.product_expiry_date,
                control_date=row.control_date,
                market_label_version=row.market_label_version,
                active_substances_match_pds=row.active_substances_match_pds,
                label_version_matches_used_version=row.label_version_matches_used_version,
                has_printing_errors=row.has_printing_errors,
                has_graphic_design_errors=row.has_graphic_design_errors,
                print_correctness=row.print_correctness,
                has_labeling_errors=row.has_labeling_errors,
                cap_is_correct=row.cap_is_correct,
                induction_seal_weld_correct=row.induction_seal_weld_correct,
                induction_seal_opening_correct=row.induction_seal_opening_correct,
                package_is_dirty=row.package_is_dirty,
                package_is_damaged=row.package_is_damaged,
                qr_code_is_active=row.qr_code_is_active,
                package_contents_match_card=row.package_contents_match_card,
                product_verified=row.product_verified,
                comment=row.comment,
                control_saved_at=row.control_saved_at,
                archived_at=datetime.now(timezone.utc),
            )
        )

    for row in rows:
        db.delete(row)

    db.commit()
    return {"archived_count": len(rows)}


@app.post("/api/variant-products/batches/coa")
def generate_variant_product_batch_coa(
    payload: VariantProductBatchCoARequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    ids = sorted(set(payload.ids))
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ids are required",
        )

    rows = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.id.in_(ids))
        .order_by(VariantProductBatchTestOrder.id.asc())
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No rows found for CoA",
        )

    project_numbers = {get_project_number_from_variant_sku(row.sku) for row in rows}
    project_numbers.discard(None)
    if len(project_numbers) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All selected rows must have the same project number",
        )

    project_number = next(iter(project_numbers))
    main_product = db.query(MainProduct).filter(MainProduct.project_number == project_number).first()
    if not main_product or main_product.id_szczegolow_produktu is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No detailed parameters found for project {project_number}",
        )

    detail_ids = sorted(set(payload.detail_ids))
    if not detail_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="detail_ids are required",
        )

    details = (
        db.query(ProductDetailedParameter)
        .filter(ProductDetailedParameter.id_szczegolow_produktu == main_product.id_szczegolow_produktu)
        .filter(ProductDetailedParameter.id.in_(detail_ids))
        .order_by(ProductDetailedParameter.id.asc())
        .all()
    )
    if not details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No detailed parameters found for project {project_number}",
        )

    pdf_bytes = build_coa_pdf(rows, details, project_number)
    filename = f"coa_{project_number}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/variant-products/finished-product-controls", response_model=list[VariantProductFinishedProductControlResponse])
def get_variant_product_finished_product_controls(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return (
        db.query(VariantProductFinishedProductControl)
        .order_by(VariantProductFinishedProductControl.created_at.desc(), VariantProductFinishedProductControl.id.desc())
        .all()
    )


@app.post(
    "/api/variant-products/finished-product-controls",
    response_model=VariantProductFinishedProductControlResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_variant_product_finished_product_control(
    payload: VariantProductFinishedProductControlCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    fields = {
        "sku": payload.sku.strip(),
        "name": payload.name.strip(),
        "ean": payload.ean.strip(),
        "printed_material_type": payload.printed_material_type.strip(),
        "product_name": payload.product_name.strip(),
        "product_project_number": payload.product_project_number.strip(),
        "product_ean_number": payload.product_ean_number.strip(),
        "product_batch_number": payload.product_batch_number.strip(),
        "product_expiry_date": payload.product_expiry_date.strip(),
        "control_date": payload.control_date.strip(),
        "market_label_version": payload.market_label_version.strip(),
        "active_substances_match_pds": payload.active_substances_match_pds.strip(),
        "label_version_matches_used_version": payload.label_version_matches_used_version.strip(),
        "has_printing_errors": payload.has_printing_errors.strip(),
        "has_graphic_design_errors": payload.has_graphic_design_errors.strip(),
        "print_correctness": payload.print_correctness.strip(),
        "has_labeling_errors": payload.has_labeling_errors.strip(),
        "cap_is_correct": payload.cap_is_correct.strip(),
        "induction_seal_weld_correct": payload.induction_seal_weld_correct.strip(),
        "induction_seal_opening_correct": payload.induction_seal_opening_correct.strip(),
        "package_is_dirty": payload.package_is_dirty.strip(),
        "package_is_damaged": payload.package_is_damaged.strip(),
        "qr_code_is_active": payload.qr_code_is_active.strip(),
        "package_contents_match_card": payload.package_contents_match_card.strip(),
        "product_verified": payload.product_verified.strip(),
    }

    if any(not value for value in fields.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All required finished product control fields must be filled in",
        )

    order = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.id == payload.ordered_test_id)
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono partii do uzupełnienia formularza",
        )

    if order.sku != fields["sku"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dane formularza nie pasują do wybranej partii",
        )

    for key, value in fields.items():
        setattr(order, key, value)

    order.batch_number = fields["product_batch_number"]
    order.comment = (payload.comment or "").strip() or None
    order.control_saved_at = datetime.utcnow()

    control = VariantProductFinishedProductControl(
        **fields,
        comment=order.comment,
    )
    db.add(control)
    db.commit()
    db.refresh(control)
    db.refresh(order)
    return control


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

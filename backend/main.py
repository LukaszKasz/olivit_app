import os
import json
import logging
import httpx
from json import JSONDecodeError
from collections import deque
from datetime import timedelta
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from time import perf_counter
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import DateTime, inspect, or_, text, func, select
from sqlalchemy.orm import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from database import engine, get_db, Base, SessionLocal
from main_product_orders_api import MainProductTestOrderCreate, MainProductTestOrderResponse, MainProductTestOrderUpdate
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
    VariantProductBatchRelatedLabelControlsResponse,
    VariantProductBatchRetestRequest,
    VariantProductBatchRelatedLabelControlResponse,
    VariantProductBatchTestOrderBulkCreate,
    VariantProductBatchDocumentsRequest,
    VariantProductBatchTestOrderCreate,
    VariantProductBatchTestOrderResponse,
    VariantProductBatchTestOrderUpdate,
)
from variant_product_finished_product_controls_api import (
    VariantProductFinishedProductControlBulkIds,
    VariantProductFinishedProductControlBulkStatusUpdate,
    VariantProductFinishedProductControlCreate,
    VariantProductFinishedProductControlPlaceholderRequest,
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
from brd_export import build_brd_docx_bytes
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
ASANA_URL = os.getenv("ASANA_URL", "https://app.asana.com/api/1.0")
ASANA_ACCESS_TOKEN = os.getenv("ASANA_ACCESS_TOKEN", "")

if PDF_FONT_PATH.exists() and PDF_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
    pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, str(PDF_FONT_PATH)))


class InMemoryLogHandler(logging.Handler):
    def __init__(self, capacity: int = 200):
        super().__init__()
        self.records = deque(maxlen=capacity)

    def emit(self, record: logging.LogRecord) -> None:
        self.records.appendleft({
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        })


diagnostics_log_handler = InMemoryLogHandler()
app_logger = logging.getLogger("olivit.app")
if not any(isinstance(handler, InMemoryLogHandler) for handler in app_logger.handlers):
    diagnostics_log_handler.setLevel(logging.INFO)
    app_logger.addHandler(diagnostics_log_handler)
app_logger.setLevel(logging.INFO)
app_logger.propagate = False


def mask_database_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    host = parsed.hostname or "unknown-host"
    port = f":{parsed.port}" if parsed.port else ""
    database_name = parsed.path.lstrip("/") or "unknown-db"
    return f"{parsed.scheme}://{host}{port}/{database_name}"


def get_recent_logs(limit: int = 50) -> list[dict]:
    return list(diagnostics_log_handler.records)[:limit]


def get_project_number_from_variant_sku(sku: str) -> str | None:
    value = (sku or "").strip()
    for project_number in MAIN_PRODUCT_NUMBERS:
        if value.startswith(project_number):
            return project_number
    return None


def get_variant_batch_row_test_order_id(row: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive) -> int | None:
    if isinstance(row, VariantProductBatchTestOrderArchive):
        return row.ordered_test_id or row.id
    return row.id


def get_variant_batch_related_controls_source_id(
    row: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
) -> int | None:
    workflow_status = (getattr(row, "workflow_status", None) or "").strip()
    original_test_order_id = getattr(row, "original_test_order_id", None)
    if workflow_status in {"retest_ordered", "retest_requested"} and original_test_order_id is not None:
        return original_test_order_id
    return get_variant_batch_row_test_order_id(row) or row.id


def parse_linked_document_names(value: str | None) -> list[str]:
    raw = (value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except JSONDecodeError:
        return [line.strip() for line in raw.splitlines() if line.strip()]
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()]


def serialize_linked_document_names(names: list[str]) -> str | None:
    normalized: list[str] = []
    for name in names:
        value = str(name or "").strip()
        if value and value not in normalized:
            normalized.append(value)
    if not normalized:
        return None
    return json.dumps(normalized, ensure_ascii=False)


def build_default_coa_conclusion(project_number: str) -> str:
    return (
        f"The product meets the requirements of the product specification in accordance with the product sheet {project_number}.\n"
        f"Produkt spełnia wymagania specyfikacji produktu zgodnie z kartą produktu {project_number}."
    )


def does_control_match_order(
    control: VariantProductFinishedProductControl,
    order: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
) -> bool:
    if control.sku != order.sku:
        return False
    control_batch_number = (control.product_batch_number or "").strip()
    if control_batch_number and control_batch_number != (order.batch_number or "").strip():
        return False
    if (control.ean or "").strip() and control.ean != (order.ean or "").strip():
        return False
    return True


def does_control_match_order_group(
    control: VariantProductFinishedProductControl,
    order: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
) -> bool:
    control_project_number = (control.product_project_number or get_project_number_from_variant_sku(control.sku) or "").strip()
    order_project_number = (get_project_number_from_variant_sku(order.sku) or "").strip()
    if not control_project_number or control_project_number != order_project_number:
        return False

    control_laboratory_name = (control.laboratory_name or "").strip()
    order_laboratory_name = (order.laboratory_name or "").strip()
    if control_laboratory_name and order_laboratory_name and control_laboratory_name != order_laboratory_name:
        return False

    control_asana_task_number = (control.asana_task_number or "").strip()
    order_asana_task_number = (order.asana_task_number or "").strip()
    if control_asana_task_number and order_asana_task_number and control_asana_task_number != order_asana_task_number:
        return False

    return True


def get_variant_batch_order_reference_timestamp(
    order: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
) -> datetime | None:
    for field_name in ("ordered_at", "batch_added_at", "archived_at"):
        value = getattr(order, field_name, None)
        if value is not None:
            return value
    return None


def find_group_order_for_control(
    control: VariantProductFinishedProductControl,
    orders: list[VariantProductBatchTestOrder],
    archived_orders: list[VariantProductBatchTestOrderArchive],
) -> VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive | None:
    candidates = [
        order
        for order in [*orders, *archived_orders]
        if does_control_match_order_group(control, order)
    ]
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    control_timestamp = control.created_at
    if control_timestamp is None:
        return None

    ranked_candidates: list[tuple[float, VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive]] = []
    for order in candidates:
        reference_timestamp = get_variant_batch_order_reference_timestamp(order)
        if reference_timestamp is None:
            continue
        ranked_candidates.append((abs((reference_timestamp - control_timestamp).total_seconds()), order))

    if not ranked_candidates:
        return None

    ranked_candidates.sort(key=lambda item: item[0])
    if len(ranked_candidates) == 1:
        return ranked_candidates[0][1]

    best_diff, best_order = ranked_candidates[0]
    second_diff, _ = ranked_candidates[1]
    if best_diff <= 300 or best_diff + 300 < second_diff:
        return best_order

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


def serialize_variant_batch_row(
    row: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
    *,
    label_control_id: int | None = None,
    label_status: str | None = None,
    related_label_controls_count: int = 0,
    related_label_controls_resolved_count: int = 0,
) -> dict:
    return {
        "id": row.id,
        "test_order_id": get_variant_batch_row_test_order_id(row),
        "original_test_order_id": getattr(row, "original_test_order_id", None),
        "related_label_controls_count": related_label_controls_count,
        "related_label_controls_resolved_count": related_label_controls_resolved_count,
        "label_control_id": label_control_id,
        "sku": row.sku,
        "project_number": get_project_number_from_variant_sku(row.sku),
        "name": row.name,
        "ean": row.ean,
        "laboratory_name": row.laboratory_name,
        "batch_number": row.batch_number,
        "asana_task_number": row.asana_task_number,
        "purchase_order_number": row.purchase_order_number,
        "test_cost": row.test_cost,
        "batch_added_at": row.batch_added_at,
        "ordered_at": row.ordered_at,
        "production_date": row.production_date,
        "expiry_date": row.expiry_date,
        "planned_test_date": row.planned_test_date,
        "test_cost": row.test_cost,
        "po_number": row.po_number,
        "workflow_status": row.workflow_status,
        "clarification_note": row.clarification_note,
        "label_status": label_status if label_status is not None else row.label_status,
        "printed_material_type": row.printed_material_type,
        "product_name": row.product_name,
        "product_project_number": row.product_project_number,
        "product_ean_number": row.product_ean_number,
        "product_batch_number": row.product_batch_number,
        "product_expiry_date": row.product_expiry_date,
        "control_date": row.control_date,
        "market_label_version": row.market_label_version,
        "active_substances_match_pds": row.active_substances_match_pds,
        "active_substances_match_pds_note": row.active_substances_match_pds_note,
        "label_version_matches_used_version": row.label_version_matches_used_version,
        "label_version_matches_used_version_note": row.label_version_matches_used_version_note,
        "has_printing_errors": row.has_printing_errors,
        "has_printing_errors_note": row.has_printing_errors_note,
        "has_graphic_design_errors": row.has_graphic_design_errors,
        "has_graphic_design_errors_note": row.has_graphic_design_errors_note,
        "print_correctness": row.print_correctness,
        "print_correctness_note": row.print_correctness_note,
        "has_labeling_errors": row.has_labeling_errors,
        "has_labeling_errors_note": row.has_labeling_errors_note,
        "cap_is_correct": row.cap_is_correct,
        "cap_is_correct_note": row.cap_is_correct_note,
        "induction_seal_weld_correct": row.induction_seal_weld_correct,
        "induction_seal_weld_correct_note": row.induction_seal_weld_correct_note,
        "induction_seal_opening_correct": row.induction_seal_opening_correct,
        "induction_seal_opening_correct_note": row.induction_seal_opening_correct_note,
        "package_is_dirty": row.package_is_dirty,
        "package_is_dirty_note": row.package_is_dirty_note,
        "package_is_damaged": row.package_is_damaged,
        "package_is_damaged_note": row.package_is_damaged_note,
        "qr_code_is_active": row.qr_code_is_active,
        "qr_code_is_active_note": row.qr_code_is_active_note,
        "package_contents_match_card": row.package_contents_match_card,
        "package_contents_match_card_note": row.package_contents_match_card_note,
        "product_verified": row.product_verified,
        "product_verified_note": row.product_verified_note,
        "comment": row.comment,
        "linked_document_names": parse_linked_document_names(getattr(row, "linked_document_names", None)),
        "control_saved_at": row.control_saved_at,
        "archived_at": getattr(row, "archived_at", None),
    }


def serialize_variant_related_label_control_row(row: VariantProductFinishedProductControl) -> dict:
    return {
        "id": row.id,
        "ordered_test_id": row.ordered_test_id,
        "sku": row.sku,
        "name": row.name,
        "ean": row.ean,
        "laboratory_name": row.laboratory_name,
        "asana_task_number": row.asana_task_number,
        "label_status": row.label_status,
        "product_batch_number": row.product_batch_number,
        "product_expiry_date": row.product_expiry_date,
    }


def serialize_variant_finished_product_control_row(
    row: VariantProductFinishedProductControl,
    *,
    original_test_order_id: int | None = None,
    original_label_control_id: int | None = None,
    po_number: str | None = None,
) -> dict:
    return {
        "id": row.id,
        "ordered_test_id": row.ordered_test_id,
        "test_order_id": row.ordered_test_id,
        "original_test_order_id": original_test_order_id,
        "label_control_id": row.id,
        "original_label_control_id": original_label_control_id,
        "project_number": get_project_number_from_variant_sku(row.sku),
        "po_number": po_number,
        "sku": row.sku,
        "name": row.name,
        "ean": row.ean,
        "laboratory_name": row.laboratory_name,
        "asana_task_number": row.asana_task_number,
        "label_status": row.label_status,
        "printed_material_type": row.printed_material_type,
        "product_name": row.product_name,
        "product_project_number": row.product_project_number,
        "product_ean_number": row.product_ean_number,
        "product_batch_number": row.product_batch_number,
        "product_expiry_date": row.product_expiry_date,
        "control_date": row.control_date,
        "market_label_version": row.market_label_version,
        "active_substances_match_pds": row.active_substances_match_pds,
        "active_substances_match_pds_note": row.active_substances_match_pds_note,
        "label_version_matches_used_version": row.label_version_matches_used_version,
        "label_version_matches_used_version_note": row.label_version_matches_used_version_note,
        "has_printing_errors": row.has_printing_errors,
        "has_printing_errors_note": row.has_printing_errors_note,
        "has_graphic_design_errors": row.has_graphic_design_errors,
        "has_graphic_design_errors_note": row.has_graphic_design_errors_note,
        "print_correctness": row.print_correctness,
        "print_correctness_note": row.print_correctness_note,
        "has_labeling_errors": row.has_labeling_errors,
        "has_labeling_errors_note": row.has_labeling_errors_note,
        "cap_is_correct": row.cap_is_correct,
        "cap_is_correct_note": row.cap_is_correct_note,
        "induction_seal_weld_correct": row.induction_seal_weld_correct,
        "induction_seal_weld_correct_note": row.induction_seal_weld_correct_note,
        "induction_seal_opening_correct": row.induction_seal_opening_correct,
        "induction_seal_opening_correct_note": row.induction_seal_opening_correct_note,
        "package_is_dirty": row.package_is_dirty,
        "package_is_dirty_note": row.package_is_dirty_note,
        "package_is_damaged": row.package_is_damaged,
        "package_is_damaged_note": row.package_is_damaged_note,
        "qr_code_is_active": row.qr_code_is_active,
        "qr_code_is_active_note": row.qr_code_is_active_note,
        "package_contents_match_card": row.package_contents_match_card,
        "package_contents_match_card_note": row.package_contents_match_card_note,
        "product_verified": row.product_verified,
        "product_verified_note": row.product_verified_note,
        "comment": row.comment,
        "created_at": row.created_at,
    }


def derive_variant_label_status(control: VariantProductFinishedProductControl) -> str:
    issue_flags = [
        control.active_substances_match_pds not in {"Tak", "Nie dotyczy"},
        control.label_version_matches_used_version != "Tak",
        control.has_printing_errors != "Nie",
        control.has_graphic_design_errors != "Nie",
        control.print_correctness != "Tak",
        control.has_labeling_errors != "Nie",
        control.cap_is_correct not in {"Tak", "Nie dotyczy"},
        control.induction_seal_weld_correct not in {"Tak", "Nie dotyczy"},
        control.induction_seal_opening_correct not in {"Tak", "Nie dotyczy"},
        control.package_is_dirty != "Nie",
        control.package_is_damaged != "Nie",
        control.qr_code_is_active not in {"Tak", "Nie dotyczy"},
        control.package_contents_match_card != "Tak",
        control.product_verified != "Tak",
    ]
    return "incorrect" if any(issue_flags) else "correct"


def does_control_belong_to_batch_group(
    control: VariantProductFinishedProductControl,
    row: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
) -> bool:
    test_order_id = get_variant_batch_related_controls_source_id(row)
    if control.ordered_test_id == test_order_id:
        return True

    project_number = get_project_number_from_variant_sku(row.sku) or ""
    if not project_number or control.product_project_number != project_number:
        return False

    if control.ordered_test_id is not None:
        return False

    row_laboratory_name = (row.laboratory_name or "").strip()
    control_laboratory_name = (control.laboratory_name or "").strip()
    if row_laboratory_name and control_laboratory_name != row_laboratory_name:
        return False

    row_asana_task_number = (row.asana_task_number or "").strip()
    control_asana_task_number = (control.asana_task_number or "").strip()
    if row_asana_task_number and control_asana_task_number != row_asana_task_number:
        return False

    return True


def get_related_label_controls_for_batch_rows(
    db: Session,
    rows: list[VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive],
) -> dict[int, list[dict]]:
    if not rows:
        return {}

    project_numbers = sorted({
        get_project_number_from_variant_sku(row.sku)
        for row in rows
        if get_project_number_from_variant_sku(row.sku)
    })
    if not project_numbers:
        return {get_variant_batch_row_test_order_id(row) or row.id: [] for row in rows}

    controls = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.product_project_number.in_(project_numbers))
        .order_by(VariantProductFinishedProductControl.created_at.asc(), VariantProductFinishedProductControl.id.asc())
        .all()
    )

    result: dict[int, list[dict]] = {}
    for row in rows:
        row_key = get_variant_batch_row_test_order_id(row) or row.id
        source_test_order_id = get_variant_batch_related_controls_source_id(row)
        matched_controls = [
            control for control in controls if does_control_belong_to_batch_group(control, row)
        ]
        matched_controls.sort(
            key=lambda control: (
                0 if control.ordered_test_id == source_test_order_id else 1,
                control.sku,
                control.name,
                control.id,
            )
        )
        result[row_key] = [serialize_variant_related_label_control_row(control) for control in matched_controls]

    return result


def get_aggregated_label_status(related_controls: list[dict]) -> str | None:
    active_statuses = [
        (control.get("label_status") or "current")
        for control in related_controls
        if (control.get("label_status") or "current") != "archived"
    ]
    if not active_statuses:
        return None
    if any(status == "incorrect" for status in active_statuses):
        return "incorrect"
    if all(status == "current" for status in active_statuses):
        return "current"
    if all(status == "correct" for status in active_statuses):
        return "correct"
    if any(status == "current" for status in active_statuses) and any(status == "correct" for status in active_statuses):
        return "in_progress"
    if any(status == "current" for status in active_statuses):
        return "current"
    if any(status == "correct" for status in active_statuses):
        return "correct"
    return None


def get_related_label_control_entities_for_batch_row(
    db: Session,
    row: VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive,
) -> list[VariantProductFinishedProductControl]:
    project_number = get_project_number_from_variant_sku(row.sku)
    if not project_number:
        return []

    controls = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.product_project_number == project_number)
        .order_by(VariantProductFinishedProductControl.created_at.asc(), VariantProductFinishedProductControl.id.asc())
        .all()
    )
    return [control for control in controls if does_control_belong_to_batch_group(control, row)]


def create_default_variant_finished_product_control(
    order: VariantProductBatchTestOrder,
) -> VariantProductFinishedProductControl:
    project_number = get_project_number_from_variant_sku(order.sku) or ""
    return VariantProductFinishedProductControl(
        ordered_test_id=order.id,
        sku=order.sku,
        name=order.name,
        ean=order.ean,
        laboratory_name=order.laboratory_name,
        asana_task_number=order.asana_task_number,
        label_status="current",
        printed_material_type="",
        product_name=order.name,
        product_project_number=project_number,
        product_ean_number=order.ean,
        product_batch_number=order.batch_number,
        product_expiry_date=order.expiry_date or "",
        control_date="",
        market_label_version="",
        active_substances_match_pds="",
        active_substances_match_pds_note=None,
        label_version_matches_used_version="",
        label_version_matches_used_version_note=None,
        has_printing_errors="",
        has_printing_errors_note=None,
        has_graphic_design_errors="",
        has_graphic_design_errors_note=None,
        print_correctness="",
        print_correctness_note=None,
        has_labeling_errors="",
        has_labeling_errors_note=None,
        cap_is_correct="",
        cap_is_correct_note=None,
        induction_seal_weld_correct="",
        induction_seal_weld_correct_note=None,
        induction_seal_opening_correct="",
        induction_seal_opening_correct_note=None,
        package_is_dirty="",
        package_is_dirty_note=None,
        package_is_damaged="",
        package_is_damaged_note=None,
        qr_code_is_active="",
        qr_code_is_active_note=None,
        package_contents_match_card="",
        package_contents_match_card_note=None,
        product_verified="",
        product_verified_note=None,
        comment=None,
    )


def create_variant_finished_product_control_placeholder(
    *,
    sku: str,
    name: str,
    ean: str,
    laboratory_name: str | None,
    asana_task_number: str | None,
    product_project_number: str,
    product_batch_number: str,
    product_expiry_date: str | None,
) -> VariantProductFinishedProductControl:
    return VariantProductFinishedProductControl(
        ordered_test_id=None,
        sku=sku,
        name=name,
        ean=ean,
        laboratory_name=laboratory_name,
        asana_task_number=asana_task_number,
        label_status="current",
        printed_material_type="",
        product_name=name,
        product_project_number=product_project_number,
        product_ean_number=ean,
        product_batch_number=product_batch_number,
        product_expiry_date=product_expiry_date or "",
        control_date="",
        market_label_version="",
        active_substances_match_pds="",
        active_substances_match_pds_note=None,
        label_version_matches_used_version="",
        label_version_matches_used_version_note=None,
        has_printing_errors="",
        has_printing_errors_note=None,
        has_graphic_design_errors="",
        has_graphic_design_errors_note=None,
        print_correctness="",
        print_correctness_note=None,
        has_labeling_errors="",
        has_labeling_errors_note=None,
        cap_is_correct="",
        cap_is_correct_note=None,
        induction_seal_weld_correct="",
        induction_seal_weld_correct_note=None,
        induction_seal_opening_correct="",
        induction_seal_opening_correct_note=None,
        package_is_dirty="",
        package_is_dirty_note=None,
        package_is_damaged="",
        package_is_damaged_note=None,
        qr_code_is_active="",
        qr_code_is_active_note=None,
        package_contents_match_card="",
        package_contents_match_card_note=None,
        product_verified="",
        product_verified_note=None,
        comment=None,
    )


def create_variant_finished_product_control_from_batch_data(
    *,
    sku: str,
    name: str,
    ean: str,
    batch_number: str,
    expiry_date: str | None = None,
    laboratory_name: str | None = None,
    asana_task_number: str | None = None,
    ordered_test_id: int | None = None,
) -> VariantProductFinishedProductControl:
    project_number = get_project_number_from_variant_sku(sku) or ""
    return VariantProductFinishedProductControl(
        ordered_test_id=ordered_test_id,
        sku=sku,
        name=name,
        ean=ean,
        laboratory_name=laboratory_name,
        asana_task_number=asana_task_number,
        label_status="current",
        printed_material_type="",
        product_name=name,
        product_project_number=project_number,
        product_ean_number=ean,
        product_batch_number=batch_number,
        product_expiry_date=expiry_date or "",
        control_date="",
        market_label_version="",
        active_substances_match_pds="",
        active_substances_match_pds_note=None,
        label_version_matches_used_version="",
        label_version_matches_used_version_note=None,
        has_printing_errors="",
        has_printing_errors_note=None,
        has_graphic_design_errors="",
        has_graphic_design_errors_note=None,
        print_correctness="",
        print_correctness_note=None,
        has_labeling_errors="",
        has_labeling_errors_note=None,
        cap_is_correct="",
        cap_is_correct_note=None,
        induction_seal_weld_correct="",
        induction_seal_weld_correct_note=None,
        induction_seal_opening_correct="",
        induction_seal_opening_correct_note=None,
        package_is_dirty="",
        package_is_dirty_note=None,
        package_is_damaged="",
        package_is_damaged_note=None,
        qr_code_is_active="",
        qr_code_is_active_note=None,
        package_contents_match_card="",
        package_contents_match_card_note=None,
        product_verified="",
        product_verified_note=None,
        comment=None,
    )


def match_variant_order_for_control(
    control: VariantProductFinishedProductControl,
    orders: list[VariantProductBatchTestOrder],
    archived_orders: list[VariantProductBatchTestOrderArchive],
) -> VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive | None:
    for collection in (orders, archived_orders):
        for order in collection:
            if does_control_match_order(control, order):
                return order
    return find_group_order_for_control(control, orders, archived_orders)


def ensure_variant_product_finished_product_control_links(db: Session) -> None:
    orders = (
        db.query(VariantProductBatchTestOrder)
        .order_by(VariantProductBatchTestOrder.id.asc())
        .all()
    )
    archived_orders = (
        db.query(VariantProductBatchTestOrderArchive)
        .order_by(VariantProductBatchTestOrderArchive.id.asc())
        .all()
    )
    controls = (
        db.query(VariantProductFinishedProductControl)
        .order_by(VariantProductFinishedProductControl.id.asc())
        .all()
    )
    orders_eligible_for_control_links = [
        order for order in orders if (order.workflow_status or "").strip() != "retest_ordered"
    ]

    changed = False
    linked_order_ids = {control.ordered_test_id for control in controls if control.ordered_test_id is not None}

    order_lookup = {order.id: order for order in orders}
    archived_order_lookup = {
        order.ordered_test_id: order
        for order in archived_orders
        if order.ordered_test_id is not None
    }

    for control in controls:
        if control.ordered_test_id is None:
            continue
        linked_order = order_lookup.get(control.ordered_test_id) or archived_order_lookup.get(control.ordered_test_id)
        if linked_order and does_control_match_order(control, linked_order):
            continue
        control.ordered_test_id = None
        db.add(control)
        changed = True

    linked_order_ids = {control.ordered_test_id for control in controls if control.ordered_test_id is not None}

    for archived_order in archived_orders:
        if archived_order.ordered_test_id is None:
            matching_control = next(
                (
                    control
                    for control in controls
                    if control.ordered_test_id is not None
                    and control.sku == archived_order.sku
                    and (control.product_batch_number or "").strip() == archived_order.batch_number
                ),
                None,
            )
            if matching_control:
                archived_order.ordered_test_id = matching_control.ordered_test_id
            else:
                archived_order.ordered_test_id = archived_order.id
            db.add(archived_order)
            changed = True

    for control in controls:
        if control.ordered_test_id is not None:
            continue
        matched_order = match_variant_order_for_control(control, orders_eligible_for_control_links, archived_orders)
        if not matched_order:
            continue
        control.ordered_test_id = get_variant_batch_row_test_order_id(matched_order)
        control.laboratory_name = control.laboratory_name or matched_order.laboratory_name
        control.asana_task_number = control.asana_task_number or matched_order.asana_task_number
        linked_order_ids.add(control.ordered_test_id)
        db.add(control)
        changed = True

    for order in orders_eligible_for_control_links:
        if order.id in linked_order_ids:
            continue
        control = create_default_variant_finished_product_control(order)
        db.add(control)
        linked_order_ids.add(order.id)
        changed = True

    if changed:
        db.commit()


def get_variant_finished_product_control_id_map(
    db: Session,
    test_order_ids: list[int],
) -> dict[int, int]:
    normalized_ids = sorted({value for value in test_order_ids if value is not None})
    if not normalized_ids:
        return {}
    rows = (
        db.query(
            VariantProductFinishedProductControl.ordered_test_id,
            VariantProductFinishedProductControl.id,
        )
        .filter(VariantProductFinishedProductControl.ordered_test_id.in_(normalized_ids))
        .order_by(
            VariantProductFinishedProductControl.ordered_test_id.asc(),
            VariantProductFinishedProductControl.id.desc(),
        )
        .all()
    )
    result: dict[int, int] = {}
    for ordered_test_id, control_id in rows:
        if ordered_test_id is not None and ordered_test_id not in result:
            result[ordered_test_id] = control_id
    return result


def get_variant_finished_product_control_map(
    db: Session,
    test_order_ids: list[int],
) -> dict[int, VariantProductFinishedProductControl]:
    normalized_ids = sorted({value for value in test_order_ids if value is not None})
    if not normalized_ids:
        return {}
    rows = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.ordered_test_id.in_(normalized_ids))
        .order_by(
            VariantProductFinishedProductControl.ordered_test_id.asc(),
            VariantProductFinishedProductControl.id.desc(),
        )
        .all()
    )
    result: dict[int, VariantProductFinishedProductControl] = {}
    for row in rows:
        if row.ordered_test_id is not None and row.ordered_test_id not in result:
            result[row.ordered_test_id] = row
    return result


def get_variant_finished_product_control_map_for_batch_rows(
    db: Session,
    rows: list[VariantProductBatchTestOrder | VariantProductBatchTestOrderArchive],
) -> dict[int, VariantProductFinishedProductControl]:
    source_ids = [
        get_variant_batch_related_controls_source_id(row)
        for row in rows
        if get_variant_batch_related_controls_source_id(row) is not None
    ]
    return get_variant_finished_product_control_map(db, source_ids)


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


def build_database_tables_overview() -> list[dict]:
    overview: list[dict] = []
    with engine.connect() as connection:
        for table in Base.metadata.sorted_tables:
            row_count = connection.execute(
                select(func.count()).select_from(table)
            ).scalar_one()
            overview.append({
                "table_name": table.name,
                "row_count": int(row_count or 0),
            })
    return overview


def clear_database_table(table_name: str) -> int:
    metadata_tables = {table.name: table for table in Base.metadata.sorted_tables}
    table = metadata_tables.get(table_name)
    if table is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nie znaleziono tabeli {table_name}.",
        )

    with engine.begin() as connection:
        deleted_count = connection.execute(
            select(func.count()).select_from(table)
        ).scalar_one()
        connection.execute(table.delete())

        if "id" in table.c:
            connection.execute(
                text(
                    "SELECT setval("
                    "pg_get_serial_sequence(:table_name, 'id'), "
                    "1, false"
                    ")"
                ),
                {"table_name": table.name},
            )

    return int(deleted_count or 0)


def format_date_for_pdf(value: datetime | str | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%d.%m.%Y")
    return str(value)


def build_coa_pdf(
    rows: list[VariantProductBatchTestOrder],
    details: list[ProductDetailedParameter],
    project_number: str,
    linked_document_names: list[str] | None = None,
    conclusion_text: str | None = None,
) -> bytes:
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
        Spacer(1, 3 * mm),
    ])

    document_names = linked_document_names or []
    if document_names:
        for document_name in document_names:
            story.extend([
                Paragraph(document_name, base_style),
                Spacer(1, 1.5 * mm),
            ])
    else:
        story.extend([
            Paragraph("-", base_style),
            Spacer(1, 1.5 * mm),
        ])

    story.extend([
        Spacer(1, 3.5 * mm),
        Paragraph("<b>CONCLUSION / WNIOSEK:</b>", section_style),
        Spacer(1, 2 * mm),
        Paragraph(
            "<br/>".join(
                line.strip()
                for line in (conclusion_text or build_default_coa_conclusion(project_number)).splitlines()
                if line.strip()
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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        app_logger.exception(
            "Unhandled error for %s %s in %sms",
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    if not request.url.path.startswith(("/docs", "/openapi.json")):
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        app_logger.log(
            level,
            "%s %s -> %s in %sms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )

    return response


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


class AsanaSettingsDTO(BaseModel):
    base_url: str
    access_token: str


class IntegrationSettingsResponseDTO(BaseModel):
    prestashop: PrestashopSettingsDTO
    woocommerce: WooCommerceSettingsDTO
    baselinker: BaselinkerSettingsDTO
    shopify: ShopifySettingsDTO
    magento: MagentoSettingsDTO
    asana: AsanaSettingsDTO


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


class AsanaSettingsUpdateDTO(BaseModel):
    base_url: Optional[str] = None
    access_token: Optional[str] = None


class IntegrationSettingsUpdateDTO(BaseModel):
    prestashop: Optional[PrestashopSettingsUpdateDTO] = None
    woocommerce: Optional[WooCommerceSettingsUpdateDTO] = None
    baselinker: Optional[BaselinkerSettingsUpdateDTO] = None
    shopify: Optional[ShopifySettingsUpdateDTO] = None
    magento: Optional[MagentoSettingsUpdateDTO] = None
    asana: Optional[AsanaSettingsUpdateDTO] = None


class AsanaMeResponseDTO(BaseModel):
    status: str
    base_url: str
    user: dict


class AsanaTaskResponseDTO(BaseModel):
    status: str
    task_gid: str
    task: dict


class AsanaCommentCreateDTO(BaseModel):
    task_gid: str
    text: str


class AsanaCommentResponseDTO(BaseModel):
    status: str
    task_gid: str
    story: dict


class DiagnosticsLogEntryDTO(BaseModel):
    timestamp: str
    level: str
    logger: str
    message: str


class DiagnosticsResponseDTO(BaseModel):
    checked_at: str
    backend_status: str
    database: dict
    products: dict
    auth: dict
    client: dict
    recent_logs: list[DiagnosticsLogEntryDTO]


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

    statements = []
    if "batch_number" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN batch_number VARCHAR(255)")
    if "asana_task_number" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN asana_task_number VARCHAR(255)")
    if "test_cost" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN test_cost VARCHAR(255)")
    if "production_date" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN production_date VARCHAR(50)")
    if "expiry_date" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN expiry_date VARCHAR(50)")
    if "planned_test_date" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN planned_test_date VARCHAR(50)")
    if "po_number" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN po_number VARCHAR(255)")
    if "workflow_status" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN workflow_status VARCHAR(50)")
    if "clarification_note" not in columns:
        statements.append("ALTER TABLE main_product_test_orders ADD COLUMN clarification_note VARCHAR(2000)")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
            connection.execute(text("UPDATE main_product_test_orders SET workflow_status = 'released' WHERE workflow_status = 'archive'"))
            if "workflow_status" not in columns:
                connection.execute(text("UPDATE main_product_test_orders SET workflow_status = 'ordered_tests' WHERE workflow_status IS NULL"))
                connection.execute(text("ALTER TABLE main_product_test_orders ALTER COLUMN workflow_status SET DEFAULT 'ordered_tests'"))
                connection.execute(text("ALTER TABLE main_product_test_orders ALTER COLUMN workflow_status SET NOT NULL"))

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
    if "asana_task_number" not in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ADD COLUMN asana_task_number VARCHAR(255)")
    if "purchase_order_number" not in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ADD COLUMN purchase_order_number VARCHAR(255)")
    if "test_cost" not in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ADD COLUMN test_cost VARCHAR(255)")
    if "workflow_status" not in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ADD COLUMN workflow_status VARCHAR(50)")
    if "clarification_note" not in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ADD COLUMN clarification_note VARCHAR(2000)")
    if "label_status" not in columns:
        statements.append("ALTER TABLE variant_product_batch_test_orders ADD COLUMN label_status VARCHAR(50)")

    extra_columns = {
        "original_test_order_id": "INTEGER",
        "production_date": "VARCHAR(50)",
        "expiry_date": "VARCHAR(50)",
        "planned_test_date": "VARCHAR(50)",
        "po_number": "VARCHAR(255)",
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
        "active_substances_match_pds_note": "VARCHAR(2000)",
        "label_version_matches_used_version": "VARCHAR(10)",
        "label_version_matches_used_version_note": "VARCHAR(2000)",
        "has_printing_errors": "VARCHAR(10)",
        "has_printing_errors_note": "VARCHAR(2000)",
        "has_graphic_design_errors": "VARCHAR(10)",
        "has_graphic_design_errors_note": "VARCHAR(2000)",
        "print_correctness": "VARCHAR(10)",
        "print_correctness_note": "VARCHAR(2000)",
        "has_labeling_errors": "VARCHAR(10)",
        "has_labeling_errors_note": "VARCHAR(2000)",
        "cap_is_correct": "VARCHAR(20)",
        "cap_is_correct_note": "VARCHAR(2000)",
        "induction_seal_weld_correct": "VARCHAR(20)",
        "induction_seal_weld_correct_note": "VARCHAR(2000)",
        "induction_seal_opening_correct": "VARCHAR(20)",
        "induction_seal_opening_correct_note": "VARCHAR(2000)",
        "package_is_dirty": "VARCHAR(10)",
        "package_is_dirty_note": "VARCHAR(2000)",
        "package_is_damaged": "VARCHAR(10)",
        "package_is_damaged_note": "VARCHAR(2000)",
        "qr_code_is_active": "VARCHAR(20)",
        "qr_code_is_active_note": "VARCHAR(2000)",
        "package_contents_match_card": "VARCHAR(10)",
        "package_contents_match_card_note": "VARCHAR(2000)",
        "product_verified": "VARCHAR(10)",
        "product_verified_note": "VARCHAR(2000)",
        "comment": "VARCHAR(2000)",
        "linked_document_names": "VARCHAR(4000)",
        "control_saved_at": "TIMESTAMP WITH TIME ZONE",
    }

    for column_name, column_type in extra_columns.items():
        if column_name not in columns:
            statements.append(f"ALTER TABLE variant_product_batch_test_orders ADD COLUMN {column_name} {column_type}")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
            if "workflow_status" not in columns:
                connection.execute(text("UPDATE variant_product_batch_test_orders SET workflow_status = 'ordered_tests' WHERE workflow_status IS NULL"))
                connection.execute(text("ALTER TABLE variant_product_batch_test_orders ALTER COLUMN workflow_status SET DEFAULT 'ordered_tests'"))
                connection.execute(text("ALTER TABLE variant_product_batch_test_orders ALTER COLUMN workflow_status SET NOT NULL"))
            if "label_status" not in columns:
                connection.execute(text("UPDATE variant_product_batch_test_orders SET label_status = 'current' WHERE label_status IS NULL"))

    if "batch_added_at" not in columns:
        with engine.begin() as connection:
            connection.execute(text("UPDATE variant_product_batch_test_orders SET batch_added_at = COALESCE(ordered_at, NOW()) WHERE batch_added_at IS NULL"))


def ensure_variant_product_batch_test_orders_archive_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("variant_product_batch_test_orders_archive")}
    except Exception:
        return

    statements: list[str] = []
    extra_columns = {
        "ordered_test_id": "INTEGER",
        "original_test_order_id": "INTEGER",
        "production_date": "VARCHAR(50)",
        "expiry_date": "VARCHAR(50)",
        "planned_test_date": "VARCHAR(50)",
        "test_cost": "VARCHAR(255)",
        "po_number": "VARCHAR(255)",
        "asana_task_number": "VARCHAR(255)",
        "purchase_order_number": "VARCHAR(255)",
        "workflow_status": "VARCHAR(50)",
        "clarification_note": "VARCHAR(2000)",
        "label_status": "VARCHAR(50)",
        "active_substances_match_pds_note": "VARCHAR(2000)",
        "label_version_matches_used_version_note": "VARCHAR(2000)",
        "has_printing_errors_note": "VARCHAR(2000)",
        "has_graphic_design_errors_note": "VARCHAR(2000)",
        "print_correctness_note": "VARCHAR(2000)",
        "has_labeling_errors_note": "VARCHAR(2000)",
        "cap_is_correct_note": "VARCHAR(2000)",
        "induction_seal_weld_correct_note": "VARCHAR(2000)",
        "induction_seal_opening_correct_note": "VARCHAR(2000)",
        "package_is_dirty_note": "VARCHAR(2000)",
        "package_is_damaged_note": "VARCHAR(2000)",
        "qr_code_is_active_note": "VARCHAR(2000)",
        "package_contents_match_card_note": "VARCHAR(2000)",
        "product_verified_note": "VARCHAR(2000)",
        "linked_document_names": "VARCHAR(4000)",
    }

    for column_name, column_type in extra_columns.items():
        if column_name not in columns:
            statements.append(f"ALTER TABLE variant_product_batch_test_orders_archive ADD COLUMN {column_name} {column_type}")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


def ensure_variant_product_finished_product_controls_schema() -> None:
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("variant_product_finished_product_controls")}
    except Exception:
        return

    statements: list[str] = []
    extra_columns = {
        "ordered_test_id": "INTEGER",
        "laboratory_name": "VARCHAR(100)",
        "asana_task_number": "VARCHAR(255)",
        "label_status": "VARCHAR(50)",
        "active_substances_match_pds_note": "VARCHAR(2000)",
        "label_version_matches_used_version_note": "VARCHAR(2000)",
        "has_printing_errors_note": "VARCHAR(2000)",
        "has_graphic_design_errors_note": "VARCHAR(2000)",
        "print_correctness_note": "VARCHAR(2000)",
        "has_labeling_errors_note": "VARCHAR(2000)",
        "cap_is_correct_note": "VARCHAR(2000)",
        "induction_seal_weld_correct_note": "VARCHAR(2000)",
        "induction_seal_opening_correct_note": "VARCHAR(2000)",
        "package_is_dirty_note": "VARCHAR(2000)",
        "package_is_damaged_note": "VARCHAR(2000)",
        "qr_code_is_active_note": "VARCHAR(2000)",
        "package_contents_match_card_note": "VARCHAR(2000)",
        "product_verified_note": "VARCHAR(2000)",
    }

    for column_name, column_type in extra_columns.items():
        if column_name not in columns:
            statements.append(f"ALTER TABLE variant_product_finished_product_controls ADD COLUMN {column_name} {column_type}")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
            if "label_status" not in columns:
                connection.execute(text("UPDATE variant_product_finished_product_controls SET label_status = 'current' WHERE label_status IS NULL"))


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
        "asana": {
            "base_url": ASANA_URL,
            "api_key": ASANA_ACCESS_TOKEN,
            "verify_ssl": True,
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


def get_asana_credentials(db: Session) -> tuple[str, str]:
    settings = get_integration_settings_map(db)
    asana = settings.get("asana")
    if not asana:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak ustawień integracji Asana.",
        )

    base_url = (asana.base_url or "").rstrip("/")
    access_token = (asana.api_key or "").strip()

    if not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak adresu bazowego Asany w ustawieniach.",
        )

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak tokenu Asany w ustawieniach.",
        )

    return base_url, access_token


def call_asana_api(method: str, path: str, access_token: str, *, json_payload: dict | None = None) -> dict:
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.request(
                method=method,
                url=path,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=json_payload,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Nie udało się połączyć z Asaną: {exc}",
        ) from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}

    if response.status_code >= 400:
        detail = payload.get("errors") if isinstance(payload, dict) else payload
        raise HTTPException(
            status_code=response.status_code,
            detail=detail or "Asana zwróciła błąd.",
        )

    return payload


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
        asana=AsanaSettingsDTO(
            base_url=settings["asana"].base_url,
            access_token=settings["asana"].api_key or "",
        ),
    )


def build_diagnostics_response(db: Session, current_user: User, request: Request) -> DiagnosticsResponseDTO:
    checked_at = datetime.now(timezone.utc).isoformat()
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@db:5432/app_start_db",
    )
    main_products_count = 0
    variant_products_count = 0
    users_count = 0

    try:
        db.execute(text("SELECT 1"))
        main_products_count = db.query(MainProduct).count()
        variant_products_count = db.query(VariantProduct).count()
        users_count = db.query(User).count()
        database_status = "ok"
        database_error = ""
    except Exception as exc:
        database_status = "error"
        database_error = str(exc)
        app_logger.exception("Database diagnostics check failed")

    return DiagnosticsResponseDTO(
        checked_at=checked_at,
        backend_status="ok",
        database={
            "status": database_status,
            "url": mask_database_url(database_url),
            "error": database_error,
        },
        products={
            "main_products_count": main_products_count,
            "variant_products_count": variant_products_count,
            "users_count": users_count,
        },
        auth={
            "current_user": current_user.username,
        },
        client={
            "host": request.headers.get("host", ""),
            "origin": request.headers.get("origin", ""),
            "user_agent": request.headers.get("user-agent", ""),
        },
        recent_logs=get_recent_logs(),
    )


@app.on_event("startup")
def startup_seed_settings():
    db = SessionLocal()
    try:
        ensure_integration_settings_schema()
        ensure_main_product_test_orders_schema()
        ensure_variant_product_batch_test_orders_schema()
        ensure_variant_product_batch_test_orders_archive_schema()
        ensure_variant_product_finished_product_controls_schema()
        ensure_integration_settings_seed(db)
        ensure_main_products_seed(db)
        ensure_variant_products_seed(db)
        ensure_variant_product_finished_product_control_links(db)
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


@app.get("/api/brd/download")
def download_brd(current_user: User = Depends(get_current_user)):
    _ = current_user

    filename = "BRD-olivit-app.docx"
    return StreamingResponse(
        BytesIO(build_brd_docx_bytes()),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
        ensure_variant_product_finished_product_control_links(db)
        apply_runtime_integration_settings(db)
    finally:
        db.close()

    return {
        "message": "Import zakonczony.",
        "tables": imported_counts,
    }


@app.get("/api/database/tables")
def get_database_tables(current_user: User = Depends(get_current_user)):
    _ = current_user
    return {"tables": build_database_tables_overview()}


@app.delete("/api/database/tables/{table_name}")
def delete_database_table(
    table_name: str,
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    deleted_count = clear_database_table(table_name)
    return {
        "table_name": table_name,
        "deleted_count": deleted_count,
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

    items = query.order_by(MainProduct.order_index.asc()).all()
    if not items and not (q and q.strip()):
        app_logger.warning("Main products query returned no rows")
    return items


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
        project_pattern = f"{q.strip()}%"
        query = query.filter(
            or_(
                VariantProduct.sku.ilike(pattern),
                VariantProduct.sku.ilike(project_pattern),
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
    if total == 0 and not (q and q.strip()):
        app_logger.warning("Variant products query returned no rows")

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
    asana_task_number = (payload.asana_task_number or "").strip()
    test_cost = (payload.test_cost or "").strip()
    production_date = (payload.production_date or "").strip()
    expiry_date = (payload.expiry_date or "").strip()
    planned_test_date = (payload.planned_test_date or "").strip()
    test_cost = (payload.test_cost or "").strip()
    po_number = (payload.po_number or "").strip()
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
        asana_task_number=asana_task_number or None,
        test_cost=test_cost or None,
        production_date=production_date or None,
        expiry_date=expiry_date or None,
        planned_test_date=planned_test_date or None,
        po_number=po_number or None,
        workflow_status="ordered_tests",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.patch("/api/main-products/ordered-tests/{order_id}", response_model=MainProductTestOrderResponse)
def update_main_product_test_order(
    order_id: int,
    payload: MainProductTestOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    order = db.query(MainProductTestOrder).filter(MainProductTestOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Main product test order not found",
        )

    if payload.workflow_status is not None:
        allowed_statuses = {"ordered_tests", "to_pack", "to_clarify", "released", "archive"}
        workflow_status = payload.workflow_status.strip()
        if workflow_status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid workflow_status",
            )
        order.workflow_status = workflow_status

    if payload.clarification_note is not None:
        order.clarification_note = payload.clarification_note.strip() or None

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
    ensure_variant_product_finished_product_control_links(db)
    rows = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.workflow_status.in_(("ordered_tests", "retest_ordered")))
        .order_by(VariantProductBatchTestOrder.batch_added_at.desc(), VariantProductBatchTestOrder.id.desc())
        .all()
    )
    control_map = get_variant_finished_product_control_map_for_batch_rows(db, rows)
    related_controls_map = get_related_label_controls_for_batch_rows(db, rows)
    return [
        serialize_variant_batch_row(
            row,
            label_control_id=getattr(control_map.get(get_variant_batch_related_controls_source_id(row)), "id", None),
            label_status=get_aggregated_label_status(related_controls_map.get(row.id, [])),
            related_label_controls_count=len(related_controls_map.get(row.id, [])),
            related_label_controls_resolved_count=sum(
                1 for control in related_controls_map.get(row.id, []) if (control.get("label_status") or "current") != "current"
            ),
        )
        for row in rows
    ]


@app.get("/api/variant-products/batches/released", response_model=list[VariantProductBatchTestOrderResponse])
def get_variant_product_batch_test_orders_released(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    ensure_variant_product_finished_product_control_links(db)
    rows = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.workflow_status == "released")
        .order_by(VariantProductBatchTestOrder.batch_added_at.desc(), VariantProductBatchTestOrder.id.desc())
        .all()
    )
    control_map = get_variant_finished_product_control_map_for_batch_rows(db, rows)
    related_controls_map = get_related_label_controls_for_batch_rows(db, rows)
    return [
        serialize_variant_batch_row(
            row,
            label_control_id=getattr(control_map.get(get_variant_batch_related_controls_source_id(row)), "id", None),
            label_status=get_aggregated_label_status(related_controls_map.get(row.id, [])),
            related_label_controls_count=len(related_controls_map.get(row.id, [])),
            related_label_controls_resolved_count=sum(
                1 for control in related_controls_map.get(row.id, []) if (control.get("label_status") or "current") != "current"
            ),
        )
        for row in rows
    ]


@app.get("/api/variant-products/batches/to-clarify", response_model=list[VariantProductBatchTestOrderResponse])
def get_variant_product_batch_test_orders_to_clarify(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    ensure_variant_product_finished_product_control_links(db)
    rows = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.workflow_status == "to_clarify")
        .order_by(VariantProductBatchTestOrder.batch_added_at.desc(), VariantProductBatchTestOrder.id.desc())
        .all()
    )
    control_map = get_variant_finished_product_control_map_for_batch_rows(db, rows)
    related_controls_map = get_related_label_controls_for_batch_rows(db, rows)
    return [
        serialize_variant_batch_row(
            row,
            label_control_id=getattr(control_map.get(get_variant_batch_related_controls_source_id(row)), "id", None),
            label_status=get_aggregated_label_status(related_controls_map.get(row.id, [])),
            related_label_controls_count=len(related_controls_map.get(row.id, [])),
            related_label_controls_resolved_count=sum(
                1 for control in related_controls_map.get(row.id, []) if (control.get("label_status") or "current") != "current"
            ),
        )
        for row in rows
    ]


@app.get("/api/variant-products/batches/archive", response_model=list[VariantProductBatchTestOrderResponse])
def get_variant_product_batch_test_archive(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    ensure_variant_product_finished_product_control_links(db)
    rows = (
        db.query(VariantProductBatchTestOrderArchive)
        .order_by(VariantProductBatchTestOrderArchive.archived_at.desc(), VariantProductBatchTestOrderArchive.id.desc())
        .all()
    )
    control_map = get_variant_finished_product_control_map_for_batch_rows(db, rows)
    serialized_rows = []
    related_controls_map = get_related_label_controls_for_batch_rows(db, rows)
    for row in rows:
        control = control_map.get(get_variant_batch_related_controls_source_id(row))
        serialized = serialize_variant_batch_row(
            row,
            label_control_id=getattr(control, "id", None),
            label_status=get_aggregated_label_status(related_controls_map.get(get_variant_batch_row_test_order_id(row) or row.id, [])),
            related_label_controls_count=len(related_controls_map.get(get_variant_batch_row_test_order_id(row) or row.id, [])),
            related_label_controls_resolved_count=sum(
                1
                for related_control in related_controls_map.get(get_variant_batch_row_test_order_id(row) or row.id, [])
                if (related_control.get("label_status") or "current") != "current"
            ),
        )
        if control:
            serialized["label_status"] = control.label_status
        serialized_rows.append(serialized)
    return serialized_rows


@app.get(
    "/api/variant-products/batches/{order_id}/related-label-controls",
    response_model=VariantProductBatchRelatedLabelControlsResponse,
)
def get_variant_product_batch_related_label_controls(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    ensure_variant_product_finished_product_control_links(db)

    row = db.query(VariantProductBatchTestOrder).filter(VariantProductBatchTestOrder.id == order_id).first()
    if not row:
        archived_row = (
            db.query(VariantProductBatchTestOrderArchive)
            .filter(
                or_(
                    VariantProductBatchTestOrderArchive.id == order_id,
                    VariantProductBatchTestOrderArchive.ordered_test_id == order_id,
                )
            )
            .order_by(VariantProductBatchTestOrderArchive.id.desc())
            .first()
        )
        row = archived_row

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant product batch test order not found",
        )

    related_controls_map = get_related_label_controls_for_batch_rows(db, [row])
    row_key = get_variant_batch_row_test_order_id(row) or row.id
    return {
        "order_id": row_key,
        "related_label_controls": related_controls_map.get(row_key, []),
    }


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
    asana_task_number = (payload.asana_task_number or "").strip()
    purchase_order_number = (payload.purchase_order_number or "").strip()
    test_cost = (payload.test_cost or "").strip()
    production_date = (payload.production_date or "").strip()
    expiry_date = (payload.expiry_date or "").strip()
    planned_test_date = (payload.planned_test_date or "").strip()
    test_cost = (payload.test_cost or "").strip()
    po_number = (payload.po_number or "").strip()

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
        asana_task_number=asana_task_number or None,
        purchase_order_number=purchase_order_number or None,
        test_cost=test_cost or None,
        production_date=production_date or None,
        expiry_date=expiry_date or None,
        planned_test_date=planned_test_date or None,
        po_number=po_number or None,
        workflow_status="ordered_tests",
        label_status="current",
        batch_added_at=datetime.now(timezone.utc),
        ordered_at=datetime.now(timezone.utc) if laboratory_name else None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    existing_control = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.ordered_test_id == order.id)
        .first()
    )
    if not existing_control:
        db.add(create_default_variant_finished_product_control(order))
        db.commit()
        existing_control = (
            db.query(VariantProductFinishedProductControl)
            .filter(VariantProductFinishedProductControl.ordered_test_id == order.id)
            .first()
        )
    return serialize_variant_batch_row(order, label_control_id=getattr(existing_control, "id", None))


@app.post(
    "/api/variant-products/batches/ordered-tests/bulk",
    response_model=list[VariantProductBatchTestOrderResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_variant_product_batch_test_orders_bulk(
    payload: VariantProductBatchTestOrderBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    laboratory_name = (payload.laboratory_name or "").strip()
    asana_task_number = (payload.asana_task_number or "").strip()
    production_date = (payload.production_date or "").strip()
    expiry_date = (payload.expiry_date or "").strip()
    planned_test_date = (payload.planned_test_date or "").strip()
    test_cost = (payload.test_cost or "").strip()
    po_number = (payload.po_number or "").strip()

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one batch test order item is required",
        )

    normalized_items = []
    for item in payload.items:
        sku = item.sku.strip()
        name = item.name.strip()
        ean = item.ean.strip()
        batch_number = item.batch_number.strip()

        if not sku or not name or not ean or not batch_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sku, name, ean and batch_number are required for each item",
            )

        normalized_items.append({
            "sku": sku,
            "name": name,
            "ean": ean,
            "batch_number": batch_number,
        })

    target_item = normalized_items[0]
    order = VariantProductBatchTestOrder(
        sku=target_item["sku"],
        name=target_item["name"],
        ean=target_item["ean"],
        laboratory_name=laboratory_name or None,
        batch_number=target_item["batch_number"],
        asana_task_number=asana_task_number or None,
        production_date=production_date or None,
        expiry_date=expiry_date or None,
        planned_test_date=planned_test_date or None,
        test_cost=test_cost or None,
        po_number=po_number or None,
        workflow_status="ordered_tests",
        label_status="current",
        batch_added_at=datetime.now(timezone.utc),
        ordered_at=datetime.now(timezone.utc) if laboratory_name else None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    linked_control = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.ordered_test_id == order.id)
        .first()
    )
    if not linked_control:
        linked_control = create_default_variant_finished_product_control(order)
        db.add(linked_control)

    for extra_item in normalized_items[1:]:
        db.add(
            create_variant_finished_product_control_from_batch_data(
                sku=extra_item["sku"],
                name=extra_item["name"],
                ean=extra_item["ean"],
                batch_number=extra_item["batch_number"],
                expiry_date=expiry_date or None,
                laboratory_name=laboratory_name or None,
                asana_task_number=asana_task_number or None,
                ordered_test_id=order.id,
            )
        )

    db.commit()
    db.refresh(linked_control)

    return [
        serialize_variant_batch_row(
            order,
            label_control_id=getattr(linked_control, "id", None),
        )
    ]


@app.patch("/api/variant-products/batches/ordered-tests/{order_id}", response_model=VariantProductBatchTestOrderResponse)
def update_variant_product_batch_test_order(
    order_id: int,
    payload: VariantProductBatchTestOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    order = db.query(VariantProductBatchTestOrder).filter(VariantProductBatchTestOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant product batch test order not found",
        )

    if payload.workflow_status is not None:
        workflow_status = payload.workflow_status.strip()
        allowed_statuses = {"ordered_tests", "to_clarify", "released"}
        if workflow_status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid workflow_status",
            )
        if workflow_status == "released":
            related_controls = get_related_label_control_entities_for_batch_row(db, order)
            if any((control.label_status or "current") == "current" for control in related_controls):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nie można zwolnić produtu z etykietą o statusie Bieżące",
                )
        order.workflow_status = workflow_status

    if payload.clarification_note is not None:
        order.clarification_note = payload.clarification_note.strip() or None

    if payload.laboratory_name is not None:
        laboratory_name = payload.laboratory_name.strip()
        order.laboratory_name = laboratory_name or None
        order.ordered_at = datetime.now(timezone.utc) if laboratory_name else None

    if payload.batch_number is not None:
        batch_number = payload.batch_number.strip()
        if not batch_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="batch_number is required",
            )
        order.batch_number = batch_number

    if payload.asana_task_number is not None:
        order.asana_task_number = payload.asana_task_number.strip() or None

    if payload.production_date is not None:
        order.production_date = payload.production_date.strip() or None

    if payload.expiry_date is not None:
        order.expiry_date = payload.expiry_date.strip() or None

    if payload.planned_test_date is not None:
        order.planned_test_date = payload.planned_test_date.strip() or None

    if payload.test_cost is not None:
        order.test_cost = payload.test_cost.strip() or None

    if payload.po_number is not None:
        order.po_number = payload.po_number.strip() or None

    db.add(order)
    db.commit()
    db.refresh(order)
    control = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.ordered_test_id == order.id)
        .first()
    )
    return serialize_variant_batch_row(order, label_control_id=getattr(control, "id", None))


@app.post("/api/variant-products/batches/retest", response_model=VariantProductBatchTestOrderResponse, status_code=status.HTTP_201_CREATED)
def create_variant_product_batch_retest_order(
    payload: VariantProductBatchRetestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    order = db.query(VariantProductBatchTestOrder).filter(VariantProductBatchTestOrder.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant product batch test order not found",
        )

    if (order.workflow_status or "").strip() != "to_clarify":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only rows from to_clarify can be re-ordered",
        )

    laboratory_name = payload.laboratory_name.strip()
    batch_number = payload.batch_number.strip()
    if not laboratory_name or not batch_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="laboratory_name and batch_number are required",
        )

    original_test_order_id = order.original_test_order_id or order.id
    db.add(
        VariantProductBatchTestOrderArchive(
            ordered_test_id=order.id,
            original_test_order_id=original_test_order_id,
            sku=order.sku,
            name=order.name,
            ean=order.ean,
            laboratory_name=order.laboratory_name,
            batch_number=order.batch_number,
            asana_task_number=order.asana_task_number,
            production_date=order.production_date,
            expiry_date=order.expiry_date,
            planned_test_date=order.planned_test_date,
            test_cost=order.test_cost,
            po_number=order.po_number,
            workflow_status="retest_requested",
            clarification_note=order.clarification_note,
            label_status=order.label_status,
            batch_added_at=order.batch_added_at,
            ordered_at=order.ordered_at,
            printed_material_type=order.printed_material_type,
            product_name=order.product_name,
            product_project_number=order.product_project_number,
            product_ean_number=order.product_ean_number,
            product_batch_number=order.product_batch_number,
            product_expiry_date=order.product_expiry_date,
            control_date=order.control_date,
            market_label_version=order.market_label_version,
            active_substances_match_pds=order.active_substances_match_pds,
            active_substances_match_pds_note=order.active_substances_match_pds_note,
            label_version_matches_used_version=order.label_version_matches_used_version,
            label_version_matches_used_version_note=order.label_version_matches_used_version_note,
            has_printing_errors=order.has_printing_errors,
            has_printing_errors_note=order.has_printing_errors_note,
            has_graphic_design_errors=order.has_graphic_design_errors,
            has_graphic_design_errors_note=order.has_graphic_design_errors_note,
            print_correctness=order.print_correctness,
            print_correctness_note=order.print_correctness_note,
            has_labeling_errors=order.has_labeling_errors,
            has_labeling_errors_note=order.has_labeling_errors_note,
            cap_is_correct=order.cap_is_correct,
            cap_is_correct_note=order.cap_is_correct_note,
            induction_seal_weld_correct=order.induction_seal_weld_correct,
            induction_seal_weld_correct_note=order.induction_seal_weld_correct_note,
            induction_seal_opening_correct=order.induction_seal_opening_correct,
            induction_seal_opening_correct_note=order.induction_seal_opening_correct_note,
            package_is_dirty=order.package_is_dirty,
            package_is_dirty_note=order.package_is_dirty_note,
            package_is_damaged=order.package_is_damaged,
            package_is_damaged_note=order.package_is_damaged_note,
            qr_code_is_active=order.qr_code_is_active,
            qr_code_is_active_note=order.qr_code_is_active_note,
            package_contents_match_card=order.package_contents_match_card,
            package_contents_match_card_note=order.package_contents_match_card_note,
            product_verified=order.product_verified,
            product_verified_note=order.product_verified_note,
            comment=order.comment,
            linked_document_names=order.linked_document_names,
            control_saved_at=order.control_saved_at,
            archived_at=datetime.now(timezone.utc),
        )
    )

    new_order = VariantProductBatchTestOrder(
        original_test_order_id=original_test_order_id,
        sku=order.sku,
        name=order.name,
        ean=order.ean,
        laboratory_name=laboratory_name,
        batch_number=batch_number,
        asana_task_number=(payload.asana_task_number or "").strip() or None,
        production_date=(payload.production_date or "").strip() or None,
        expiry_date=(payload.expiry_date or "").strip() or None,
        planned_test_date=(payload.planned_test_date or "").strip() or None,
        test_cost=(payload.test_cost or "").strip() or None,
        po_number=(payload.po_number or "").strip() or None,
        workflow_status="retest_ordered",
        clarification_note=None,
        label_status=order.label_status,
        batch_added_at=datetime.now(timezone.utc),
        ordered_at=datetime.now(timezone.utc),
        printed_material_type=order.printed_material_type,
        product_name=order.product_name,
        product_project_number=order.product_project_number,
        product_ean_number=order.product_ean_number,
        product_batch_number=order.product_batch_number,
        product_expiry_date=order.product_expiry_date,
        control_date=order.control_date,
        market_label_version=order.market_label_version,
        active_substances_match_pds=order.active_substances_match_pds,
        active_substances_match_pds_note=order.active_substances_match_pds_note,
        label_version_matches_used_version=order.label_version_matches_used_version,
        label_version_matches_used_version_note=order.label_version_matches_used_version_note,
        has_printing_errors=order.has_printing_errors,
        has_printing_errors_note=order.has_printing_errors_note,
        has_graphic_design_errors=order.has_graphic_design_errors,
        has_graphic_design_errors_note=order.has_graphic_design_errors_note,
        print_correctness=order.print_correctness,
        print_correctness_note=order.print_correctness_note,
        has_labeling_errors=order.has_labeling_errors,
        has_labeling_errors_note=order.has_labeling_errors_note,
        cap_is_correct=order.cap_is_correct,
        cap_is_correct_note=order.cap_is_correct_note,
        induction_seal_weld_correct=order.induction_seal_weld_correct,
        induction_seal_weld_correct_note=order.induction_seal_weld_correct_note,
        induction_seal_opening_correct=order.induction_seal_opening_correct,
        induction_seal_opening_correct_note=order.induction_seal_opening_correct_note,
        package_is_dirty=order.package_is_dirty,
        package_is_dirty_note=order.package_is_dirty_note,
        package_is_damaged=order.package_is_damaged,
        package_is_damaged_note=order.package_is_damaged_note,
        qr_code_is_active=order.qr_code_is_active,
        qr_code_is_active_note=order.qr_code_is_active_note,
        package_contents_match_card=order.package_contents_match_card,
        package_contents_match_card_note=order.package_contents_match_card_note,
        product_verified=order.product_verified,
        product_verified_note=order.product_verified_note,
        comment=order.comment,
        linked_document_names=order.linked_document_names,
        control_saved_at=order.control_saved_at,
    )
    db.add(new_order)
    db.flush()

    db.delete(order)
    db.commit()
    db.refresh(new_order)

    refreshed_control = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.ordered_test_id == original_test_order_id)
        .order_by(VariantProductFinishedProductControl.id.desc())
        .first()
    )
    return serialize_variant_batch_row(new_order, label_control_id=getattr(refreshed_control, "id", None))


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
        related_controls = get_related_label_control_entities_for_batch_row(db, row)
        if any((control.label_status or "current") == "current" for control in related_controls):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nie można zwolnić produtu z etykietą o statusie Bieżące",
            )
        db.add(
            VariantProductBatchTestOrderArchive(
                ordered_test_id=row.id,
                original_test_order_id=row.original_test_order_id,
                sku=row.sku,
                name=row.name,
                ean=row.ean,
                laboratory_name=row.laboratory_name,
                batch_number=row.batch_number,
                asana_task_number=row.asana_task_number,
                purchase_order_number=row.purchase_order_number,
                test_cost=row.test_cost,
                production_date=row.production_date,
                expiry_date=row.expiry_date,
                planned_test_date=row.planned_test_date,
                po_number=row.po_number,
                workflow_status="archive",
                clarification_note=row.clarification_note,
                label_status=row.label_status,
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
                active_substances_match_pds_note=row.active_substances_match_pds_note,
                label_version_matches_used_version=row.label_version_matches_used_version,
                label_version_matches_used_version_note=row.label_version_matches_used_version_note,
                has_printing_errors=row.has_printing_errors,
                has_printing_errors_note=row.has_printing_errors_note,
                has_graphic_design_errors=row.has_graphic_design_errors,
                has_graphic_design_errors_note=row.has_graphic_design_errors_note,
                print_correctness=row.print_correctness,
                print_correctness_note=row.print_correctness_note,
                has_labeling_errors=row.has_labeling_errors,
                has_labeling_errors_note=row.has_labeling_errors_note,
                cap_is_correct=row.cap_is_correct,
                cap_is_correct_note=row.cap_is_correct_note,
                induction_seal_weld_correct=row.induction_seal_weld_correct,
                induction_seal_weld_correct_note=row.induction_seal_weld_correct_note,
                induction_seal_opening_correct=row.induction_seal_opening_correct,
                induction_seal_opening_correct_note=row.induction_seal_opening_correct_note,
                package_is_dirty=row.package_is_dirty,
                package_is_dirty_note=row.package_is_dirty_note,
                package_is_damaged=row.package_is_damaged,
                package_is_damaged_note=row.package_is_damaged_note,
                qr_code_is_active=row.qr_code_is_active,
                qr_code_is_active_note=row.qr_code_is_active_note,
                package_contents_match_card=row.package_contents_match_card,
                package_contents_match_card_note=row.package_contents_match_card_note,
                product_verified=row.product_verified,
                product_verified_note=row.product_verified_note,
                comment=row.comment,
                linked_document_names=row.linked_document_names,
                control_saved_at=row.control_saved_at,
                archived_at=datetime.now(timezone.utc),
            )
        )

    for row in rows:
        db.delete(row)

    db.commit()
    return {"archived_count": len(rows)}


@app.post("/api/variant-products/batches/documents", status_code=status.HTTP_200_OK)
def save_variant_product_batch_documents(
    payload: VariantProductBatchDocumentsRequest,
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

    document_names = []
    for document_name in payload.document_names:
        value = str(document_name or "").strip()
        if value and value not in document_names:
            document_names.append(value)

    rows = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.id.in_(ids))
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No rows found to save documents",
        )

    for row in rows:
        existing_names = parse_linked_document_names(row.linked_document_names)
        merged_names = existing_names[:]
        for document_name in document_names:
            if document_name not in merged_names:
                merged_names.append(document_name)
        row.linked_document_names = serialize_linked_document_names(merged_names)
        db.add(row)

    db.commit()
    return {
        "updated_count": len(rows),
        "document_names": document_names,
    }


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

    linked_document_names = []
    for document_name in payload.linked_document_names:
        value = str(document_name or "").strip()
        if value and value not in linked_document_names:
            linked_document_names.append(value)

    conclusion_text = (payload.conclusion_text or "").strip() or build_default_coa_conclusion(project_number)

    pdf_bytes = build_coa_pdf(rows, details, project_number, linked_document_names, conclusion_text)
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
    ensure_variant_product_finished_product_control_links(db)
    rows = (
        db.query(VariantProductFinishedProductControl)
        .order_by(VariantProductFinishedProductControl.created_at.desc(), VariantProductFinishedProductControl.id.desc())
        .all()
    )
    ordered_test_ids = sorted({row.ordered_test_id for row in rows if row.ordered_test_id is not None})
    order_map: dict[int, VariantProductBatchTestOrder] = {}
    if ordered_test_ids:
        orders = (
            db.query(VariantProductBatchTestOrder)
            .filter(VariantProductBatchTestOrder.id.in_(ordered_test_ids))
            .all()
        )
        order_map = {order.id: order for order in orders}

    original_order_ids = sorted({
        order.original_test_order_id
        for order in order_map.values()
        if order.original_test_order_id is not None
    })
    original_label_control_map: dict[int, int] = {}
    if original_order_ids:
        original_controls = (
            db.query(VariantProductFinishedProductControl)
            .filter(VariantProductFinishedProductControl.ordered_test_id.in_(original_order_ids))
            .order_by(
                VariantProductFinishedProductControl.ordered_test_id.asc(),
                VariantProductFinishedProductControl.id.asc(),
            )
            .all()
        )
        for control in original_controls:
            if control.ordered_test_id is not None and control.ordered_test_id not in original_label_control_map:
                original_label_control_map[control.ordered_test_id] = control.id

    return [
        serialize_variant_finished_product_control_row(
            row,
            original_test_order_id=(
                order_map[row.ordered_test_id].original_test_order_id
                if row.ordered_test_id is not None and row.ordered_test_id in order_map
                else None
            ),
            original_label_control_id=(
                original_label_control_map.get(order_map[row.ordered_test_id].original_test_order_id)
                if row.ordered_test_id is not None
                and row.ordered_test_id in order_map
                and order_map[row.ordered_test_id].original_test_order_id is not None
                else None
            ),
            po_number=(
                order_map[row.ordered_test_id].po_number
                if row.ordered_test_id is not None and row.ordered_test_id in order_map
                else None
            ),
        )
        for row in rows
    ]


@app.post(
    "/api/variant-products/finished-product-controls/placeholders",
    response_model=list[VariantProductFinishedProductControlResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_variant_product_finished_product_control_placeholders(
    payload: VariantProductFinishedProductControlPlaceholderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    created_controls: list[VariantProductFinishedProductControl] = []
    for item in payload.items:
        sku = item.sku.strip()
        name = item.name.strip()
        ean = item.ean.strip()
        product_project_number = item.product_project_number.strip()
        product_batch_number = item.product_batch_number.strip()
        laboratory_name = (item.laboratory_name or "").strip() or None
        asana_task_number = (item.asana_task_number or "").strip() or None
        product_expiry_date = (item.product_expiry_date or "").strip() or None

        if not sku or not name or not ean or not product_project_number or not product_batch_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sku, name, ean, product_project_number and product_batch_number are required",
            )

        control = (
            db.query(VariantProductFinishedProductControl)
            .filter(
                VariantProductFinishedProductControl.ordered_test_id.is_(None),
                VariantProductFinishedProductControl.sku == sku,
                VariantProductFinishedProductControl.product_batch_number == product_batch_number,
                VariantProductFinishedProductControl.label_status == "current",
            )
            .first()
        )

        if not control:
            control = create_variant_finished_product_control_placeholder(
                sku=sku,
                name=name,
                ean=ean,
                laboratory_name=laboratory_name,
                asana_task_number=asana_task_number,
                product_project_number=product_project_number,
                product_batch_number=product_batch_number,
                product_expiry_date=product_expiry_date,
            )
        else:
            control.name = name
            control.ean = ean
            control.laboratory_name = laboratory_name
            control.asana_task_number = asana_task_number
            control.product_name = name
            control.product_project_number = product_project_number
            control.product_ean_number = ean
            control.product_batch_number = product_batch_number
            control.product_expiry_date = product_expiry_date or ""
            control.label_status = "current"

        db.add(control)
        created_controls.append(control)

    db.commit()
    for control in created_controls:
        db.refresh(control)
    return [serialize_variant_finished_product_control_row(control) for control in created_controls]


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

    label_status = payload.label_status.strip()
    if label_status not in {"incorrect", "correct", "archived"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid label_status",
        )

    note_inputs = {
        "active_substances_match_pds_note": (payload.active_substances_match_pds_note or "").strip(),
        "label_version_matches_used_version_note": (payload.label_version_matches_used_version_note or "").strip(),
        "has_printing_errors_note": (payload.has_printing_errors_note or "").strip(),
        "has_graphic_design_errors_note": (payload.has_graphic_design_errors_note or "").strip(),
        "print_correctness_note": (payload.print_correctness_note or "").strip(),
        "has_labeling_errors_note": (payload.has_labeling_errors_note or "").strip(),
        "cap_is_correct_note": (payload.cap_is_correct_note or "").strip(),
        "induction_seal_weld_correct_note": (payload.induction_seal_weld_correct_note or "").strip(),
        "induction_seal_opening_correct_note": (payload.induction_seal_opening_correct_note or "").strip(),
        "package_is_dirty_note": (payload.package_is_dirty_note or "").strip(),
        "package_is_damaged_note": (payload.package_is_damaged_note or "").strip(),
        "qr_code_is_active_note": (payload.qr_code_is_active_note or "").strip(),
        "package_contents_match_card_note": (payload.package_contents_match_card_note or "").strip(),
        "product_verified_note": (payload.product_verified_note or "").strip(),
    }

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

    note_requirements = {
        "active_substances_match_pds": "active_substances_match_pds_note",
        "label_version_matches_used_version": "label_version_matches_used_version_note",
        "has_printing_errors": "has_printing_errors_note",
        "has_graphic_design_errors": "has_graphic_design_errors_note",
        "print_correctness": "print_correctness_note",
        "has_labeling_errors": "has_labeling_errors_note",
        "cap_is_correct": "cap_is_correct_note",
        "induction_seal_weld_correct": "induction_seal_weld_correct_note",
        "induction_seal_opening_correct": "induction_seal_opening_correct_note",
        "package_is_dirty": "package_is_dirty_note",
        "package_is_damaged": "package_is_damaged_note",
        "qr_code_is_active": "qr_code_is_active_note",
        "package_contents_match_card": "package_contents_match_card_note",
        "product_verified": "product_verified_note",
    }
    for answer_field, note_field in note_requirements.items():
        if fields[answer_field] == "Nie" and not note_inputs[note_field]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All negative answers must include notes",
            )

    question_labels = {
        "active_substances_match_pds_note": "Czy zawartość substancji aktywnych na etykiecie jest zgodna ze specyfikacją analityczną w PDS?",
        "label_version_matches_used_version_note": "Aktualna wersja etykiety/kartonika jest zgodna z użytą wersją etykiety/kartonika",
        "has_printing_errors_note": "Czy na opakowaniu znajdują się błędy drukarskie? (np. pogrubienie)",
        "has_graphic_design_errors_note": "Czy na opakowaniu znajdują się błędy w projekcie graficznym?",
        "print_correctness_note": "Poprawność nadruku (TP/partia; np. ścieranie się)",
        "has_labeling_errors_note": "Czy opakowanie posiada błędy w sposobie oklejenia (krzywa etykieta, zagięcia, ślady kleju)?",
        "cap_is_correct_note": "Nakrętka: czy jest prawidłowa (np. bez marmurku)",
        "induction_seal_weld_correct_note": "Wkładka indukcyjna: poprawność zgrzewu",
        "induction_seal_opening_correct_note": "Wkładka indukcyjna: poprawność otwierania",
        "package_is_dirty_note": "Czy opakowanie jest zabrudzone?",
        "package_is_damaged_note": "Czy opakowanie jest uszkodzone (np. wgniecenie, pęknięcie)",
        "qr_code_is_active_note": "Czy kod QR jest aktywny?",
        "package_contents_match_card_note": "Zawartość opakowania zgodna z Kartą Produktu (w tym miarka przy proszkach)",
        "product_verified_note": "Poprawność produktu została zweryfikowana",
    }
    aggregated_comment_parts = []
    for note_field, note_value in note_inputs.items():
        if note_value:
            aggregated_comment_parts.append(
                f"Pytanie: {question_labels[note_field]}\nUwagi: {note_value}"
            )

    extra_comment = (payload.comment or "").strip()
    if extra_comment:
        aggregated_comment_parts.append(f"Komentarz dodatkowy:\n{extra_comment}")

    aggregated_comment = "\n\n".join(aggregated_comment_parts) or None

    order = (
        db.query(VariantProductBatchTestOrder)
        .filter(VariantProductBatchTestOrder.id == payload.ordered_test_id)
        .first()
    )

    if order:
        immutable_order_fields = {
            "sku": order.sku,
            "name": order.name,
            "ean": order.ean,
        }
        persisted_fields = {
            **fields,
            **immutable_order_fields,
        }
        for key, value in persisted_fields.items():
            setattr(order, key, value)
        for note_field in note_inputs:
            setattr(order, note_field, None)

        order.batch_number = fields["product_batch_number"]
        order.comment = aggregated_comment
        order.control_saved_at = datetime.utcnow()
    else:
        persisted_fields = fields

    control = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.ordered_test_id == payload.ordered_test_id)
        .first()
    )
    if not control:
        control = create_default_variant_finished_product_control(order) if order else VariantProductFinishedProductControl()

    if order:
        persisted_fields = {
            **persisted_fields,
            "sku": order.sku,
            "name": order.name,
            "ean": order.ean,
        }
    for key, value in persisted_fields.items():
        setattr(control, key, value)
    for note_field in note_inputs:
        setattr(control, note_field, None)
    control.ordered_test_id = order.id if order else payload.ordered_test_id
    control.laboratory_name = order.laboratory_name if order else control.laboratory_name
    control.asana_task_number = order.asana_task_number if order else control.asana_task_number
    control.label_status = label_status
    control.comment = aggregated_comment

    if order:
        order.label_status = control.label_status
    db.add(control)
    if order:
        db.add(order)
    db.commit()
    db.refresh(control)
    if order:
        db.refresh(order)
    return serialize_variant_finished_product_control_row(control)


@app.patch("/api/variant-products/finished-product-controls/status")
def update_variant_product_finished_product_controls_status(
    payload: VariantProductFinishedProductControlBulkStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    ids = sorted(set(payload.ids))
    label_status = payload.label_status.strip()

    if not ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ids are required",
        )

    if label_status not in {"incorrect", "correct"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid label_status",
        )

    controls = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.id.in_(ids))
        .all()
    )
    if not controls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No finished product controls found",
        )

    ordered_test_ids = [control.ordered_test_id for control in controls if control.ordered_test_id is not None]
    order_map = {}
    if ordered_test_ids:
        orders = (
            db.query(VariantProductBatchTestOrder)
            .filter(VariantProductBatchTestOrder.id.in_(ordered_test_ids))
            .all()
        )
        order_map = {order.id: order for order in orders}

    for control in controls:
        control.label_status = label_status
        db.add(control)
        if control.ordered_test_id is not None and control.ordered_test_id in order_map:
            order = order_map[control.ordered_test_id]
            order.label_status = label_status
            db.add(order)

    db.commit()
    return {"updated": len(controls), "label_status": label_status}


@app.post("/api/variant-products/finished-product-controls/relabel")
def relabel_variant_product_finished_product_controls(
    payload: VariantProductFinishedProductControlBulkIds,
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

    controls = (
        db.query(VariantProductFinishedProductControl)
        .filter(VariantProductFinishedProductControl.id.in_(ids))
        .order_by(VariantProductFinishedProductControl.id.asc())
        .all()
    )
    if not controls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No finished product controls found",
        )

    touched_order_ids: set[int] = set()
    for control in controls:
        clone = VariantProductFinishedProductControl(
            ordered_test_id=control.ordered_test_id,
            sku=control.sku,
            name=control.name,
            ean=control.ean,
            laboratory_name=control.laboratory_name,
            asana_task_number=control.asana_task_number,
            label_status="current",
            printed_material_type=control.printed_material_type,
            product_name=control.product_name,
            product_project_number=control.product_project_number,
            product_ean_number=control.product_ean_number,
            product_batch_number=control.product_batch_number,
            product_expiry_date=control.product_expiry_date,
            control_date=control.control_date,
            market_label_version=control.market_label_version,
            active_substances_match_pds=control.active_substances_match_pds,
            active_substances_match_pds_note=control.active_substances_match_pds_note,
            label_version_matches_used_version=control.label_version_matches_used_version,
            label_version_matches_used_version_note=control.label_version_matches_used_version_note,
            has_printing_errors=control.has_printing_errors,
            has_printing_errors_note=control.has_printing_errors_note,
            has_graphic_design_errors=control.has_graphic_design_errors,
            has_graphic_design_errors_note=control.has_graphic_design_errors_note,
            print_correctness=control.print_correctness,
            print_correctness_note=control.print_correctness_note,
            has_labeling_errors=control.has_labeling_errors,
            has_labeling_errors_note=control.has_labeling_errors_note,
            cap_is_correct=control.cap_is_correct,
            cap_is_correct_note=control.cap_is_correct_note,
            induction_seal_weld_correct=control.induction_seal_weld_correct,
            induction_seal_weld_correct_note=control.induction_seal_weld_correct_note,
            induction_seal_opening_correct=control.induction_seal_opening_correct,
            induction_seal_opening_correct_note=control.induction_seal_opening_correct_note,
            package_is_dirty=control.package_is_dirty,
            package_is_dirty_note=control.package_is_dirty_note,
            package_is_damaged=control.package_is_damaged,
            package_is_damaged_note=control.package_is_damaged_note,
            qr_code_is_active=control.qr_code_is_active,
            qr_code_is_active_note=control.qr_code_is_active_note,
            package_contents_match_card=control.package_contents_match_card,
            package_contents_match_card_note=control.package_contents_match_card_note,
            product_verified=control.product_verified,
            product_verified_note=control.product_verified_note,
            comment=control.comment,
        )
        control.label_status = "relabel_requested"
        db.add(control)
        db.add(clone)
        if control.ordered_test_id is not None:
            touched_order_ids.add(control.ordered_test_id)

    if touched_order_ids:
        orders = (
            db.query(VariantProductBatchTestOrder)
            .filter(VariantProductBatchTestOrder.id.in_(sorted(touched_order_ids)))
            .all()
        )
        for order in orders:
            order.label_status = "current"
            db.add(order)

    db.commit()
    return {"relabeled": len(controls)}


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

    if payload.asana:
        row = settings["asana"]
        if payload.asana.base_url is not None:
            row.base_url = payload.asana.base_url
        if payload.asana.access_token is not None:
            row.api_key = payload.asana.access_token

    db.commit()
    apply_runtime_integration_settings(db)
    return build_settings_response(db)


@app.get("/api/asana/me", response_model=AsanaMeResponseDTO)
def get_asana_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    base_url, access_token = get_asana_credentials(db)
    payload = call_asana_api("GET", f"{base_url}/users/me", access_token)
    return {
        "status": "ok",
        "base_url": base_url,
        "user": payload.get("data", payload),
    }


@app.get("/api/asana/tasks/{task_gid}", response_model=AsanaTaskResponseDTO)
def get_asana_task(
    task_gid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    normalized_task_gid = (task_gid or "").strip()
    if not normalized_task_gid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pole task_gid jest wymagane.",
        )

    base_url, access_token = get_asana_credentials(db)
    payload = call_asana_api("GET", f"{base_url}/tasks/{normalized_task_gid}", access_token)
    return {
        "status": "ok",
        "task_gid": normalized_task_gid,
        "task": payload.get("data", payload),
    }


@app.post("/api/asana/comment", response_model=AsanaCommentResponseDTO)
def create_asana_comment(
    payload: AsanaCommentCreateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    base_url, access_token = get_asana_credentials(db)
    task_gid = (payload.task_gid or "").strip()
    text = (payload.text or "").strip()

    if not task_gid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pole task_gid jest wymagane.",
        )

    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pole text jest wymagane.",
        )

    result = call_asana_api(
        "POST",
        f"{base_url}/tasks/{task_gid}/stories",
        access_token,
        json_payload={"data": {"text": text}},
    )
    return {
        "status": "ok",
        "task_gid": task_gid,
        "story": result.get("data", result),
    }


@app.get("/api/system/diagnostics", response_model=DiagnosticsResponseDTO)
def get_system_diagnostics(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return build_diagnostics_response(db, current_user, request)


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
        app_logger.exception("Prestashop fetch error: %s", e)
        presta_orders = []

    try:
        bl_orders = await baselinker_client.get_latest_orders()
    except Exception as e:
        app_logger.exception("Baselinker fetch error: %s", e)
        bl_orders = []

    try:
        woo_orders = await woocommerce_client.get_latest_orders(limit=1)
    except Exception as e:
        app_logger.exception("WooCommerce fetch error: %s", e)
        woo_orders = []

    try:
        shopify_orders = await shopify_client.get_latest_orders(limit=5)
    except Exception as e:
        app_logger.exception("Shopify fetch error: %s", e)
        shopify_orders = []

    try:
        magento_orders = await magento_client.get_latest_orders(limit=5)
    except Exception as e:
        app_logger.exception("Magento fetch error: %s", e)
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

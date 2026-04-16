from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VariantProductBatchTestOrderCreate(BaseModel):
    sku: str
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    batch_number: str


class VariantProductBatchArchiveRequest(BaseModel):
    ids: list[int]


class VariantProductBatchCoARequest(BaseModel):
    ids: list[int]
    detail_ids: list[int]


class VariantProductBatchTestOrderResponse(BaseModel):
    id: int
    sku: str
    project_number: Optional[str] = None
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    batch_number: str
    batch_added_at: datetime
    ordered_at: Optional[datetime] = None
    printed_material_type: Optional[str] = None
    product_name: Optional[str] = None
    product_project_number: Optional[str] = None
    product_ean_number: Optional[str] = None
    product_batch_number: Optional[str] = None
    product_expiry_date: Optional[str] = None
    control_date: Optional[str] = None
    market_label_version: Optional[str] = None
    active_substances_match_pds: Optional[str] = None
    label_version_matches_used_version: Optional[str] = None
    has_printing_errors: Optional[str] = None
    has_graphic_design_errors: Optional[str] = None
    print_correctness: Optional[str] = None
    has_labeling_errors: Optional[str] = None
    cap_is_correct: Optional[str] = None
    induction_seal_weld_correct: Optional[str] = None
    induction_seal_opening_correct: Optional[str] = None
    package_is_dirty: Optional[str] = None
    package_is_damaged: Optional[str] = None
    qr_code_is_active: Optional[str] = None
    package_contents_match_card: Optional[str] = None
    product_verified: Optional[str] = None
    comment: Optional[str] = None
    control_saved_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True

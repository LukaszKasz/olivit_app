from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VariantProductFinishedProductControlCreate(BaseModel):
    ordered_test_id: int
    sku: str
    name: str
    ean: str
    printed_material_type: str
    product_name: str
    product_project_number: str
    product_ean_number: str
    product_batch_number: str
    product_expiry_date: str
    control_date: str
    market_label_version: str
    active_substances_match_pds: str
    label_version_matches_used_version: str
    has_printing_errors: str
    has_graphic_design_errors: str
    print_correctness: str
    has_labeling_errors: str
    cap_is_correct: str
    induction_seal_weld_correct: str
    induction_seal_opening_correct: str
    package_is_dirty: str
    package_is_damaged: str
    qr_code_is_active: str
    package_contents_match_card: str
    product_verified: str
    comment: Optional[str] = None


class VariantProductFinishedProductControlResponse(BaseModel):
    id: int
    sku: str
    name: str
    ean: str
    printed_material_type: str
    product_name: str
    product_project_number: str
    product_ean_number: str
    product_batch_number: str
    product_expiry_date: str
    control_date: str
    market_label_version: str
    active_substances_match_pds: str
    label_version_matches_used_version: str
    has_printing_errors: str
    has_graphic_design_errors: str
    print_correctness: str
    has_labeling_errors: str
    cap_is_correct: str
    induction_seal_weld_correct: str
    induction_seal_opening_correct: str
    package_is_dirty: str
    package_is_damaged: str
    qr_code_is_active: str
    package_contents_match_card: str
    product_verified: str
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

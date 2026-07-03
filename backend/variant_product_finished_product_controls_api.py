from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VariantProductFinishedProductControlCreate(BaseModel):
    ordered_test_id: int
    label_status: str
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
    active_substances_match_pds_note: Optional[str] = None
    label_version_matches_used_version: str
    label_version_matches_used_version_note: Optional[str] = None
    has_printing_errors: str
    has_printing_errors_note: Optional[str] = None
    has_graphic_design_errors: str
    has_graphic_design_errors_note: Optional[str] = None
    print_correctness: str
    print_correctness_note: Optional[str] = None
    has_labeling_errors: str
    has_labeling_errors_note: Optional[str] = None
    cap_is_correct: str
    cap_is_correct_note: Optional[str] = None
    induction_seal_weld_correct: str
    induction_seal_weld_correct_note: Optional[str] = None
    induction_seal_opening_correct: str
    induction_seal_opening_correct_note: Optional[str] = None
    package_is_dirty: str
    package_is_dirty_note: Optional[str] = None
    package_is_damaged: str
    package_is_damaged_note: Optional[str] = None
    qr_code_is_active: str
    qr_code_is_active_note: Optional[str] = None
    package_contents_match_card: str
    package_contents_match_card_note: Optional[str] = None
    product_verified: str
    product_verified_note: Optional[str] = None
    comment: Optional[str] = None


class VariantProductFinishedProductControlBulkStatusUpdate(BaseModel):
    ids: list[int]
    label_status: str


class VariantProductFinishedProductControlResponse(BaseModel):
    id: int
    ordered_test_id: Optional[int] = None
    test_order_id: Optional[int] = None
    label_control_id: Optional[int] = None
    project_number: Optional[str] = None
    sku: str
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    asana_task_number: Optional[str] = None
    label_status: str
    printed_material_type: str
    product_name: str
    product_project_number: str
    product_ean_number: str
    product_batch_number: str
    product_expiry_date: str
    control_date: str
    market_label_version: str
    active_substances_match_pds: str
    active_substances_match_pds_note: Optional[str] = None
    label_version_matches_used_version: str
    label_version_matches_used_version_note: Optional[str] = None
    has_printing_errors: str
    has_printing_errors_note: Optional[str] = None
    has_graphic_design_errors: str
    has_graphic_design_errors_note: Optional[str] = None
    print_correctness: str
    print_correctness_note: Optional[str] = None
    has_labeling_errors: str
    has_labeling_errors_note: Optional[str] = None
    cap_is_correct: str
    cap_is_correct_note: Optional[str] = None
    induction_seal_weld_correct: str
    induction_seal_weld_correct_note: Optional[str] = None
    induction_seal_opening_correct: str
    induction_seal_opening_correct_note: Optional[str] = None
    package_is_dirty: str
    package_is_dirty_note: Optional[str] = None
    package_is_damaged: str
    package_is_damaged_note: Optional[str] = None
    qr_code_is_active: str
    qr_code_is_active_note: Optional[str] = None
    package_contents_match_card: str
    package_contents_match_card_note: Optional[str] = None
    product_verified: str
    product_verified_note: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

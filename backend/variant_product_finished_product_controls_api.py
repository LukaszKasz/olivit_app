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
    sample_location: str
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
    carton_market_label_version: Optional[str] = None
    carton_active_substances_match_pds: Optional[str] = None
    carton_active_substances_match_pds_note: Optional[str] = None
    carton_label_version_matches_used_version: Optional[str] = None
    carton_label_version_matches_used_version_note: Optional[str] = None
    carton_has_printing_errors: Optional[str] = None
    carton_has_printing_errors_note: Optional[str] = None
    carton_has_graphic_design_errors: Optional[str] = None
    carton_has_graphic_design_errors_note: Optional[str] = None
    carton_print_correctness: Optional[str] = None
    carton_print_correctness_note: Optional[str] = None
    carton_has_labeling_errors: Optional[str] = None
    carton_has_labeling_errors_note: Optional[str] = None
    carton_cap_is_correct: Optional[str] = None
    carton_cap_is_correct_note: Optional[str] = None
    carton_induction_seal_weld_correct: Optional[str] = None
    carton_induction_seal_weld_correct_note: Optional[str] = None
    carton_induction_seal_opening_correct: Optional[str] = None
    carton_induction_seal_opening_correct_note: Optional[str] = None
    carton_package_is_dirty: Optional[str] = None
    carton_package_is_dirty_note: Optional[str] = None
    carton_package_is_damaged: Optional[str] = None
    carton_package_is_damaged_note: Optional[str] = None
    carton_qr_code_is_active: Optional[str] = None
    carton_qr_code_is_active_note: Optional[str] = None
    carton_package_contents_match_card: Optional[str] = None
    carton_package_contents_match_card_note: Optional[str] = None
    carton_product_verified: Optional[str] = None
    carton_product_verified_note: Optional[str] = None
    comment: Optional[str] = None


class VariantProductFinishedProductControlPlaceholderItem(BaseModel):
    sku: str
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    asana_task_number: Optional[str] = None
    product_project_number: str
    product_batch_number: str
    product_expiry_date: Optional[str] = None


class VariantProductFinishedProductControlPlaceholderRequest(BaseModel):
    items: list[VariantProductFinishedProductControlPlaceholderItem]


class VariantProductFinishedProductControlBulkStatusUpdate(BaseModel):
    ids: list[int]
    label_status: str
    comment: Optional[str] = None


class VariantProductFinishedProductControlBulkIds(BaseModel):
    ids: list[int]


class VariantProductFinishedProductControlDocumentsRequest(BaseModel):
    ids: list[int]
    document_names: list[str]


class VariantProductFinishedProductControlResponse(BaseModel):
    id: int
    ordered_test_id: Optional[int] = None
    test_order_id: Optional[int] = None
    original_test_order_id: Optional[int] = None
    label_control_id: Optional[int] = None
    original_label_control_id: Optional[int] = None
    project_number: Optional[str] = None
    po_number: Optional[str] = None
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
    sample_location: Optional[str] = None
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
    carton_market_label_version: Optional[str] = None
    carton_active_substances_match_pds: Optional[str] = None
    carton_active_substances_match_pds_note: Optional[str] = None
    carton_label_version_matches_used_version: Optional[str] = None
    carton_label_version_matches_used_version_note: Optional[str] = None
    carton_has_printing_errors: Optional[str] = None
    carton_has_printing_errors_note: Optional[str] = None
    carton_has_graphic_design_errors: Optional[str] = None
    carton_has_graphic_design_errors_note: Optional[str] = None
    carton_print_correctness: Optional[str] = None
    carton_print_correctness_note: Optional[str] = None
    carton_has_labeling_errors: Optional[str] = None
    carton_has_labeling_errors_note: Optional[str] = None
    carton_cap_is_correct: Optional[str] = None
    carton_cap_is_correct_note: Optional[str] = None
    carton_induction_seal_weld_correct: Optional[str] = None
    carton_induction_seal_weld_correct_note: Optional[str] = None
    carton_induction_seal_opening_correct: Optional[str] = None
    carton_induction_seal_opening_correct_note: Optional[str] = None
    carton_package_is_dirty: Optional[str] = None
    carton_package_is_dirty_note: Optional[str] = None
    carton_package_is_damaged: Optional[str] = None
    carton_package_is_damaged_note: Optional[str] = None
    carton_qr_code_is_active: Optional[str] = None
    carton_qr_code_is_active_note: Optional[str] = None
    carton_package_contents_match_card: Optional[str] = None
    carton_package_contents_match_card_note: Optional[str] = None
    carton_product_verified: Optional[str] = None
    carton_product_verified_note: Optional[str] = None
    comment: Optional[str] = None
    linked_document_names: list[str] = []
    batch_linked_document_names: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

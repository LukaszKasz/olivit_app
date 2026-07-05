from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VariantProductBatchTestOrderCreate(BaseModel):
    sku: str
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    batch_number: str
    asana_task_number: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None


class VariantProductBatchTestOrderBulkItem(BaseModel):
    sku: str
    name: str
    ean: str
    batch_number: str


class VariantProductBatchTestOrderBulkCreate(BaseModel):
    laboratory_name: Optional[str] = None
    asana_task_number: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None
    items: list[VariantProductBatchTestOrderBulkItem]


class VariantProductBatchTestOrderUpdate(BaseModel):
    workflow_status: Optional[str] = None
    clarification_note: Optional[str] = None
    laboratory_name: Optional[str] = None
    batch_number: Optional[str] = None
    asana_task_number: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None


class VariantProductBatchRetestRequest(BaseModel):
    order_id: int
    laboratory_name: str
    batch_number: str
    asana_task_number: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None


class VariantProductBatchArchiveRequest(BaseModel):
    ids: list[int]


class VariantProductBatchDocumentsRequest(BaseModel):
    ids: list[int]
    document_names: list[str]


class VariantProductBatchCoARequest(BaseModel):
    ids: list[int]
    detail_ids: list[int]
    linked_document_names: list[str] = []
    conclusion_text: str = ""


class VariantProductBatchTestOrderResponse(BaseModel):
    id: int
    test_order_id: Optional[int] = None
    original_test_order_id: Optional[int] = None
    related_label_controls_count: int = 0
    related_label_controls_resolved_count: int = 0
    label_control_id: Optional[int] = None
    sku: str
    project_number: Optional[str] = None
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    batch_number: str
    asana_task_number: Optional[str] = None
    batch_added_at: datetime
    ordered_at: Optional[datetime] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None
    workflow_status: Optional[str] = None
    clarification_note: Optional[str] = None
    label_status: Optional[str] = None
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
    linked_document_names: list[str] = []
    control_saved_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VariantProductBatchRelatedLabelControlResponse(BaseModel):
    id: int
    ordered_test_id: Optional[int] = None
    sku: str
    name: str
    ean: str
    laboratory_name: Optional[str] = None
    asana_task_number: Optional[str] = None
    label_status: str
    product_batch_number: str
    product_expiry_date: str

    class Config:
        from_attributes = True


class VariantProductBatchRelatedLabelControlsResponse(BaseModel):
    order_id: int
    related_label_controls: list[VariantProductBatchRelatedLabelControlResponse]

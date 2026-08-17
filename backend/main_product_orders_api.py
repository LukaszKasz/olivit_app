from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MainProductTestOrderCreate(BaseModel):
    project_number: str
    name: str
    laboratory_name: Optional[str] = None
    batch_number: str
    asana_task_number: Optional[str] = None
    test_cost: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None


class MainProductTestOrderUpdate(BaseModel):
    workflow_status: Optional[str] = None
    clarification_note: Optional[str] = None


class MainProductLabResultItemUpdate(BaseModel):
    detail_id: int
    result_value: str = ""
    notes: Optional[str] = None


class MainProductLabResultsUpdate(BaseModel):
    results: list[MainProductLabResultItemUpdate]


class MainProductLabResultItemResponse(BaseModel):
    detail_id: int
    parameter_type_pl: str
    parameter_type_en: str
    parameter_name_pl: str
    parameter_name_en: str
    requirement_pl: str
    requirement_en: str
    method_pl: str
    method_en: str
    result_value: str = ""
    notes: Optional[str] = None
    updated_at: Optional[datetime] = None


class MainProductLabResultsResponse(BaseModel):
    ordered_test_id: int
    project_number: str
    product_name: str
    batch_number: str
    laboratory_name: Optional[str] = None
    saved_at: Optional[datetime] = None
    results: list[MainProductLabResultItemResponse]


class MainProductTestOrderResponse(BaseModel):
    id: int
    project_number: str
    name: str
    laboratory_name: Optional[str] = None
    batch_number: Optional[str] = None
    asana_task_number: Optional[str] = None
    test_cost: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    test_cost: Optional[str] = None
    po_number: Optional[str] = None
    workflow_status: Optional[str] = None
    clarification_note: Optional[str] = None
    ordered_at: datetime

    class Config:
        from_attributes = True

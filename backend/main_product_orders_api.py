from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MainProductTestOrderCreate(BaseModel):
    project_number: str
    name: str
    laboratory_name: Optional[str] = None
    batch_number: str
    asana_task_number: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None


class MainProductTestOrderUpdate(BaseModel):
    workflow_status: Optional[str] = None
    clarification_note: Optional[str] = None


class MainProductTestOrderResponse(BaseModel):
    id: int
    project_number: str
    name: str
    laboratory_name: Optional[str] = None
    batch_number: Optional[str] = None
    asana_task_number: Optional[str] = None
    production_date: Optional[str] = None
    expiry_date: Optional[str] = None
    planned_test_date: Optional[str] = None
    workflow_status: Optional[str] = None
    clarification_note: Optional[str] = None
    ordered_at: datetime

    class Config:
        from_attributes = True

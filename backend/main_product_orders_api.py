from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MainProductTestOrderCreate(BaseModel):
    project_number: str
    name: str
    laboratory_name: Optional[str] = None
    batch_number: str


class MainProductTestOrderResponse(BaseModel):
    id: int
    project_number: str
    name: str
    laboratory_name: Optional[str] = None
    batch_number: Optional[str] = None
    ordered_at: datetime

    class Config:
        from_attributes = True

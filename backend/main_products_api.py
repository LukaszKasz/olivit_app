from pydantic import BaseModel


class MainProductResponse(BaseModel):
    id: int
    project_number: str
    name: str
    order_index: int

    class Config:
        from_attributes = True

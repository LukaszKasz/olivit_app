from pydantic import BaseModel


class VariantProductResponse(BaseModel):
    id: int
    sku: str
    project_number: str | None = None
    name: str
    ean: str
    order_index: int

    class Config:
        from_attributes = True


class VariantProductsPageResponse(BaseModel):
    items: list[VariantProductResponse]
    total: int
    page: int
    page_size: int

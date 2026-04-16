from pydantic import BaseModel


class MainProductResponse(BaseModel):
    id: int
    project_number: str
    name: str
    id_szczegolow_produktu: int | None = None
    order_index: int

    class Config:
        from_attributes = True


class ProductDetailedParameterResponse(BaseModel):
    id: int
    id_szczegolow_produktu: int | None = None
    parameter_type_pl: str
    parameter_type_en: str
    parameter_name_pl: str
    parameter_name_en: str
    requirement_pl: str
    requirement_en: str
    method_pl: str
    method_en: str
    confirmation_pl: str | None = None
    confirmation_en: str | None = None

    class Config:
        from_attributes = True

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base


class User(Base):
    """
    User model for authentication.
    Stores user credentials and basic information.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<User(username={self.username}, email={self.email})>"


class IntegrationSettings(Base):
    """
    Integration credentials/settings stored in DB.
    One row per provider: prestashop / woocommerce / baselinker.
    """
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), unique=True, index=True, nullable=False)
    base_url = Column(String(255), nullable=False)
    api_key = Column(String(255), nullable=True)
    consumer_key = Column(String(255), nullable=True)
    consumer_secret = Column(String(255), nullable=True)
    access_token_secret = Column(String(255), nullable=True)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MainProduct(Base):
    __tablename__ = "main_products"

    id = Column(Integer, primary_key=True, index=True)
    project_number = Column(String(50), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, index=True)


class MainProductTestOrder(Base):
    __tablename__ = "main_product_test_orders"

    id = Column(Integer, primary_key=True, index=True)
    project_number = Column(String(50), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    laboratory_name = Column(String(100), index=True, nullable=False)
    batch_number = Column(String(255), nullable=True)
    ordered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class VariantProduct(Base):
    __tablename__ = "variant_products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), index=True, nullable=False)
    name = Column(String(512), nullable=False)
    ean = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, index=True)


class VariantProductBatchTestOrder(Base):
    __tablename__ = "variant_product_batch_test_orders"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), index=True, nullable=False)
    name = Column(String(512), nullable=False)
    ean = Column(String(255), nullable=False)
    laboratory_name = Column(String(100), index=True, nullable=True)
    batch_number = Column(String(255), nullable=False)
    batch_added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    ordered_at = Column(DateTime(timezone=True), nullable=True, index=True)
    printed_material_type = Column(String(100), nullable=True)
    product_name = Column(String(255), nullable=True)
    product_project_number = Column(String(100), nullable=True)
    product_ean_number = Column(String(255), nullable=True)
    product_batch_number = Column(String(255), nullable=True)
    product_expiry_date = Column(String(50), nullable=True)
    control_date = Column(String(50), nullable=True)
    market_label_version = Column(String(255), nullable=True)
    active_substances_match_pds = Column(String(50), nullable=True)
    label_version_matches_used_version = Column(String(10), nullable=True)
    has_printing_errors = Column(String(10), nullable=True)
    has_graphic_design_errors = Column(String(10), nullable=True)
    print_correctness = Column(String(10), nullable=True)
    has_labeling_errors = Column(String(10), nullable=True)
    cap_is_correct = Column(String(20), nullable=True)
    induction_seal_weld_correct = Column(String(20), nullable=True)
    induction_seal_opening_correct = Column(String(20), nullable=True)
    package_is_dirty = Column(String(10), nullable=True)
    package_is_damaged = Column(String(10), nullable=True)
    qr_code_is_active = Column(String(20), nullable=True)
    package_contents_match_card = Column(String(10), nullable=True)
    product_verified = Column(String(10), nullable=True)
    comment = Column(String(2000), nullable=True)
    control_saved_at = Column(DateTime(timezone=True), nullable=True, index=True)


class VariantProductFinishedProductControl(Base):
    __tablename__ = "variant_product_finished_product_controls"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), index=True, nullable=False)
    name = Column(String(512), nullable=False)
    ean = Column(String(255), nullable=False)
    printed_material_type = Column(String(100), nullable=False)
    product_name = Column(String(255), nullable=False)
    product_project_number = Column(String(100), nullable=False)
    product_ean_number = Column(String(255), nullable=False)
    product_batch_number = Column(String(255), nullable=False)
    product_expiry_date = Column(String(50), nullable=False)
    control_date = Column(String(50), nullable=False)
    market_label_version = Column(String(255), nullable=False)
    active_substances_match_pds = Column(String(50), nullable=False)
    label_version_matches_used_version = Column(String(10), nullable=False)
    has_printing_errors = Column(String(10), nullable=False)
    has_graphic_design_errors = Column(String(10), nullable=False)
    print_correctness = Column(String(10), nullable=False)
    has_labeling_errors = Column(String(10), nullable=False)
    cap_is_correct = Column(String(20), nullable=False)
    induction_seal_weld_correct = Column(String(20), nullable=False)
    induction_seal_opening_correct = Column(String(20), nullable=False)
    package_is_dirty = Column(String(10), nullable=False)
    package_is_damaged = Column(String(10), nullable=False)
    qr_code_is_active = Column(String(20), nullable=False)
    package_contents_match_card = Column(String(10), nullable=False)
    product_verified = Column(String(10), nullable=False)
    comment = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

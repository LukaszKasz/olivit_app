import os
from datetime import datetime
from typing import Any, Dict, List

import httpx

SHOPIFY_URL = os.getenv("SHOPIFY_URL", "https://oliwasamos.myshopify.com/admin/api/2025-01")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
SHOPIFY_API_KEY = os.getenv("SHOPIFY_API_KEY", "")
SHOPIFY_API_SECRET = os.getenv("SHOPIFY_API_SECRET", "")
SHOPIFY_VERIFY_SSL = os.getenv("SHOPIFY_VERIFY_SSL", "true").lower() in ("1", "true", "yes", "on")


class ShopifyClient:
    def __init__(self) -> None:
        self.base_url = SHOPIFY_URL.rstrip("/")
        self.access_token = SHOPIFY_ACCESS_TOKEN
        self.api_key = SHOPIFY_API_KEY
        self.api_secret = SHOPIFY_API_SECRET
        self.verify_ssl = SHOPIFY_VERIFY_SSL

    def configure(
        self,
        base_url: str,
        access_token: str,
        api_key: str,
        api_secret: str,
        verify_ssl: bool,
    ) -> None:
        self.base_url = (base_url or "").rstrip("/")
        self.access_token = access_token or ""
        self.api_key = api_key or ""
        self.api_secret = api_secret or ""
        self.verify_ssl = verify_ssl

    async def get_latest_orders(self, limit: int = 5) -> List[Dict[str, Any]]:
        if not self.base_url or not self.access_token:
            return []

        url = f"{self.base_url}/orders.json"
        params = {
            "limit": max(1, min(limit, 250)),
            "status": "any",
            "order": "created_at desc",
            "fields": "id,name,customer,current_total_price,gateway,payment_gateway_names,created_at,currency",
        }
        headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(verify=self.verify_ssl, timeout=20.0) as client:
            try:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                orders = response.json().get("orders", [])
                mapped_orders: List[Dict[str, Any]] = []

                for order in orders:
                    created_at = order.get("created_at", "")
                    if created_at:
                        created_at = created_at.replace("T", " ").replace("Z", "")
                    else:
                        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    customer = order.get("customer") or {}
                    customer_ref = customer.get("email") or customer.get("id") or "Guest"
                    payment = order.get("gateway")
                    if not payment:
                        gateways = order.get("payment_gateway_names") or []
                        payment = ", ".join(gateways) if gateways else "unknown"

                    mapped_orders.append(
                        {
                            "id": f"SH-{order.get('id')}",
                            "reference": order.get("name") or f"Shopify order #{order.get('id')}",
                            "id_customer": str(customer_ref),
                            "total_paid": order.get("current_total_price"),
                            "payment": payment,
                            "date_add": created_at,
                            "source": "Shopify",
                        }
                    )

                return mapped_orders
            except Exception as e:
                print(f"Shopify Error: {e}")
                return []

    async def get_order_details(self, order_id: str) -> List[Dict[str, Any]]:
        if not self.base_url or not self.access_token:
            return []

        real_id = order_id.replace("SH-", "")
        url = f"{self.base_url}/orders/{real_id}.json"
        headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Accept": "application/json",
        }
        params = {
            "fields": "id,line_items",
        }

        async with httpx.AsyncClient(verify=self.verify_ssl, timeout=20.0) as client:
            try:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                order_data = response.json().get("order") or {}
                products = order_data.get("line_items") or []

                mapped_products: List[Dict[str, Any]] = []
                for item in products:
                    mapped_products.append(
                        {
                            "product_id": item.get("product_id") or item.get("variant_id") or item.get("sku") or "",
                            "product_name": item.get("name"),
                            "product_quantity": item.get("quantity"),
                            "product_price": item.get("price"),
                        }
                    )

                return mapped_products
            except Exception as e:
                print(f"Shopify Error Details: {e}")
                return []


shopify_client = ShopifyClient()

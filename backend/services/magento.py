import os
from datetime import datetime
from typing import Any, Dict, List
from urllib.parse import urlencode

import httpx
from oauthlib.oauth1 import Client as OAuth1Client
from oauthlib.oauth1.rfc5849 import SIGNATURE_HMAC_SHA256

MAGENTO_URL = os.getenv("MAGENTO_URL", "https://localhost:8444/rest")
MAGENTO_ACCESS_TOKEN = os.getenv("MAGENTO_ACCESS_TOKEN", "")
MAGENTO_CONSUMER_KEY = os.getenv("MAGENTO_CONSUMER_KEY", "")
MAGENTO_CONSUMER_SECRET = os.getenv("MAGENTO_CONSUMER_SECRET", "")
MAGENTO_ACCESS_TOKEN_SECRET = os.getenv("MAGENTO_ACCESS_TOKEN_SECRET", "")
MAGENTO_VERIFY_SSL = os.getenv("MAGENTO_VERIFY_SSL", "true").lower() in ("1", "true", "yes", "on")


class MagentoClient:
    def __init__(self) -> None:
        self.base_url = MAGENTO_URL.rstrip("/")
        self.access_token = MAGENTO_ACCESS_TOKEN
        self.consumer_key = MAGENTO_CONSUMER_KEY
        self.consumer_secret = MAGENTO_CONSUMER_SECRET
        self.access_token_secret = MAGENTO_ACCESS_TOKEN_SECRET
        self.verify_ssl = MAGENTO_VERIFY_SSL

    def configure(
        self,
        base_url: str,
        access_token: str,
        consumer_key: str,
        consumer_secret: str,
        access_token_secret: str,
        verify_ssl: bool,
    ) -> None:
        self.base_url = (base_url or "").rstrip("/")
        self.access_token = access_token or ""
        self.consumer_key = consumer_key or ""
        self.consumer_secret = consumer_secret or ""
        self.access_token_secret = access_token_secret or ""
        self.verify_ssl = verify_ssl

    def _has_oauth1(self) -> bool:
        return all([self.consumer_key, self.consumer_secret, self.access_token, self.access_token_secret])

    def _build_request_auth(self, url: str) -> tuple[str, Dict[str, str]]:
        headers: Dict[str, str] = {"Accept": "application/json"}
        if self._has_oauth1():
            oauth_client = OAuth1Client(
                client_key=self.consumer_key,
                client_secret=self.consumer_secret,
                resource_owner_key=self.access_token,
                resource_owner_secret=self.access_token_secret,
                signature_method=SIGNATURE_HMAC_SHA256,
            )
            signed_url, signed_headers, _ = oauth_client.sign(url, http_method="GET")
            headers.update(signed_headers)
            headers["Accept"] = "application/json"
            return signed_url, headers

        headers["Authorization"] = f"Bearer {self.access_token}"
        return url, headers

    async def get_latest_orders(self, limit: int = 5) -> List[Dict[str, Any]]:
        if not self.base_url or not self.access_token:
            return []

        url = f"{self.base_url}/V1/orders"
        params = {
            "searchCriteria[pageSize]": max(1, min(limit, 100)),
            "searchCriteria[currentPage]": 1,
            "searchCriteria[sortOrders][0][field]": "created_at",
            "searchCriteria[sortOrders][0][direction]": "DESC",
        }

        async with httpx.AsyncClient(verify=self.verify_ssl, timeout=20.0) as client:
            try:
                if self._has_oauth1():
                    signed_url, headers = self._build_request_auth(f"{url}?{urlencode(params)}")
                    response = await client.get(signed_url, headers=headers)
                else:
                    signed_url, headers = self._build_request_auth(url)
                    response = await client.get(signed_url, headers=headers, params=params)
                response.raise_for_status()
                orders = response.json().get("items") or []
                mapped_orders: List[Dict[str, Any]] = []

                for order in orders:
                    created_at = order.get("created_at", "")
                    if created_at:
                        created_at = created_at.replace("T", " ")
                    else:
                        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    customer_ref = (
                        order.get("customer_email")
                        or f"{order.get('customer_firstname', '')} {order.get('customer_lastname', '')}".strip()
                        or "Guest"
                    )

                    payment = "unknown"
                    payment_data = order.get("payment") or {}
                    if payment_data.get("method"):
                        payment = payment_data["method"]

                    entity_id = order.get("entity_id")
                    increment_id = order.get("increment_id")
                    mapped_orders.append(
                        {
                            "id": f"MG-{entity_id}",
                            "reference": increment_id or f"Magento order #{entity_id}",
                            "id_customer": str(customer_ref),
                            "total_paid": order.get("grand_total"),
                            "payment": payment,
                            "date_add": created_at,
                            "source": "Magento",
                        }
                    )

                return mapped_orders
            except Exception as e:
                print(f"Magento Error: {e}")
                return []

    async def get_order_details(self, order_id: str) -> List[Dict[str, Any]]:
        if not self.base_url or not self.access_token:
            return []

        real_id = order_id.replace("MG-", "")
        url = f"{self.base_url}/V1/orders/{real_id}"

        async with httpx.AsyncClient(verify=self.verify_ssl, timeout=20.0) as client:
            try:
                signed_url, headers = self._build_request_auth(url)
                response = await client.get(signed_url, headers=headers)
                response.raise_for_status()
                order = response.json() or {}
                products = order.get("items") or []
                mapped_products: List[Dict[str, Any]] = []

                for item in products:
                    mapped_products.append(
                        {
                            "product_id": item.get("sku") or item.get("product_id") or "",
                            "product_name": item.get("name"),
                            "product_quantity": item.get("qty_ordered"),
                            "product_price": item.get("price"),
                        }
                    )

                return mapped_products
            except Exception as e:
                print(f"Magento Error Details: {e}")
                return []


magento_client = MagentoClient()

import httpx
import os
from typing import List, Dict, Any
from datetime import datetime

WOOCOMMERCE_URL = os.getenv("WOOCOMMERCE_URL", "http://localhost:8888/wp-json/wc/v3")
WOOCOMMERCE_CONSUMER_KEY = os.getenv("WOOCOMMERCE_CONSUMER_KEY", "ck_9471093d99c1c129c18ef7703345177878024efc")
WOOCOMMERCE_CONSUMER_SECRET = os.getenv("WOOCOMMERCE_CONSUMER_SECRET", "cs_520eb8192aab3707582c8757a165dba5d0bbb969")
WOOCOMMERCE_VERIFY_SSL = os.getenv("WOOCOMMERCE_VERIFY_SSL", "true").lower() in ("1", "true", "yes", "on")

class WooCommerceClient:
    def __init__(self):
        self.base_url = WOOCOMMERCE_URL
        self.consumer_key = WOOCOMMERCE_CONSUMER_KEY
        self.consumer_secret = WOOCOMMERCE_CONSUMER_SECRET
        self.verify_ssl = WOOCOMMERCE_VERIFY_SSL

    def configure(self, base_url: str, consumer_key: str, consumer_secret: str, verify_ssl: bool) -> None:
        self.base_url = base_url
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.verify_ssl = verify_ssl

    async def get_latest_orders(self, limit: int = 1) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/orders"
        params = {
            "per_page": limit,
            "orderby": "date",
            "order": "desc"
        }
        
        auth = (self.consumer_key, self.consumer_secret)
        
        async with httpx.AsyncClient(verify=self.verify_ssl) as client:
            try:
                response = await client.get(url, params=params, auth=auth)
                response.raise_for_status()
                orders_data = response.json()
                
                mapped_orders = []
                for order in orders_data:
                    date_created = order.get("date_created", "")
                    if date_created:
                        date_created = date_created.replace("T", " ")
                    else:
                        date_created = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        
                    billing = order.get("billing", {})
                    customer_name = f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip()
                    if not customer_name:
                        customer_name = "Guest"

                    mapped_orders.append({
                        "id": f"WC-{order.get('id')}",
                        "reference": order.get("order_key", f"Order #{order.get('id')}"),
                        "id_customer": customer_name,
                        "total_paid": order.get("total"),
                        "payment": order.get("payment_method_title") or order.get("payment_method"),
                        "date_add": date_created,
                        "source": "WooCommerce"
                    })
                return mapped_orders
            except Exception as e:
                print(f"WooCommerce Error: {e}")
                return []

    async def get_order_details(self, order_id: str) -> List[Dict[str, Any]]:
        real_id = order_id.replace("WC-", "")
        url = f"{self.base_url}/orders/{real_id}"
        
        auth = (self.consumer_key, self.consumer_secret)
        
        async with httpx.AsyncClient(verify=self.verify_ssl) as client:
            try:
                response = await client.get(url, auth=auth)
                response.raise_for_status()
                order_data = response.json()
                
                products = order_data.get("line_items", [])
                mapped_products = []
                for item in products:
                    mapped_products.append({
                        "product_id": item.get("product_id") or item.get("sku", ""),
                        "product_name": item.get("name"),
                        "product_quantity": item.get("quantity"),
                        "product_price": item.get("price"),
                    })
                return mapped_products
            except Exception as e:
                print(f"WooCommerce Error Details: {e}")
                return []

woocommerce_client = WooCommerceClient()

import httpx
import os
from typing import List, Dict, Any
from datetime import datetime

BASELINKER_URL = os.getenv("BASELINKER_URL", "https://api.baselinker.com/connector.php")
BASELINKER_API_KEY = os.getenv("BASELINKER_API_KEY", "5018360-5051307-EXCFQBFHRKRTTEA9LDQEQ17ZGSKNW2XIQET97CVPTB61FXH7MF0J02DQ0C6C9Y88")

class BaselinkerClient:
    def __init__(self):
        self.base_url = BASELINKER_URL
        self.api_key = BASELINKER_API_KEY

    def configure(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url
        self.api_key = api_key
    
    async def get_latest_orders(self) -> List[Dict[str, Any]]:
        headers = {
            "X-BLToken": self.api_key
        }
        data = {
            "method": "getOrders",
            "parameters": "{}"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=headers, data=data)
                response.raise_for_status()
                result = response.json()
                
                if result.get("status") == "SUCCESS" and "orders" in result:
                    mapped_orders = []
                    for order in result["orders"][:10]:
                        try:
                            # Baselinker returns timestamp or string
                            date_val = order.get("date_add")
                            if date_val:
                                formatted_date = datetime.fromtimestamp(int(date_val)).strftime("%Y-%m-%d %H:%M:%S")
                            else:
                                formatted_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            formatted_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                        mapped_orders.append({
                            "id": f"BL-{order.get('order_id')}",
                            "reference": f"{order.get('order_source')} {order.get('external_order_id')}",
                            "id_customer": order.get("user_login"),
                            "total_paid": order.get("payment_done"),
                            "payment": order.get("payment_method"),
                            "date_add": formatted_date,
                            "source": "Baselinker"
                        })
                    return mapped_orders
                else:
                    print(f"Baselinker response was not success: {result}")
                    return []
            except Exception as e:
                import traceback
                print(f"Baselinker Error: {e}")
                traceback.print_exc()
                return []

    async def get_order_details(self, order_id: str) -> List[Dict[str, Any]]:
        real_id = order_id.replace("BL-", "")
        headers = {
            "X-BLToken": self.api_key
        }
        data = {
            "method": "getOrders",
            "parameters": f'{{"order_id": {real_id}}}'
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.base_url, headers=headers, data=data)
                response.raise_for_status()
                result = response.json()
                
                if result.get("status") == "SUCCESS" and "orders" in result and len(result["orders"]) > 0:
                    products = result["orders"][0].get("products", [])
                    mapped_products = []
                    for p in products:
                        mapped_products.append({
                            "product_id": p.get("product_id") or p.get("sku", ""),
                            "product_name": p.get("name"),
                            "product_quantity": p.get("quantity"),
                            "product_price": p.get("price_brutto"),
                        })
                    return mapped_products
                return []
            except Exception as e:
                print(f"Baselinker Error Details: {e}")
                return []

baselinker_client = BaselinkerClient()

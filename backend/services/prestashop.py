import httpx
import os
from typing import Optional, List, Dict, Any
from fastapi import HTTPException

PRESTASHOP_URL = os.getenv("PRESTASHOP_URL", "http://medmelook.pl/api")
PRESTASHOP_API_KEY = os.getenv("PRESTASHOP_API_KEY", "KUSET62SJEDVMPQYUMNCLM3QMXKM3R3R")

class PrestaShopClient:
    def __init__(self):
        self.base_url = PRESTASHOP_URL
        self.api_key = PRESTASHOP_API_KEY
    
    async def get_latest_orders(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Pobiera ostatnie zamówienia z API Prestashop.
        """
        url = f"{self.base_url}/orders"
        params = {
            "output_format": "JSON",
            "display": "full",
            "limit": limit,
            "sort": "[id_DESC]"
        }
        
        # Używamy Basic Auth gdzie username to api_key a hasło jest puste (jak w `curl -u API_KEY:`)
        auth = (self.api_key, "")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, auth=auth)
                response.raise_for_status()
                data = response.json()
                
                # Prestashop API zwraca strukturę {"orders": [{...}]}
                if "orders" in data:
                    orders = data["orders"]
                    for order in orders:
                        order["source"] = "PrestaShop"
                        order["id"] = f"PS-{order.get('id', '')}"
                    return orders
                return []
                
            except httpx.HTTPStatusError as e:
                # Log the error here if you have a logger configured
                print(f"Błąd HTTP: {e.response.status_code} - {e.response.text}")
                raise HTTPException(status_code=502, detail="Error fetching data from Prestashop")
            except httpx.RequestError as e:
                print(f"Błąd połączenia: {e}")
                raise HTTPException(status_code=503, detail="Could not connect to Prestashop")
                
    async def get_order_details(self, order_id: int) -> List[Dict[str, Any]]:
        """
        Pobiera szczegóły danego zamówienia.
        """
        url = f"{self.base_url}/order_details"
        params = {
            "output_format": "JSON",
            "display": "[id,id_order,product_id,product_name,product_quantity,product_price]",
            "filter[id_order]": f"[{order_id}]"
        }
        
        auth = (self.api_key, "")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params, auth=auth)
                response.raise_for_status()
                data = response.json()
                
                if "order_details" in data:
                    return data["order_details"]
                return []
                
            except httpx.HTTPStatusError as e:
                print(f"Błąd HTTP: {e.response.status_code} - {e.response.text}")
                raise HTTPException(status_code=502, detail="Error fetching details from Prestashop")
            except httpx.RequestError as e:
                print(f"Błąd połączenia: {e}")
                raise HTTPException(status_code=503, detail="Could not connect to Prestashop")

prestashop_client = PrestaShopClient()

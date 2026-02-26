import asyncio
import httpx
import json

base_url = "https://api.baselinker.com/connector.php"
api_key = "5018360-5051307-EXCFQBFHRKRTTEA9LDQEQ17ZGSKNW2XIQET97CVPTB61FXH7MF0J02DQ0C6C9Y88"

async def test():
    headers = {
        "X-BLToken": api_key
    }
    data = {
        "method": "getOrders",
        "parameters": "{}"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(base_url, headers=headers, data=data)
        print("Status:", response.status_code)
        print("Content:", response.text)

asyncio.run(test())

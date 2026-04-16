from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Union

from app.services.zalora_scraper import scrape_zalora


router = APIRouter()


class ProductRequest(BaseModel):
    hairType: Optional[Union[str, List[str]]] = None
    concerns: Optional[Union[str, List[str]]] = None
    limit: Optional[int] = 20
    urls: Optional[List[str]] = None


@router.post("/recommendations")
async def product_recommendations(payload: ProductRequest):
    """
    Scrape editorial recommendation pages and return product candidates.
    """
    max_items = max(1, min(payload.limit or 20, 50))
    products = await scrape_zalora(urls=payload.urls, max_items=max_items)
    return {
        "success": True,
        "source": "zalora-editorial",
        "count": len(products),
        "data": products,
    }

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional, Union

from app.services.lookfantastic_scraper import (
    HAIR_TYPE_URL_MAP,
    scrape_lookfantastic,
)


router = APIRouter()


class ProductRequest(BaseModel):
    hairType: Optional[Union[str, List[str]]] = Field(
        None,
        description="One or more hair types. Supported: " + ", ".join(HAIR_TYPE_URL_MAP.keys()),
    )
    concerns: Optional[Union[str, List[str]]] = None
    limit: Optional[int] = Field(20, ge=1, le=50)
    urls: Optional[List[str]] = None
    useBrowser: Optional[bool] = Field(
        True,
        description="Use Playwright when available, otherwise fall back to httpx scraping",
    )


@router.post("/recommendations")
async def product_recommendations(payload: ProductRequest):
    """
    Return hair product recommendations from Lookfantastic.
    """
    hair_types: Optional[List[str]] = None
    if payload.hairType:
        if isinstance(payload.hairType, str):
            hair_types = [payload.hairType]
        else:
            hair_types = payload.hairType

    concerns: Optional[List[str]] = None
    if payload.concerns:
        if isinstance(payload.concerns, str):
            concerns = [payload.concerns]
        else:
            concerns = payload.concerns

    products = await scrape_lookfantastic(
        hair_types=hair_types,
        concerns=concerns,
        urls=payload.urls,
        max_items=payload.limit or 20,
        use_playwright=payload.useBrowser if payload.useBrowser is not None else True,
    )
    return {
        "success": True,
        "source": "lookfantastic",
        "count": len(products),
        "data": products,
    }


@router.get("/hair-types")
async def list_hair_types():
    return {"hairTypes": list(HAIR_TYPE_URL_MAP.keys())}

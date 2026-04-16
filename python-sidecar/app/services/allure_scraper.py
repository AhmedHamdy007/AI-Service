import json
from typing import Any, Dict, List, Optional

from app.services import scrapy_bootstrap  # noqa: F401  # ensure reactor setup

import scrapy
from scrapy.crawler import CrawlerRunner
from scrapy import signals
from pydispatch import dispatcher
from twisted.internet import defer


SOURCE = {
    "name": "Allure",
    "base_url": "https://www.allure.com",
    "credibility_score": 9,
    "category": "general",
    "description": "Beauty expert recommendations",
}

# Curated default URLs (can be overridden by request payload)
DEFAULT_ARTICLE_URLS = [
    "https://www.allure.com/story/best-protein-treatments-for-curly-hair",
]

_runner: Optional[CrawlerRunner] = None


def _get_runner() -> CrawlerRunner:
    global _runner
    if _runner is None:
        _runner = CrawlerRunner(
            settings={
                "USER_AGENT": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
                "ROBOTSTXT_OBEY": True,
                "LOG_ENABLED": False,
            }
        )
    return _runner


def _safe_json_parse(text: str) -> Optional[Any]:
    text = text.strip()
    if not text or text[0] not in "{[":
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _looks_like_product(obj: Dict[str, Any]) -> bool:
    if not isinstance(obj, dict):
        return False
    name = obj.get("productName") or obj.get("productTitle") or obj.get("name") or obj.get("title")
    brand = obj.get("brandName") or obj.get("brand") or (obj.get("brand", {}) or {}).get("name")
    url = obj.get("productUrl") or obj.get("url") or obj.get("link") or obj.get("shoppingLink")
    has_product_key = any("product" in k.lower() for k in obj.keys())
    return bool(name and (url or brand or has_product_key))


def _normalize_product(obj: Dict[str, Any], page_url: str) -> Dict[str, Any]:
    name = obj.get("productName") or obj.get("productTitle") or obj.get("name") or obj.get("title")
    brand = obj.get("brandName") or obj.get("brand") or (obj.get("brand", {}) or {}).get("name") or "Unknown"
    product_url = obj.get("productUrl") or obj.get("url") or obj.get("link") or obj.get("shoppingLink")
    image = obj.get("imageUrl") or obj.get("image") or (obj.get("image", {}) or {}).get("url")

    return {
        "name": name,
        "brand": brand,
        "price": obj.get("price") or obj.get("productPrice"),
        "currency": obj.get("currency") or "USD",
        "rating": obj.get("rating"),
        "ratingCount": obj.get("ratingCount") or 0,
        "description": obj.get("description") or obj.get("dek") or name,
        "image": image,
        "productUrl": product_url,
        "sku": obj.get("sku"),
        "source": SOURCE["name"],
        "sourceUrl": page_url,
        "credibilityScore": SOURCE["credibility_score"],
        "category": SOURCE["category"],
    }


def _collect_products_from_json(obj: Any, page_url: str, output: List[Dict[str, Any]]) -> None:
    if isinstance(obj, list):
        for item in obj:
            _collect_products_from_json(item, page_url, output)
        return
    if not isinstance(obj, dict):
        return

    if obj.get("@type") == "Product":
        output.append(_normalize_product(obj, page_url))
    if obj.get("@type") == "ItemList" and obj.get("itemListElement"):
        for element in obj["itemListElement"]:
            if isinstance(element, dict) and element.get("item"):
                _collect_products_from_json(element["item"], page_url, output)

    if _looks_like_product(obj):
        output.append(_normalize_product(obj, page_url))

    for value in obj.values():
        _collect_products_from_json(value, page_url, output)


def _extract_products_from_response(response: scrapy.http.TextResponse) -> List[Dict[str, Any]]:
    products: List[Dict[str, Any]] = []

    for script in response.xpath('//script[@type="application/ld+json"]/text()').getall():
        data = _safe_json_parse(script)
        if data is not None:
            _collect_products_from_json(data, response.url, products)

    for script in response.xpath('//script[@type="application/json"]/text()').getall():
        data = _safe_json_parse(script)
        if data is not None:
            _collect_products_from_json(data, response.url, products)

    return products


class AllureSpider(scrapy.Spider):
    name = "allure_spider"

    def __init__(self, urls: List[str], max_items: int = 30, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_urls = urls
        self.max_items = max_items
        self._seen = set()

    def parse(self, response):
        products = _extract_products_from_response(response)
        for product in products:
            key = f"{product.get('brand')}_{product.get('name')}".lower()
            if not product.get("name") or key in self._seen:
                continue
            self._seen.add(key)
            yield product
            if len(self._seen) >= self.max_items:
                return


async def scrape_allure(urls: Optional[List[str]] = None, max_items: int = 30) -> List[Dict[str, Any]]:
    runner = _get_runner()
    items: List[Dict[str, Any]] = []

    def _item_scraped(item, response, spider):
        items.append(dict(item))

    dispatcher.connect(_item_scraped, signal=signals.item_scraped)
    try:
        target_urls = urls or DEFAULT_ARTICLE_URLS
        await defer.ensureDeferred(
            runner.crawl(AllureSpider, urls=target_urls, max_items=max_items)
        )
    finally:
        dispatcher.disconnect(_item_scraped, signal=signals.item_scraped)

    return items

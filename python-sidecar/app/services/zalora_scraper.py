import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


ZALORA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

DEFAULT_ARTICLE_URLS: List[str] = []


def extract_brand_from_url(url: str) -> Optional[str]:
    match = re.search(r"/p/([a-z0-9]+)-", url)
    if match:
        return match.group(1).title()
    return None


def extract_brand_from_name(name: str) -> str:
    known = [
        "AVEDA",
        "Olaplex",
        "Kerastase",
        "Kérastase",
        "Ecru New York",
        "SheaMoisture",
        "Cantu",
        "DevaCurl",
        "Moroccanoil",
        "L'Oreal",
        "Pantene",
        "TRESemmé",
        "OGX",
        "Briogeo",
        "Amika",
        "Wella",
        "Schwarzkopf",
        "Dove",
        "Garnier",
        "Herbal Essences",
    ]
    for brand in known:
        if brand.lower() in name.lower():
            return brand
    return name.split()[0] if name.split() else "Unknown"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


async def scrape_zalora_article(url: str) -> List[Dict]:
    async with httpx.AsyncClient(timeout=12.0, headers=ZALORA_HEADERS) as client:
        response = await client.get(url)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    products: List[Dict] = []

    product_link_re = re.compile(r"/p/|zalora\\.com\\.(?:my|ph)/p/")
    for link in soup.find_all("a", href=product_link_re):
        name = link.get_text(strip=True)
        href = link.get("href") or ""
        product_url = urljoin(url, href)

        if not name or len(name) < 3:
            continue

        image_url = None
        parent = link.parent
        if parent:
            img = parent.find("img")
            if img and img.get("src"):
                image_url = img.get("src")
        if not image_url:
            prev = link.find_previous("img")
            if prev and prev.get("src"):
                image_url = prev.get("src")

        description = ""
        for sib in link.find_previous_siblings(["p", "h3", "h4"], limit=5):
            text = sib.get_text(strip=True)
            if len(text) > 40 and "zalora" not in text.lower():
                description = text[:300]
                break

        brand = extract_brand_from_url(product_url or "") or extract_brand_from_name(name)

        products.append(
            {
                "id": slugify(name),
                "name": name,
                "brand": brand,
                "price": None,
                "priceFormatted": "See Zalora",
                "image": image_url,
                "description": description or name,
                "productUrl": product_url,
                "source": "zalora",
                "sourceUrl": url,
                "credibilityScore": 7,
                "category": "general",
            }
        )

    return products


async def scrape_zalora(urls: Optional[List[str]] = None, max_items: int = 10) -> List[Dict]:
    all_products: List[Dict] = []
    target_urls = urls or DEFAULT_ARTICLE_URLS

    for url in target_urls:
        try:
            products = await scrape_zalora_article(url)
            all_products.extend(products)
        except Exception:
            continue

    seen = set()
    unique: List[Dict] = []
    for p in all_products:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    return unique[:max_items]

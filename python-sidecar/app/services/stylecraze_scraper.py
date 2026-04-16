import re
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup


SOURCE = {
    "name": "StyleCraze",
    "base_url": "https://www.stylecraze.com",
    "credibility_score": 7,
    "category": "hair-specific",
    "description": "Hair care recommendations",
}

# Default article URL can be overridden by request payload.
DEFAULT_ARTICLE_URLS = [
    "https://www.stylecraze.com/articles/best-hair-products-for-curly-hair/",
]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


def extract_brand(name: str) -> str:
    brands = [
        "SheaMoisture",
        "Cantu",
        "DevaCurl",
        "Moroccanoil",
        "Olaplex",
        "Mielle",
        "Aunt Jackie",
        "Garnier",
        "L'Oreal",
        "Pantene",
        "TRESemmé",
        "OGX",
        "Briogeo",
        "Living Proof",
        "Amika",
        "Curlsmith",
        "Mixed Chicks",
        "Carol's Daughter",
        "Kinky-Curly",
    ]
    for brand in brands:
        if brand.lower() in name.lower():
            return brand
    return name.split()[0] if name.split() else "Unknown"


def parse_hair_types(hair_type_str: Optional[str]) -> List[str]:
    if not hair_type_str:
        return ["all"]
    mapping = {
        "curly": "curly",
        "wavy": "wavy",
        "coily": "coily",
        "straight": "straight",
        "fine": "fine",
        "thick": "thick",
        "kinky": "coily",
        "natural": "coily",
    }
    result: List[str] = []
    lower = hair_type_str.lower()
    for key, val in mapping.items():
        if key in lower and val not in result:
            result.append(val)
    return result if result else ["all"]


async def scrape_stylecraze(urls: Optional[List[str]] = None, max_items: int = 10) -> List[Dict[str, Any]]:
    products: List[Dict[str, Any]] = []
    target_urls = urls or DEFAULT_ARTICLE_URLS

    async with httpx.AsyncClient(
        timeout=12.0,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        follow_redirects=True,
    ) as client:
        for url in target_urls:
            try:
                response = await client.get(url)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")

                headings = soup.find_all(["h2", "h3"])
                for heading in headings:
                    name = heading.get_text(strip=True)

                    if len(name) < 5 or len(name) > 120:
                        continue
                    if any(
                        skip in name.lower()
                        for skip in [
                            "best",
                            "how to",
                            "what is",
                            "why",
                            "tips",
                            "conclusion",
                            "faqs",
                            "summary",
                            "overview",
                            "buying guide",
                            "infographic",
                        ]
                    ):
                        continue

                    description = ""
                    hair_type = None
                    price = None

                    sibling = heading.find_next_sibling()
                    for _ in range(5):
                        if sibling is None:
                            break
                        if sibling.name in ["h2", "h3"]:
                            break

                        text = sibling.get_text(strip=True)

                        if "Hair Type:" in text:
                            match = re.search(r"Hair Type:\\s*([^|]+)", text)
                            if match:
                                hair_type = match.group(1).strip()

                        if not description and len(text) > 30 and "Hair Type:" not in text:
                            description = text[:300]

                        price_match = re.search(r"\\$(\\d+(?:\\.\\d{2})?)", text)
                        if price_match and not price:
                            price = float(price_match.group(1))

                        sibling = sibling.find_next_sibling()

                    if name and (hair_type or description):
                        products.append(
                            {
                                "id": slugify(name),
                                "name": name,
                                "brand": extract_brand(name),
                                "price": price,
                                "priceFormatted": f"${price:.2f}" if price else "See website",
                                "description": description or name,
                                "hairTypes": parse_hair_types(hair_type),
                                "source": "stylecraze",
                                "sourceUrl": url,
                                "productUrl": url,
                                "credibilityScore": SOURCE["credibility_score"],
                                "category": SOURCE["category"],
                            }
                        )

            except Exception:
                continue

    seen = set()
    unique: List[Dict[str, Any]] = []
    for p in products:
        if p["name"] not in seen:
            seen.add(p["name"])
            unique.append(p)

    return unique[:max_items]

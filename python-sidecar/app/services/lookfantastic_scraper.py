import asyncio
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


LOOKFANTASTIC_TREATMENTS_URL = (
    "https://www.lookfantastic.com/c/health-beauty/hair/styling/"
    "?facetFilters=en_beauty_hairSubcategory_content%3AHair+%26+Scalp+Treatments"
)
LOOKFANTASTIC_CURLY_URL = (
    "https://www.lookfantastic.com/c/health-beauty/hair/styling/"
    "?facetFilters=en_beauty_hair_Styling_content%3ACurly+Hair+Styling"
)
LOOKFANTASTIC_ANTI_FRIZZ_URL = (
    "https://www.lookfantastic.com/c/health-beauty/hair/styling/"
    "?facetFilters=en_beauty_hair_Styling_content%3AAnti-Frizz+Styling"
)

HAIR_TYPE_URL_MAP: Dict[str, List[str]] = {
    "straight": [LOOKFANTASTIC_TREATMENTS_URL],
    "wavy": [LOOKFANTASTIC_CURLY_URL],
    "curly": [LOOKFANTASTIC_CURLY_URL],
    "coily": [LOOKFANTASTIC_CURLY_URL],
    "fine": [LOOKFANTASTIC_TREATMENTS_URL],
    "thick": [LOOKFANTASTIC_ANTI_FRIZZ_URL, LOOKFANTASTIC_TREATMENTS_URL],
    "general": [
        LOOKFANTASTIC_TREATMENTS_URL,
        LOOKFANTASTIC_CURLY_URL,
        LOOKFANTASTIC_ANTI_FRIZZ_URL,
    ],
}

CONCERN_URL_MAP: Dict[str, List[str]] = {
    "frizz": [LOOKFANTASTIC_ANTI_FRIZZ_URL],
    "dryness": [LOOKFANTASTIC_TREATMENTS_URL],
    "damage": [LOOKFANTASTIC_TREATMENTS_URL],
    "lack-of-volume": [LOOKFANTASTIC_TREATMENTS_URL],
    "oily-scalp": [LOOKFANTASTIC_TREATMENTS_URL],
    "dandruff": [LOOKFANTASTIC_TREATMENTS_URL],
    "lack-of-shine": [LOOKFANTASTIC_TREATMENTS_URL],
    "breakage": [LOOKFANTASTIC_TREATMENTS_URL],
    "tangled": [LOOKFANTASTIC_TREATMENTS_URL],
    "limp": [LOOKFANTASTIC_TREATMENTS_URL],
    "lack-of-definition": [LOOKFANTASTIC_CURLY_URL],
}

BASE_URL = "https://www.lookfantastic.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

HAIR_KEYWORDS = (
    "hair",
    "curl",
    "curly",
    "frizz",
    "scalp",
    "shampoo",
    "conditioner",
    "mask",
    "treatment",
    "serum",
    "oil",
    "mousse",
    "cream",
    "spray",
    "gel",
    "wax",
    "paste",
    "pomade",
    "styling",
    "leave-in",
    "heat protect",
    "textur",
    "volume",
    "repair",
    "smooth",
    "gloss",
)

EXCLUDED_TERMS = (
    "beauty box",
    "subscriptions",
    "pay monthly",
    "travel minis edit",
    "fragrance layering edit",
    "dermatological edit",
    "worth over",
)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]


def clean_price(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    normalized = re.sub(r"\s+", " ", str(raw)).strip()
    return normalized or None


def resolve_image(src: Optional[str]) -> Optional[str]:
    if not src:
        return None
    upgraded = re.sub(r"_(\d+)x(\d+)", "_800x800", src)
    if upgraded.startswith("//"):
        return "https:" + upgraded
    if upgraded.startswith("/"):
        return urljoin(BASE_URL, upgraded)
    return upgraded


def infer_category(url: str, hair_type: str) -> str:
    if "Anti-Frizz+Styling" in url:
        return "frizz"
    if "Curly+Hair+Styling" in url:
        return "curly-hair"
    if "Hair+%26+Scalp+Treatments" in url:
        if hair_type in {"damage", "dryness", "breakage"}:
            return "damage"
        return "general-care"
    return "general"


def infer_hair_type_label(url: str, hair_type: str) -> str:
    if hair_type and hair_type != "general":
        return hair_type
    if "Curly+Hair+Styling" in url:
        return "curly"
    if "Anti-Frizz+Styling" in url:
        return "frizz"
    return "general"


def is_probable_hair_product(name: str, product_url: str) -> bool:
    normalized_name = str(name or "").strip().lower()
    if re.fullmatch(r"\d+(?:\.\d+)?\s?(ml|g|oz)", normalized_name):
        return False

    haystack = f"{name} {product_url}".lower()

    if any(term in haystack for term in EXCLUDED_TERMS):
        return False

    return any(keyword in haystack for keyword in HAIR_KEYWORDS)


def is_allowed_product(product: Dict) -> bool:
    return is_probable_hair_product(product.get("name", ""), product.get("productUrl", ""))


def parse_product_cards(html: str, source_url: str, hair_type: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    products: List[Dict] = []
    category = infer_category(source_url, hair_type)
    label = infer_hair_type_label(source_url, hair_type)

    cards = (
        soup.select("li[data-product-id]")
        or soup.select(".productBlock")
        or soup.select("li.productListProducts_product")
        or soup.select("[class*='productBlock']")
        or soup.select("[class*='productListProducts']")
    )

    for card in cards:
        anchor = (
            card.find("a", href=True)
            or card.select_one("a[href*='/p/']")
            or card.select_one("a[href*='/products/']")
        )
        if not anchor:
            continue

        href = anchor.get("href", "")
        product_url = href if href.startswith("http") else urljoin(BASE_URL, href)
        if "/p/" not in product_url and "/products/" not in product_url:
            continue

        name_el = (
            card.select_one("[class*='productName']")
            or card.select_one("[class*='product-name']")
            or card.select_one("[data-testid*='product-title']")
            or card.select_one("h3")
            or card.select_one("h2")
        )
        name = name_el.get_text(" ", strip=True) if name_el else anchor.get_text(" ", strip=True)
        if not name or len(name) < 3:
            continue
        if not is_probable_hair_product(name, product_url):
            continue

        brand_el = (
            card.select_one("[class*='brandName']")
            or card.select_one("[class*='brand-name']")
            or card.select_one("[class*='Brand']")
            or card.select_one("[data-testid*='product-brand']")
        )
        brand = brand_el.get_text(" ", strip=True) if brand_el else name.split()[0]

        price_el = (
            card.select_one("[class*='price']")
            or card.select_one("[class*='Price']")
            or card.select_one("[data-testid*='price']")
        )
        raw_price = clean_price(price_el.get_text(" ", strip=True) if price_el else None)
        price_str = raw_price or "See Lookfantastic"

        img = card.find("img")
        image_url = resolve_image(
            img.get("src") or img.get("data-src") or img.get("data-lazy-src") if img else None
        )

        rating_el = (
            card.select_one("[class*='rating']")
            or card.select_one("[class*='Rating']")
            or card.select_one("[data-testid*='rating']")
        )
        rating = clean_price(rating_el.get_text(" ", strip=True) if rating_el else None)

        products.append(
            {
                "id": slugify(name),
                "name": name,
                "brand": brand,
                "price": raw_price,
                "priceFormatted": price_str,
                "image": image_url,
                "description": name,
                "productUrl": product_url,
                "rating": rating,
                "source": "lookfantastic",
                "sourceUrl": source_url,
                "hairType": label,
                "credibilityScore": 8,
                "category": category,
            }
        )

    if not products:
        for anchor in soup.select("a[href*='/p/'], a[href*='/products/']"):
            href = anchor.get("href", "")
            name = anchor.get_text(" ", strip=True)
            if not name or len(name) < 5 or not href:
                continue

            product_url = href if href.startswith("http") else urljoin(BASE_URL, href)
            if not is_probable_hair_product(name, product_url):
                continue
            img = anchor.find("img") or anchor.find_previous("img")
            image_url = resolve_image(
                (img.get("src") or img.get("data-src") or img.get("data-lazy-src")) if img else None
            )

            products.append(
                {
                    "id": slugify(name),
                    "name": name,
                    "brand": name.split()[0],
                    "price": None,
                    "priceFormatted": "See Lookfantastic",
                    "image": image_url,
                    "description": name,
                    "productUrl": product_url,
                    "rating": None,
                    "source": "lookfantastic",
                    "sourceUrl": source_url,
                    "hairType": label,
                    "credibilityScore": 6,
                    "category": category,
                }
            )

    return products


async def scrape_with_playwright(url: str, hair_type: str) -> List[Dict]:
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError(
            "playwright not installed - run: pip install playwright playwright-stealth && playwright install chromium"
        ) from exc

    try:
        from playwright_stealth import stealth_async

        has_stealth = True
    except ImportError:
        has_stealth = False

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="en-US",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        if has_stealth:
            await stealth_async(page)

        await page.route(
            "**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,otf}",
            lambda route: route.abort(),
        )

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)

            try:
                await page.wait_for_selector(
                    "[data-product-id], .productBlock, [class*='productBlock'], a[href*='/p/']",
                    timeout=8000,
                )
            except Exception:
                pass

            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            await asyncio.sleep(1.5)
            html = await page.content()
        finally:
            await browser.close()

    return parse_product_cards(html, url, hair_type)


async def scrape_with_httpx(url: str, hair_type: str) -> List[Dict]:
    async with httpx.AsyncClient(
        timeout=15.0,
        headers=HEADERS,
        follow_redirects=True,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()

    return parse_product_cards(response.text, url, hair_type)


async def scrape_lookfantastic_by_url(
    url: str,
    hair_type: str = "general",
    use_playwright: bool = True,
) -> List[Dict]:
    if use_playwright:
        try:
            products = await scrape_with_playwright(url, hair_type)
            if products:
                return products
        except Exception as exc:
            print(f"[LF] Playwright failed for {url}: {exc} - falling back to httpx")

    return await scrape_with_httpx(url, hair_type)


def _normalize_strings(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []
    normalized = []
    for value in values:
        if not value:
            continue
        key = str(value).strip().lower()
        if key and key not in normalized:
            normalized.append(key)
    return normalized


def _build_tasks(
    hair_types: Optional[List[str]] = None,
    concerns: Optional[List[str]] = None,
    urls: Optional[List[str]] = None,
) -> List[Tuple[str, str]]:
    tasks: List[Tuple[str, str]] = []

    if urls:
        return [(url, "general") for url in urls]

    normalized_hair_types = _normalize_strings(hair_types)
    normalized_concerns = _normalize_strings(concerns)

    for hair_type in normalized_hair_types:
        for target in HAIR_TYPE_URL_MAP.get(hair_type, []):
            pair = (target, hair_type)
            if pair not in tasks:
                tasks.append(pair)

    for concern in normalized_concerns:
        for target in CONCERN_URL_MAP.get(concern, []):
            pair = (target, concern)
            if pair not in tasks:
                tasks.append(pair)

    if not tasks:
        for target in HAIR_TYPE_URL_MAP["general"]:
            pair = (target, "general")
            if pair not in tasks:
                tasks.append(pair)

    return tasks


async def scrape_lookfantastic(
    hair_types: Optional[List[str]] = None,
    concerns: Optional[List[str]] = None,
    urls: Optional[List[str]] = None,
    max_items: int = 20,
    use_playwright: bool = True,
) -> List[Dict]:
    tasks = _build_tasks(hair_types=hair_types, concerns=concerns, urls=urls)
    semaphore = asyncio.Semaphore(3)

    async def bounded(url: str, hair_type: str) -> List[Dict]:
        async with semaphore:
            try:
                return await scrape_lookfantastic_by_url(url, hair_type, use_playwright)
            except Exception as exc:
                print(f"[LF] Error scraping {url}: {exc}")
                return []

    results = await asyncio.gather(*[bounded(url, hair_type) for url, hair_type in tasks])

    seen = set()
    unique: List[Dict] = []
    for batch in results:
        for product in batch:
            identifier = product.get("productUrl") or product["id"]
            if identifier in seen:
                continue
            seen.add(identifier)
            if is_allowed_product(product):
                unique.append(product)

    return unique[: max(1, min(max_items, 50))]

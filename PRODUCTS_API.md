# Product Recommendation API Documentation

## Overview
The Product Recommendation API provides AI-powered hair care product recommendations based on user attributes and preferences. It uses intelligent filtering, caching, and is designed to integrate with real product APIs.

## Base URL
```
http://localhost:3001/api/products
```

---

## Endpoints

### 1. **Search Products** (Main Endpoint)
**POST** `/search`

Search for hair care products based on user attributes.

#### Request Body
```json
{
  "hairType": "curly",           // optional: straight | wavy | curly | coily | fine | thick
  "concerns": "frizz",           // optional: frizz | dryness | damage | lack-of-volume | oily-scalp | dandruff | lack-of-shine | breakage | tangled | limp | lack-of-definition
  "budgetCategory": "20-40",     // optional: under-20 | 20-40 | 40-60 | 60-plus
  "limit": 6                     // optional: 1-50 (default: 6)
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "devacurl-cream",
      "name": "SuperCream Coconut Curl Styler",
      "brand": "DevaCurl",
      "price": 28,
      "priceFormatted": "$28.00",
      "rating": 4.6,
      "image": "https://...",
      "description": "Lightweight curl-defining cream...",
      "hairTypes": ["curly", "wavy", "coily"],
      "concerns": ["frizz", "dryness", "definition"],
      "budgetCategory": "20-40",
      "website": "amazon.com",
      "productUrl": "https://amazon.com/...",
      "rating_count": 2341
    }
  ],
  "count": 6,
  "source": "local-knowledge-base",  // or "api-integration", "amazon-api", etc.
  "cached": false,
  "request_id": "uuid"
}
```

#### Examples

**Basic Search**
```bash
curl -X POST http://localhost:3001/api/products/search \
  -H "Content-Type: application/json" \
  -d '{"hairType": "curly"}'
```

**Search with Multiple Filters**
```bash
curl -X POST http://localhost:3001/api/products/search \
  -H "Content-Type: application/json" \
  -d '{
    "hairType": "curly",
    "concerns": "frizz",
    "budgetCategory": "20-40",
    "limit": 5
  }'
```

---

### 2. **Get Filter Options**
**GET** `/filters`

Get all available filter options for UI dropdowns.

#### Response
```json
{
  "success": true,
  "data": {
    "hairTypes": [
      "straight",
      "wavy",
      "curly",
      "coily",
      "fine",
      "thick"
    ],
    "concerns": [
      "frizz",
      "dryness",
      "damage",
      "lack-of-volume",
      "oily-scalp",
      "dandruff",
      "lack-of-shine",
      "breakage",
      "tangled",
      "limp",
      "lack-of-definition"
    ],
    "budgetCategories": [
      "under-20",
      "20-40",
      "40-60",
      "60-plus"
    ]
  },
  "request_id": "uuid"
}
```

#### Example
```bash
curl http://localhost:3001/api/products/filters
```

---

### 3. **Advanced Search**
**POST** `/search/advanced`

Advanced product search with additional filters and sorting.

#### Request Body
```json
{
  "hairType": "curly",           // optional: string or array
  "concerns": "frizz",           // optional: string or array
  "budgetCategory": "20-40",     // optional: string
  "minRating": 4.5,              // optional: 0-5
  "maxPrice": 50,                // optional: number
  "limit": 6,                    // optional: 1-50
  "sortBy": "rating"             // optional: rating | price | brand
}
```

#### Response
```json
{
  "success": true,
  "data": [...],
  "count": 6,
  "filters": {
    "hairType": "curly",
    "concerns": ["frizz"],
    "budgetCategory": "20-40",
    "minRating": 4.5,
    "maxPrice": 50,
    "sortBy": "rating"
  },
  "request_id": "uuid"
}
```

#### Example
```bash
curl -X POST http://localhost:3001/api/products/search/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "hairType": "curly",
    "concerns": "frizz",
    "minRating": 4.5,
    "sortBy": "price"
  }'
```

---

### 4. **Get Cache Statistics** (Admin/Debug)
**GET** `/stats`

Get current cache statistics for monitoring.

#### Response
```json
{
  "success": true,
  "data": {
    "size": 3,
    "items": [
      "products:curly:frizz:20-40",
      "products:wavy:dryness:under-20",
      "filter-options"
    ],
    "totalSize": 3
  },
  "request_id": "uuid"
}
```

#### Example
```bash
curl http://localhost:3001/api/products/stats
```

---

## Error Handling

### Validation Errors
```json
{
  "success": false,
  "error": "Invalid hairType. Must be one of: straight, wavy, curly, coily, fine, thick",
  "field": "hairType",
  "request_id": "uuid"
}
```

### Server Errors
```json
{
  "success": false,
  "error": "Product search failed: ...",
  "request_id": "uuid"
}
```

### Common Error Codes
- **400** - Bad Request (validation error)
- **404** - Not Found
- **500** - Internal Server Error

---

## Caching

The API implements intelligent caching with a 15-minute TTL (Time To Live):

- **First request**: Data fetched from source, cached, returned with `"cached": false`
- **Subsequent requests** (within 15 min): Data returned from cache with `"cached": true`
- **After TTL expires**: Cache invalidated, fresh data fetched

### Cache Key Format
```
products:{hairType}:{concerns}:{budgetCategory}
```

Example: `products:curly:frizz:20-40`

---

## Integration Examples

### React/Frontend Example
```typescript
const searchProducts = async (filters) => {
  const response = await fetch('http://localhost:3001/api/products/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });
  
  return response.json();
};

// Usage
const results = await searchProducts({
  hairType: 'curly',
  concerns: 'frizz',
  budgetCategory: '20-40',
  limit: 6
});
```

### PowerShell/Testing Example
```powershell
$body = @{
    hairType = "curly"
    concerns = "frizz"
    budgetCategory = "20-40"
    limit = 6
} | ConvertTo-Json

$response = Invoke-WebRequest `
  -Uri "http://localhost:3001/api/products/search" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"

$response.Content | ConvertFrom-Json | ForEach-Object { $_.data }
```

---

## Performance Notes

- **Cache TTL**: 15 minutes
- **Max limit**: 50 products per request
- **Response time**: <100ms (cached), <2s (fresh fetch)
- **Rate limiting**: Not currently implemented (can be added)

---

## Future Enhancements

### Real API Integration Points
The system is designed to integrate with:

1. **RapidAPI Product Search**
   - Multiple e-commerce platforms
   - Real-time pricing
   - Stock availability

2. **Amazon Product Advertising API**
   - Real product data
   - Up-to-date prices
   - Reviews and ratings

3. **Direct Scraping** (with puppeteer/cheerio)
   - Sephora, Target, Ulta
   - Custom product matching

4. **Custom Integration**
   - Your own product database
   - Affiliate links
   - Commission tracking

### Configuration
To enable real API integration, add environment variables:
```bash
RAPIDAPI_KEY=your_key
RAPIDAPI_HOST=your_host
AMAZON_API_KEY=your_key
AMAZON_SECRET=your_secret
```

Then uncomment integration code in `productScraper.js`

---

## Testing

Run the included test script:
```bash
cd scripts
./test-api.ps1
```

Test specific endpoint:
```powershell
$body = @{ hairType = "curly" } | ConvertTo-Json
Invoke-WebRequest `
  -Uri "http://localhost:3001/api/products/search" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

---

## API Flows

### 1. Basic Recommendation Flow
```
Client → POST /api/products/search
       ← Products ranked by match score
```

### 2. Filter-First Flow
```
Client → GET /api/products/filters
       ← Available options
Client → POST /api/products/search (with selected filters)
       ← Filtered products
```

### 3. Advanced Search Flow
```
Client → POST /api/products/search/advanced (with additional filters)
       ← Products filtered, sorted, ranked
```

---

## Best Practices

1. **Always call `/filters` first** to populate UI dropdowns
2. **Cache filter options** on frontend to reduce API calls
3. **Use appropriate limit** based on UI (6-10 for cards, 20+ for lists)
4. **Sort by relevance** (default rating) for better UX
5. **Handle errors gracefully** with user-friendly messages

---

## Support

For issues or feature requests, check:
- Server logs: `npm run dev` output
- Cache stats: `GET /api/products/stats`
- Validation errors: Check error message and `field` property

---

*Last Updated: March 12, 2026*
*API Version: 1.0*

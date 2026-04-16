"""
Scrapy/Twisted reactor bootstrap for ASGI environments.

Must run before importing Scrapy/Twisted reactors.
"""

try:
    from scrapy.utils.reactor import install_reactor

    # Use asyncio-compatible reactor to avoid conflicts with FastAPI/uvicorn.
    install_reactor("twisted.internet.asyncioreactor.AsyncioSelectorReactor")
except Exception:
    # Reactor may already be installed; ignore to keep service running.
    pass

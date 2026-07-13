# Playwright (headless Chromium) + BeautifulSoup scraper.
# Renders JS-driven pages (live scoreboards, SPAs) before extracting text, so
# pages that build their content client-side aren't left as empty shells —
# a plain HTTP GET could only ever see server-delivered HTML.
# URLs are scraped concurrently; one failure never aborts the batch.

import asyncio

from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright

from core.logger import get_logger

logger = get_logger("news.scraper")

# A complete, current Chrome UA. A truncated string (missing the
# "(KHTML, like Gecko) Chrome/… Safari/537.36" tail) is an instant tell for
# bot-detection (Cloudflare/Akamai/DataDome) and gets the request blocked.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
_NAV_TIMEOUT_MS = 25_000
# After the DOM is ready, give client-side rendering a brief moment to paint.
# networkidle is deliberately avoided: news sites run ads/analytics/trackers
# continuously, so the network never goes idle and every page hits the timeout.
_SETTLE_MS = 1_500
# Cap concurrent browser contexts so a 5-URL batch doesn't spawn 5 heavy
# renders at once on a small container.
_MAX_CONCURRENCY = 3
_NOISE_TAGS = ["script", "style", "nav", "footer", "header", "aside", "advertisement"]


async def _scrape_one(browser: Browser, url: str) -> dict:
    """Render one URL in an isolated browser context and extract its text."""
    context = await browser.new_context(user_agent=_USER_AGENT)
    try:
        page = await context.new_page()
        # domcontentloaded fires reliably; a short settle lets SPA content paint.
        # No networkidle, no second navigation — both were the main cause of the
        # 30s-per-URL timeouts that made most ingests fail.
        await page.goto(url, timeout=_NAV_TIMEOUT_MS, wait_until="domcontentloaded")
        try:
            await page.wait_for_timeout(_SETTLE_MS)
        except Exception:
            pass

        html = await page.content()
        soup = BeautifulSoup(html, "lxml")

        for tag in soup(_NOISE_TAGS):
            tag.decompose()

        title = ""
        if soup.find("h1"):
            title = soup.find("h1").get_text(strip=True)
        elif soup.title:
            title = soup.title.get_text(strip=True)

        # Extract main content — try article tag first, then main, then body
        content_tag = soup.find("article") or soup.find("main") or soup.find("body")
        content = content_tag.get_text(separator="\n", strip=True) if content_tag else ""

        word_count = len(content.split())
        if word_count < 50:
            return {
                "url": url, "title": title, "content": "",
                "word_count": 0,
                "error": (
                    "Could not extract readable article text — the page may be "
                    "paywalled, require a login, or block automated access."
                ),
            }

        logger.info(f"scraped url={url} title={title[:50]} words={word_count}")
        return {
            "url": url, "title": title, "content": content,
            "word_count": word_count, "error": None,
        }

    except Exception as exc:
        logger.error(f"scrape_failed url={url} error={exc}")
        return {"url": url, "title": "", "content": "", "word_count": 0, "error": str(exc)}

    finally:
        await context.close()


async def scrape_urls(urls: list[str]) -> list[dict]:
    """
    Scrape content from every URL in the list using a headless Chromium browser.

    Renders each page (executing its JavaScript) before extracting text, so
    client-rendered pages — live sports scorecards, SPA-driven news sites,
    dashboards — are captured the same as static article/wiki pages.

    URLs are scraped concurrently (bounded by a semaphore). Results preserve
    input order.

    Returns a list of dicts, one per URL:
        url        – original URL
        title      – page title extracted from h1 or <title>
        content    – plain text of the article body
        word_count – rough word count of the content
        error      – None on success, error message string on failure
    """
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)

        async def _bounded(url: str) -> dict:
            async with semaphore:
                return await _scrape_one(browser, url)

        try:
            return await asyncio.gather(*[_bounded(url) for url in urls])
        finally:
            await browser.close()

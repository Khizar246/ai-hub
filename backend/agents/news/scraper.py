# Playwright (headless Chromium) + BeautifulSoup scraper.
# Renders JS-driven pages (live scoreboards, SPAs) before extracting text, so
# pages that build their content client-side aren't left as empty shells —
# the httpx-only approach could only ever see server-delivered HTML.
# Each URL is scraped independently so one failure never aborts the batch.

from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright

from core.logger import get_logger

logger = get_logger("news.scraper")

_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
_NAV_TIMEOUT_MS = 30_000
_NOISE_TAGS = ["script", "style", "nav", "footer", "header", "aside", "advertisement"]


async def _scrape_one(browser: Browser, url: str) -> dict:
    """Render one URL in an isolated browser context and extract its text."""
    context = await browser.new_context(user_agent=_USER_AGENT)
    try:
        page = await context.new_page()
        try:
            await page.goto(url, timeout=_NAV_TIMEOUT_MS, wait_until="networkidle")
        except Exception:
            # Some pages (long-polling widgets, live scoreboards) never go fully
            # idle — fall back to whatever has rendered once DOM content is ready.
            await page.goto(url, timeout=_NAV_TIMEOUT_MS, wait_until="domcontentloaded")

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
                "word_count": 0, "error": "Insufficient content extracted",
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

    Returns a list of dicts, one per URL:
        url        – original URL
        title      – page title extracted from h1 or <title>
        content    – plain text of the article body
        word_count – rough word count of the content
        error      – None on success, error message string on failure
    """
    results: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for url in urls:
                results.append(await _scrape_one(browser, url))
        finally:
            await browser.close()

    return results

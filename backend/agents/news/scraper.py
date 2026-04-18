# httpx + BeautifulSoup scraper — replaces Crawl4AI which requires Playwright/subprocess on Windows.
# Each URL is scraped independently so one failure never aborts the batch.

import httpx
from bs4 import BeautifulSoup

from core.logger import get_logger

logger = get_logger("news.scraper")


async def scrape_urls(urls: list[str]) -> list[dict]:
    """
    Scrape content from every URL in the list using httpx + BeautifulSoup.

    Returns a list of dicts, one per URL:
        url        – original URL
        title      – page title extracted from h1 or <title>
        content    – plain text of the article body
        word_count – rough word count of the content
        error      – None on success, error message string on failure
    """
    results: list[dict] = []

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
    ) as client:
        for url in urls:
            try:
                response = await client.get(url)
                soup = BeautifulSoup(response.text, "lxml")

                # Remove noise
                for tag in soup(["script", "style", "nav", "footer", "header", "aside", "advertisement"]):
                    tag.decompose()

                # Extract title
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
                    results.append({
                        "url": url, "title": title, "content": "",
                        "word_count": 0, "error": "Insufficient content extracted",
                    })
                    continue

                logger.info(f"scraped url={url} title={title[:50]} words={word_count}")
                results.append({
                    "url": url, "title": title, "content": content,
                    "word_count": word_count, "error": None,
                })

            except Exception as exc:
                logger.error(f"scrape_failed url={url} error={exc}")
                results.append({
                    "url": url, "title": "", "content": "",
                    "word_count": 0, "error": str(exc),
                })

    return results

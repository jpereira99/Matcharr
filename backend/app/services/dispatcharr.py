"""Dispatcharr REST API client."""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import urljoin

import httpx

DEFAULT_TIMEOUT = 30.0

logger = logging.getLogger(__name__)


def _parse_dispatcharr_json_error(body: str) -> dict[str, Any] | None:
    """Extract Simple JWT / DRF error fields when present."""
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    out: dict[str, Any] = {}
    if "code" in data:
        out["code"] = data["code"]
    detail = data.get("detail")
    if isinstance(detail, str):
        out["detail"] = detail
    elif isinstance(detail, list) and detail:
        out["detail"] = detail
    messages = data.get("messages")
    if isinstance(messages, list) and messages:
        out["messages"] = messages
    return out or None


def _looks_like_jwt(token: str) -> bool:
    """JWTs are three base64url segments; Dispatcharr API keys are not."""
    parts = token.split(".")
    return len(parts) == 3 and all(p.strip() for p in parts)


class DispatcharrError(Exception):
    pass


class DispatcharrClient:
    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token.strip()

    def _auth_scheme(self) -> str:
        """Dispatcharr: JWT access tokens use Bearer; API keys use ApiKey (see Dispatcharr docs)."""
        if not self.token:
            return "none"
        return "bearer_jwt" if _looks_like_jwt(self.token) else "api_key"

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Accept": "application/json"}
        if not self.token:
            return h
        if _looks_like_jwt(self.token):
            h["Authorization"] = f"Bearer {self.token}"
        else:
            h["Authorization"] = f"ApiKey {self.token}"
        return h

    def _test_failure_detail(
        self,
        *,
        request_url: str,
        response: httpx.Response | None,
        exc: BaseException | None = None,
    ) -> dict[str, Any]:
        """Safe diagnostics for logs and API responses (no token values)."""
        scheme = self._auth_scheme()
        auth_hint = (
            "Authorization: Bearer <jwt>"
            if scheme == "bearer_jwt"
            else "Authorization: ApiKey <key>" if scheme == "api_key" else "(no token)"
        )
        out: dict[str, Any] = {
            "request_url": request_url,
            "auth": auth_hint,
            "auth_scheme": scheme,
            "token_length": len(self.token),
            "token_configured": bool(self.token),
        }
        if exc is not None:
            out["error"] = f"{type(exc).__name__}: {exc}"
            return out
        assert response is not None
        out["http_status"] = response.status_code
        ct = response.headers.get("content-type", "")
        if ct:
            out["content_type"] = ct
        www = response.headers.get("www-authenticate")
        if www:
            out["www_authenticate"] = www
        text = response.text
        if text:
            out["response_preview"] = text[:1200]
            parsed = _parse_dispatcharr_json_error(text)
            if parsed:
                out["dispatcharr_api_error"] = parsed
        return out

    async def test_connection(self) -> tuple[bool, str, Any | None]:
        url = f"{self.base_url}/api/channels/channels/"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                r = await client.get(
                    url, headers=self._headers(), params={"page_size": 1}
                )
        except Exception as e:
            detail = self._test_failure_detail(request_url=url, response=None, exc=e)
            logger.warning(
                "Dispatcharr connection test failed (request error): %s",
                detail,
                exc_info=True,
            )
            return False, str(e), detail
        if r.status_code == 401:
            detail = self._test_failure_detail(request_url=url, response=r)
            api_err = detail.get("dispatcharr_api_error") or {}
            msg = "Unauthorized (check token)"
            if isinstance(api_err.get("detail"), str):
                msg = f"Unauthorized: {api_err['detail']}"
            logger.warning(
                "Dispatcharr returned 401 for GET %s — check token and Dispatcharr API auth settings. %s",
                url,
                {
                    k: v
                    for k, v in detail.items()
                    if k not in ("response_preview", "dispatcharr_api_error")
                },
            )
            if detail.get("response_preview"):
                logger.warning(
                    "Dispatcharr 401 response body (preview): %s",
                    detail["response_preview"][:500],
                )
            return False, msg, detail
        if r.status_code >= 400:
            detail = self._test_failure_detail(request_url=url, response=r)
            logger.warning(
                "Dispatcharr connection test failed: HTTP %s for %s — %s",
                r.status_code,
                url,
                {k: v for k, v in detail.items() if k != "response_preview"},
            )
            if detail.get("response_preview"):
                logger.warning(
                    "Dispatcharr error body (preview): %s",
                    detail["response_preview"][:500],
                )
            return False, f"HTTP {r.status_code}", detail
        return True, "OK", None

    async def list_streams(
        self, name_contains: str = "", page_size: int = 500
    ) -> list[dict[str, Any]]:
        base = f"{self.base_url}/api/channels/streams/"
        params: dict[str, Any] = {"page_size": page_size}
        if name_contains:
            params["name"] = name_contains
        all_rows: list[dict[str, Any]] = []
        next_url: str | None = base
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            while next_url:
                r = await client.get(
                    next_url,
                    headers=self._headers(),
                    params=params if next_url == base else None,
                )
                r.raise_for_status()
                data = r.json()
                if isinstance(data, list):
                    all_rows.extend(data)
                    break
                chunk = data.get("results", data.get("data", []))
                all_rows.extend(chunk)
                nxt = data.get("next") or None
                if nxt and nxt.startswith("/"):
                    nxt = urljoin(self.base_url + "/", nxt.lstrip("/"))
                elif nxt and not nxt.startswith("http"):
                    nxt = urljoin(self.base_url + "/", str(nxt).lstrip("/"))
                next_url = nxt
                params = None
        return all_rows

    async def list_channels(
        self, search: str = "", page_size: int = 500
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/api/channels/channels/"
        params: dict[str, Any] = {"page_size": page_size}
        if search:
            params["search"] = search
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.get(url, headers=self._headers(), params=params)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            return data
        return data.get("results", data.get("data", []))

    async def get_channel_streams(self, channel_id: int) -> list[dict[str, Any]]:
        url = f"{self.base_url}/api/channels/channels/{channel_id}/streams/"
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.get(url, headers=self._headers())
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            return data
        return data.get("results", data.get("data", []))

    async def patch_channel_streams(
        self, channel_id: int, stream_ids: list[int]
    ) -> dict[str, Any]:
        """Set channel streams order / membership (Dispatcharr ChannelSerializer.update)."""
        url = f"{self.base_url}/api/channels/channels/{channel_id}/"
        payload = {"streams": stream_ids}
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.patch(
                url,
                headers={**self._headers(), "Content-Type": "application/json"},
                json=payload,
            )
        if r.status_code >= 400:
            raise DispatcharrError(
                f"PATCH channel failed: {r.status_code} {r.text[:500]}"
            )
        return r.json()
